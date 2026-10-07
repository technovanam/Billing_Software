// /warehouse: godowns, stock in/out/transfer, barcode lookup, stock reports,
// staff and admin linking. Moved here from the billing website's backend.
// Owners and warehouse ("wh.") accounts only; POS cashier tokens are refused.
const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { requireAuth } = require('../auth/verifyToken');

function createWarehouseRouter({ auth } = {}) {
  const router = express.Router();
  const firestore = () => admin.firestore();
  const authenticateRequest = requireAuth({ roles: ['owner', 'warehouse'], property: 'user', auth });

  // ─── Warehouse: Barcode Lookup & Management Endpoints ──────────────────────
  // Helper: timeout-bound fetch
  async function fetchWithTimeout(url, timeoutMs = 4000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          return res;
      } catch (e) {
          clearTimeout(id);
          throw e;
      }
  }

  // 1. Resolve Barcode (O(1) via barcodeIndex -> product -> stock, fallback to external lookup)
  router.post('/warehouse/barcode/resolve', authenticateRequest, async (req, res) => {
      try {
          const { barcode, godownId } = req.body;
          if (!barcode || typeof barcode !== 'string') {
              return res.status(400).json({ success: false, error: 'barcode is required' });
          }
          const code = barcode.trim();
          const db = firestore();
          const uid = req.user.uid;

          // Step 1: O(1) Check barcodeIndex/{barcode}
          const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
          const indexSnap = await indexRef.get();
          if (indexSnap.exists) {
              const { productId, productCollectionPath } = indexSnap.data();
              const prodRef = productCollectionPath
                  ? db.doc(`${productCollectionPath}/${productId}`)
                  : db.collection('users').doc(uid).collection('products').doc(productId);
              const prodSnap = await prodRef.get();
              if (prodSnap.exists) {
                  const product = { id: prodSnap.id, ...prodSnap.data() };
                  let stock = { quantity: 0 };
                  if (godownId) {
                      const stockDocId = `${code}_${godownId}`;
                      const stockSnap = await db.collection('users').doc(uid).collection('stock').doc(stockDocId).get();
                      if (stockSnap.exists) {
                          stock = stockSnap.data();
                      }
                  }
                  return res.json({ success: true, status: 'found', product, stock });
              }
          }

          // Direct check on products/{code} if not in barcodeIndex yet
          const directProdRef = db.collection('users').doc(uid).collection('products').doc(code);
          const directProdSnap = await directProdRef.get();
          if (directProdSnap.exists) {
              const product = { id: directProdSnap.id, ...directProdSnap.data() };
              let stock = { quantity: 0 };
              if (godownId) {
                  const stockDocId = `${code}_${godownId}`;
                  const stockSnap = await db.collection('users').doc(uid).collection('stock').doc(stockDocId).get();
                  if (stockSnap.exists) {
                      stock = stockSnap.data();
                  }
              }
              return res.json({ success: true, status: 'found', product, stock });
          }

          // Step 2: Check barcodeCache/{code} (30-day TTL)
          const cacheRef = db.collection('users').doc(uid).collection('barcodeCache').doc(code);
          const cacheSnap = await cacheRef.get();
          if (cacheSnap.exists) {
              const cacheData = cacheSnap.data();
              const cachedAt = cacheData.cachedAt?.toDate ? cacheData.cachedAt.toDate() : new Date(cacheData.cachedAt || 0);
              if (Date.now() - cachedAt.getTime() < 30 * 24 * 60 * 60 * 1000) {
                  return res.json({ success: true, status: 'external_found', lookupData: cacheData.lookupData });
              }
          }

          // Step 3: Fallback external lookup: Open Food Facts -> UPCItemDB
          let externalData = null;
          try {
              const r = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, 4000);
              if (r.ok) {
                  const data = await r.json();
                  if (data.status === 1 && data.product) {
                      const p = data.product;
                      const name = (p.product_name || p.product_name_en || '').trim();
                      if (name) {
                          externalData = {
                              name,
                              brand: (p.brands || '').trim(),
                              category: (p.categories_tags?.[0] || '').replace(/^[a-z]+:/, '').trim(),
                              imageUrl: p.image_front_url || p.image_url || '',
                              barcode: code,
                          };
                      }
                  }
              }
          } catch (_) {}

          if (!externalData) {
              try {
                  const r = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, 4000);
                  if (r.ok) {
                      const data = await r.json();
                      if (data.code === 'OK' && data.items?.length) {
                          const item = data.items[0];
                          const name = (item.title || '').trim();
                          if (name) {
                              externalData = {
                                  name,
                                  brand: (item.brand || '').trim(),
                                  category: (item.category || '').trim(),
                                  imageUrl: item.images?.[0] || '',
                                  barcode: code,
                              };
                          }
                      }
                  }
              } catch (_) {}
          }

          if (externalData) {
              await cacheRef.set({
                  lookupData: externalData,
                  source: externalData.brand ? 'external' : 'lookup',
                  cachedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              return res.json({ success: true, status: 'external_found', lookupData: externalData });
          }

          return res.json({ success: true, status: 'not_found', barcode: code });
      } catch (err) {
          console.error('Resolve barcode error:', err);
          return res.status(500).json({ error: err.message });
      }
  });

  // 2. Stock In (Atomic WriteBatch / runTransaction: increment stock and record IN movement)
  router.post('/warehouse/stock/in', authenticateRequest, async (req, res) => {
      try {
          const { barcode, godownId, quantity, referenceNo, remarks, operatorName } = req.body;
          const qty = Number(quantity);
          if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });
          if (!godownId || typeof godownId !== 'string') return res.status(400).json({ error: 'Valid godownId is required' });
          if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

          const db = firestore();
          const uid = req.user.uid;
          const code = barcode.trim();

          const result = await db.runTransaction(async (transaction) => {
              // Find product
              let productId = code;
              let productData = null;
              const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
              const indexSnap = await transaction.get(indexRef);
              if (indexSnap.exists) {
                  productId = indexSnap.data().productId;
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              } else {
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              }

              if (!productData) {
                  throw new Error(`Product not found for barcode ${code}`);
              }

              // Verify godown
              const godownRef = db.collection('users').doc(uid).collection('godowns').doc(godownId);
              const godownSnap = await transaction.get(godownRef);
              if (!godownSnap.exists) {
                  throw new Error(`Godown not found: ${godownId}`);
              }
              const godownName = godownSnap.data().name || 'Godown';

              // Atomic stock update & movement in the exact same transaction
              const stockId = `${code}_${godownId}`;
              const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
              const stockSnap = await transaction.get(stockRef);
              const currentStock = stockSnap.exists ? (stockSnap.data().quantity || 0) : 0;
              const newQuantity = currentStock + qty;

              const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

              transaction.set(stockRef, {
                  productBarcode: code,
                  productId,
                  productName: productData.name || '',
                  godownId,
                  godownName,
                  quantity: newQuantity,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              transaction.set(movRef, {
                  productBarcode: code,
                  productName: productData.name || '',
                  godownId,
                  godownName,
                  quantity: qty,
                  type: 'IN',
                  referenceNo: referenceNo || '',
                  remarks: remarks || '',
                  userId: uid,
                  userEmail: req.user.email || '',
                  operatorName: operatorName || '',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              return { newQuantity, movementId: movRef.id, productName: productData.name, godownName };
          });

          res.json({ success: true, data: result });
      } catch (error) {
          console.error('Stock in error:', error);
          res.status(400).json({ error: error.message });
      }
  });

  // 3. Stock Out (runTransaction with INSUFFICIENT_STOCK guard)
  router.post('/warehouse/stock/out', authenticateRequest, async (req, res) => {
      try {
          const { barcode, godownId, quantity, referenceNo, remarks, operatorName } = req.body;
          const qty = Number(quantity);
          if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });
          if (!godownId || typeof godownId !== 'string') return res.status(400).json({ error: 'Valid godownId is required' });
          if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

          const db = firestore();
          const uid = req.user.uid;
          const code = barcode.trim();

          const result = await db.runTransaction(async (transaction) => {
              let productId = code;
              let productData = null;
              const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
              const indexSnap = await transaction.get(indexRef);
              if (indexSnap.exists) {
                  productId = indexSnap.data().productId;
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              } else {
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              }

              if (!productData) throw new Error(`Product not found for barcode ${code}`);

              const godownRef = db.collection('users').doc(uid).collection('godowns').doc(godownId);
              const godownSnap = await transaction.get(godownRef);
              if (!godownSnap.exists) throw new Error(`Godown not found: ${godownId}`);
              const godownName = godownSnap.data().name || 'Godown';

              const stockId = `${code}_${godownId}`;
              const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
              const stockSnap = await transaction.get(stockRef);
              const currentStock = stockSnap.exists ? (stockSnap.data().quantity || 0) : 0;

              if (currentStock < qty) {
                  const err = new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${qty}`);
                  err.code = 'INSUFFICIENT_STOCK';
                  err.available = currentStock;
                  err.requested = qty;
                  throw err;
              }

              const newQuantity = currentStock - qty;
              const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

              transaction.set(stockRef, {
                  productBarcode: code,
                  productId,
                  productName: productData.name || '',
                  godownId,
                  godownName,
                  quantity: newQuantity,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              transaction.set(movRef, {
                  productBarcode: code,
                  productName: productData.name || '',
                  godownId,
                  godownName,
                  quantity: -qty,
                  type: 'OUT',
                  referenceNo: referenceNo || '',
                  remarks: remarks || '',
                  userId: uid,
                  userEmail: req.user.email || '',
                  operatorName: operatorName || '',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              return { newQuantity, movementId: movRef.id, productName: productData.name, godownName };
          });

          res.json({ success: true, data: result });
      } catch (error) {
          console.error('Stock out error:', error);
          res.status(400).json({ error: error.message, code: error.code, available: error.available, requested: error.requested });
      }
  });

  // 4. Stock Transfer (runTransaction across source & dest godowns with transferGroupId)
  router.post('/warehouse/stock/transfer', authenticateRequest, async (req, res) => {
      try {
          const { barcode, fromGodownId, toGodownId, quantity, remarks, operatorName } = req.body;
          const qty = Number(quantity);
          if (!barcode) return res.status(400).json({ error: 'Valid barcode is required' });
          if (!fromGodownId || !toGodownId) return res.status(400).json({ error: 'fromGodownId and toGodownId are required' });
          if (fromGodownId === toGodownId) return res.status(400).json({ error: 'Source and destination godowns must be different' });
          if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

          const db = firestore();
          const uid = req.user.uid;
          const code = barcode.trim();

          const result = await db.runTransaction(async (transaction) => {
              let productId = code;
              let productData = null;
              const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
              const indexSnap = await transaction.get(indexRef);
              if (indexSnap.exists) {
                  productId = indexSnap.data().productId;
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              } else {
                  const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                  const prodSnap = await transaction.get(prodRef);
                  if (prodSnap.exists) productData = prodSnap.data();
              }

              if (!productData) throw new Error(`Product not found for barcode ${code}`);

              const srcGRef = db.collection('users').doc(uid).collection('godowns').doc(fromGodownId);
              const dstGRef = db.collection('users').doc(uid).collection('godowns').doc(toGodownId);
              const [srcGSnap, dstGSnap] = await Promise.all([transaction.get(srcGRef), transaction.get(dstGRef)]);
              if (!srcGSnap.exists) throw new Error(`Source godown not found: ${fromGodownId}`);
              if (!dstGSnap.exists) throw new Error(`Destination godown not found: ${toGodownId}`);

              const srcStockId = `${code}_${fromGodownId}`;
              const dstStockId = `${code}_${toGodownId}`;
              const srcStockRef = db.collection('users').doc(uid).collection('stock').doc(srcStockId);
              const dstStockRef = db.collection('users').doc(uid).collection('stock').doc(dstStockId);

              const [srcStockSnap, dstStockSnap] = await Promise.all([transaction.get(srcStockRef), transaction.get(dstStockRef)]);
              const srcCurrent = srcStockSnap.exists ? (srcStockSnap.data().quantity || 0) : 0;
              const dstCurrent = dstStockSnap.exists ? (dstStockSnap.data().quantity || 0) : 0;

              if (srcCurrent < qty) {
                  const err = new Error(`Insufficient stock in ${srcGSnap.data().name}. Available: ${srcCurrent}, Requested: ${qty}`);
                  err.code = 'INSUFFICIENT_STOCK';
                  err.available = srcCurrent;
                  err.requested = qty;
                  throw err;
              }

              const srcNewQty = srcCurrent - qty;
              const dstNewQty = dstCurrent + qty;
              const transferGroupId = crypto.randomUUID();

              const movOutRef = db.collection('users').doc(uid).collection('stockMovements').doc();
              const movInRef = db.collection('users').doc(uid).collection('stockMovements').doc();

              transaction.set(srcStockRef, {
                  productBarcode: code,
                  productId,
                  productName: productData.name || '',
                  godownId: fromGodownId,
                  godownName: srcGSnap.data().name,
                  quantity: srcNewQty,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              transaction.set(dstStockRef, {
                  productBarcode: code,
                  productId,
                  productName: productData.name || '',
                  godownId: toGodownId,
                  godownName: dstGSnap.data().name,
                  quantity: dstNewQty,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              transaction.set(movOutRef, {
                  productBarcode: code,
                  productName: productData.name || '',
                  godownId: fromGodownId,
                  godownName: srcGSnap.data().name,
                  linkedGodownId: toGodownId,
                  linkedGodownName: dstGSnap.data().name,
                  quantity: -qty,
                  type: 'TRANSFER_OUT',
                  transferGroupId,
                  remarks: remarks || '',
                  userId: uid,
                  userEmail: req.user.email || '',
                  operatorName: operatorName || '',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              transaction.set(movInRef, {
                  productBarcode: code,
                  productName: productData.name || '',
                  godownId: toGodownId,
                  godownName: dstGSnap.data().name,
                  linkedGodownId: fromGodownId,
                  linkedGodownName: srcGSnap.data().name,
                  quantity: qty,
                  type: 'TRANSFER_IN',
                  transferGroupId,
                  remarks: remarks || '',
                  userId: uid,
                  userEmail: req.user.email || '',
                  operatorName: operatorName || '',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              return { transferGroupId, sourceQty: srcNewQty, destQty: dstNewQty };
          });

          res.json({ success: true, data: result });
      } catch (error) {
          console.error('Transfer error:', error);
          res.status(400).json({ error: error.message, code: error.code, available: error.available, requested: error.requested });
      }
  });

  // 5. Product Creation with Barcode (runTransaction: barcodeIndex + product doc + opening stock + initial IN movement all in one commit)
  router.post('/warehouse/products', authenticateRequest, async (req, res) => {
      try {
          const {
              barcode, name, sku = '', category = '', brand = '', unit = 'Piece',
              purchasePrice = '', price = '0', minStockLevel = '0', imageUrl = '',
              initialQuantity = 1, godownId = 'mainGodown', hsn = '', description = '', operatorName = ''
          } = req.body;

          const code = String(barcode || '').trim();
          const prodName = String(name || '').trim();
          const targetGodownId = String(godownId || 'mainGodown').trim();

          if (!code) return res.status(400).json({ error: 'Barcode is required' });
          if (!prodName) return res.status(400).json({ error: 'Product name is required' });

          const initQty = Number(initialQuantity) || 0;
          if (initQty < 0) return res.status(400).json({ error: 'Initial quantity cannot be negative' });

          const db = firestore();
          const uid = req.user.uid;

          const result = await db.runTransaction(async (transaction) => {
              const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
              const indexSnap = await transaction.get(indexRef);
              if (indexSnap.exists) {
                  throw new Error(`This barcode (${code}) is already registered to another product.`);
              }

              const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
              const prodSnap = await transaction.get(prodRef);
              if (prodSnap.exists) {
                  throw new Error(`Product with barcode (${code}) already exists.`);
              }

              let godownName = 'Main Godown';
              if (targetGodownId) {
                  try {
                      const gSnap = await transaction.get(db.collection('users').doc(uid).collection('godowns').doc(targetGodownId));
                      if (gSnap.exists) godownName = gSnap.data().name || 'Main Godown';
                  } catch (_) {}
              }

              const ts = admin.firestore.FieldValue.serverTimestamp();
              const productData = {
                  name: name.trim(),
                  barcode: code,
                  sku: (sku || '').trim(),
                  category: (category || '').trim(),
                  brand: (brand || '').trim(),
                  unit: unit || 'Piece',
                  purchasePrice: purchasePrice || '',
                  price: price || '0',
                  minStockLevel: minStockLevel || '0',
                  imageUrl: imageUrl || '',
                  hsn: hsn || '',
                  description: description || '',
                  createdAt: ts,
                  updatedAt: ts,
              };

              // 1. Write barcodeIndex
              transaction.set(indexRef, {
                  productId: code,
                  productCollectionPath: `users/${uid}/products`,
                  createdAt: ts,
              });

              // 2. Write product doc
              transaction.set(prodRef, productData);

              // 3. Write opening stock and initial IN movement if initQty > 0
              if (initQty > 0 && godownId) {
                  const stockId = `${code}_${godownId}`;
                  const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
                  const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

                  transaction.set(stockRef, {
                      productBarcode: code,
                      productId: code,
                      productName: productData.name,
                      godownId,
                      godownName,
                      quantity: initQty,
                      updatedAt: ts,
                  }, { merge: true });

                  transaction.set(movRef, {
                      productBarcode: code,
                      productName: productData.name,
                      godownId,
                      godownName,
                      quantity: initQty,
                      type: 'IN',
                      referenceNo: '',
                      remarks: 'Initial scan / opening stock',
                      userId: uid,
                      userEmail: req.user.email || '',
                      operatorName: operatorName || '',
                      createdAt: ts,
                  });
              }

              return { id: code, ...productData, initialQuantity: initQty };
          });

          res.json({ success: true, data: result });
      } catch (error) {
          console.error('Create product error:', error);
          res.status(400).json({ error: error.message });
      }
  });

  // 6. Assign Barcode to Legacy Product (runTransaction: barcodeIndex + update product + stock init + initial IN movement)
  router.post('/warehouse/products/assign-barcode', authenticateRequest, async (req, res) => {
      try {
          const { productId, barcode, initialQuantity = 0, godownId, operatorName = '' } = req.body;
          if (!productId) return res.status(400).json({ error: 'productId is required' });
          if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });

          const initQty = Number(initialQuantity) || 0;
          const db = firestore();
          const uid = req.user.uid;
          const code = barcode.trim();

          const result = await db.runTransaction(async (transaction) => {
              const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
              const indexSnap = await transaction.get(indexRef);
              if (indexSnap.exists) {
                  throw new Error(`This barcode (${code}) is already assigned to product ${indexSnap.data().productId}`);
              }

              const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
              const prodSnap = await transaction.get(prodRef);
              if (!prodSnap.exists) throw new Error(`Product not found: ${productId}`);
              const product = prodSnap.data();

              let godownName = '';
              if (godownId) {
                  const gSnap = await transaction.get(db.collection('users').doc(uid).collection('godowns').doc(godownId));
                  if (gSnap.exists) godownName = gSnap.data().name || 'Godown';
              }

              const ts = admin.firestore.FieldValue.serverTimestamp();

              // 1. Write barcodeIndex
              transaction.set(indexRef, {
                  productId,
                  productCollectionPath: `users/${uid}/products`,
                  createdAt: ts,
              });

              // 2. Update product barcode
              transaction.update(prodRef, {
                  barcode: code,
                  updatedAt: ts,
              });

              // 3. Init stock if requested
              if (initQty > 0 && godownId) {
                  const stockId = `${code}_${godownId}`;
                  const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
                  const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

                  transaction.set(stockRef, {
                      productBarcode: code,
                      productId,
                      productName: product.name || '',
                      godownId,
                      godownName,
                      quantity: initQty,
                      updatedAt: ts,
                  }, { merge: true });

                  transaction.set(movRef, {
                      productBarcode: code,
                      productName: product.name || '',
                      godownId,
                      godownName,
                      quantity: initQty,
                      type: 'IN',
                      referenceNo: '',
                      remarks: 'Barcode assignment / opening stock',
                      userId: uid,
                      userEmail: req.user.email || '',
                      operatorName: operatorName || '',
                      createdAt: ts,
                  });
              }

              return { productId, barcode: code, initialQuantity: initQty };
          });

          res.json({ success: true, data: result });
      } catch (error) {
          console.error('Assign barcode error:', error);
          res.status(400).json({ error: error.message });
      }
  });

  // 7. Warehouse Dashboard KPIs
  router.get('/warehouse/dashboard', authenticateRequest, async (req, res) => {
      try {
          const db = firestore();
          const uid = req.user.uid;

          const [prodSnap, stockSnap, godownSnap, movSnap] = await Promise.all([
              db.collection('users').doc(uid).collection('products').get(),
              db.collection('users').doc(uid).collection('stock').get(),
              db.collection('users').doc(uid).collection('godowns').get(),
              db.collection('users').doc(uid).collection('stockMovements').orderBy('createdAt', 'desc').limit(20).get(),
          ]);

          const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const stockItems = stockSnap.docs.map(d => d.data());

          const totalStock = stockItems.reduce((acc, s) => acc + (s.quantity || 0), 0);

          // Sum quantity across all godowns per product
          const perProductStock = {};
          for (const s of stockItems) {
              const key = s.productBarcode || s.productId;
              perProductStock[key] = (perProductStock[key] || 0) + (s.quantity || 0);
          }

          let lowStock = 0;
          let outOfStock = 0;
          for (const p of products) {
              const total = perProductStock[p.barcode || p.id] || 0;
              const min = Number(p.minStockLevel || 0);
              if (total === 0) outOfStock++;
              else if (min > 0 && total <= min) lowStock++;
          }

          // Today's IN / OUT movements
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let todayIn = 0;
          let todayOut = 0;

          const movements = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          for (const m of movements) {
              const mDate = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt || 0);
              if (mDate >= today) {
                  if (m.type === 'IN' || m.type === 'TRANSFER_IN') todayIn += Math.abs(m.quantity || 0);
                  if (m.type === 'OUT' || m.type === 'TRANSFER_OUT') todayOut += Math.abs(m.quantity || 0);
              }
          }

          res.json({
              success: true,
              data: {
                  totalProducts: products.length,
                  totalStock,
                  lowStock,
                  outOfStock,
                  todayIn,
                  todayOut,
                  godownsCount: godownSnap.size,
                  recentMovements: movements.slice(0, 10),
              }
          });
      } catch (error) {
          console.error('Dashboard error:', error);
          res.status(500).json({ error: error.message });
      }
  });

  // 8. Movements Ledger with Cursor-based pagination & operatorName filter
  router.get('/warehouse/movements', authenticateRequest, async (req, res) => {
      try {
          const { cursor, limit = 50, productBarcode, godownId, type, operatorName, dateFrom, dateTo } = req.query;
          const db = firestore();
          const uid = req.user.uid;
          const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

          let q = db.collection('users').doc(uid).collection('stockMovements');

          if (godownId) q = q.where('godownId', '==', godownId);
          if (type && type !== 'ALL') q = q.where('type', '==', type);
          if (productBarcode) q = q.where('productBarcode', '==', productBarcode);
          if (operatorName) q = q.where('operatorName', '==', operatorName);

          q = q.orderBy('createdAt', 'desc');

          if (cursor) {
              const cursorDoc = await db.collection('users').doc(uid).collection('stockMovements').doc(cursor).get();
              if (cursorDoc.exists) {
                  q = q.startAfter(cursorDoc);
              }
          }

          q = q.limit(pageSize + 1);

          const snap = await q.get();
          const hasMore = snap.docs.length > pageSize;
          const docs = snap.docs.slice(0, pageSize);
          const movements = docs.map(d => ({ id: d.id, ...d.data() }));
          const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

          res.json({
              success: true,
              data: {
                  movements,
                  nextCursor,
                  hasMore,
              }
          });
      } catch (error) {
          console.error('Movements error:', error);
          res.status(500).json({ error: error.message });
      }
  });

  // 9. Stock Report Endpoint
  router.get('/warehouse/stock/report', authenticateRequest, async (req, res) => {
      try {
          const { groupBy = 'product', format = 'json' } = req.query;
          const db = firestore();
          const uid = req.user.uid;

          const [prodSnap, stockSnap, godownSnap] = await Promise.all([
              db.collection('users').doc(uid).collection('products').get(),
              db.collection('users').doc(uid).collection('stock').get(),
              db.collection('users').doc(uid).collection('godowns').get(),
          ]);

          const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const stockItems = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const godowns = godownSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          const productMap = Object.fromEntries(products.map(p => [p.barcode || p.id, p]));
          const godownMap = Object.fromEntries(godowns.map(g => [g.id, g]));

          if (groupBy === 'godown') {
              const grouped = {};
              for (const g of godowns) {
                  grouped[g.id] = { godown: g, items: [], totalQuantity: 0 };
              }
              for (const s of stockItems) {
                  if (grouped[s.godownId]) {
                      const prod = productMap[s.productBarcode || s.productId] || {};
                      grouped[s.godownId].items.push({
                          ...s,
                          productName: s.productName || prod.name || 'Unknown',
                          category: prod.category || '',
                          brand: prod.brand || '',
                      });
                      grouped[s.godownId].totalQuantity += s.quantity || 0;
                  }
              }
              return res.json({ success: true, data: Object.values(grouped) });
          }

          // Default: group by product
          const grouped = {};
          for (const p of products) {
              const key = p.barcode || p.id;
              grouped[key] = {
                  product: p,
                  totalStock: 0,
                  godownStock: {},
              };
          }
          for (const s of stockItems) {
              const key = s.productBarcode || s.productId;
              if (grouped[key]) {
                  grouped[key].totalStock += s.quantity || 0;
                  grouped[key].godownStock[s.godownId] = s.quantity || 0;
              }
          }

          res.json({ success: true, data: Object.values(grouped) });
      } catch (error) {
          console.error('Stock report error:', error);
          res.status(500).json({ error: error.message });
      }
  });

  // 10. Godowns CRUD
  router.get('/warehouse/godowns', authenticateRequest, async (req, res) => {
      try {
          const db = firestore();
          const uid = req.user.uid;
          const snap = await db.collection('users').doc(uid).collection('godowns').get();

          if (snap.empty) {
              // Auto-seed Main Godown
              const mainRef = db.collection('users').doc(uid).collection('godowns').doc('mainGodown');
              const data = {
                  name: 'Main Godown',
                  notes: 'Default warehouse godown — auto-created',
                  address: '',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              await mainRef.set(data);
              return res.json({ success: true, data: [{ id: 'mainGodown', ...data }] });
          }

          const godowns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          res.json({ success: true, data: godowns });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  router.post('/warehouse/godowns', authenticateRequest, async (req, res) => {
      try {
          const { name, address = '', notes = '' } = req.body;
          if (!name || !name.trim()) return res.status(400).json({ error: 'Godown name is required' });

          const db = firestore();
          const uid = req.user.uid;
          const ts = admin.firestore.FieldValue.serverTimestamp();
          const ref = await db.collection('users').doc(uid).collection('godowns').add({
              name: name.trim(),
              address: address.trim(),
              notes: notes.trim(),
              createdAt: ts,
              updatedAt: ts,
          });

          res.json({ success: true, data: { id: ref.id, name: name.trim(), address: address.trim(), notes: notes.trim() } });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  router.put('/warehouse/godowns/:id', authenticateRequest, async (req, res) => {
      try {
          const { id } = req.params;
          const { name, address, notes } = req.body;
          const db = firestore();
          const uid = req.user.uid;

          const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
          if (name !== undefined) updateData.name = name.trim();
          if (address !== undefined) updateData.address = address.trim();
          if (notes !== undefined) updateData.notes = notes.trim();

          await db.collection('users').doc(uid).collection('godowns').doc(id).update(updateData);
          res.json({ success: true, data: { id, ...updateData } });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  router.delete('/warehouse/godowns/:id', authenticateRequest, async (req, res) => {
      try {
          const { id } = req.params;
          const db = firestore();
          const uid = req.user.uid;

          // Block delete if godown has any stock > 0
          const stockSnap = await db.collection('users').doc(uid).collection('stock').where('godownId', '==', id).get();
          const hasStock = stockSnap.docs.some(d => (d.data().quantity || 0) > 0);
          if (hasStock) {
              return res.status(400).json({ error: 'Cannot delete godown with non-zero stock. Transfer or clear all stock first.' });
          }

          await db.collection('users').doc(uid).collection('godowns').doc(id).delete();
          res.json({ success: true, message: 'Godown deleted successfully' });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  // 11. Staff CRUD (for operator picker)
  router.get('/warehouse/staff', authenticateRequest, async (req, res) => {
      try {
          const db = firestore();
          const uid = req.user.uid;
          const snap = await db.collection('users').doc(uid).collection('staff').get();
          const staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          res.json({ success: true, data: staff });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  router.post('/warehouse/staff', authenticateRequest, async (req, res) => {
      try {
          const { name } = req.body;
          if (!name || !name.trim()) return res.status(400).json({ error: 'Staff name is required' });

          const db = firestore();
          const uid = req.user.uid;
          const ref = await db.collection('users').doc(uid).collection('staff').add({
              name: name.trim(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          res.json({ success: true, data: { id: ref.id, name: name.trim() } });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Warehouse: Link admin UID to warehouse user
  // Called once by the ADMIN user (with their token) to write their UID into the
  // warehouse user's Firestore settings/profile so the warehouse can read their products.
  // ────────────────────────────────────────────────────────────────────────────
  router.post('/warehouse/link-admin', authenticateRequest, async (req, res) => {
      try {
          const adminUid = req.user.uid;
          const { warehouseEmail } = req.body;

          if (!warehouseEmail) {
              return res.status(400).json({ error: 'warehouseEmail is required' });
          }

          // Look up the warehouse user by email
          let warehouseUid;
          try {
              const warehouseUser = await admin.auth().getUserByEmail(warehouseEmail.trim().toLowerCase());
              warehouseUid = warehouseUser.uid;
          } catch (lookupErr) {
              return res.status(404).json({ error: `Warehouse user "${warehouseEmail}" not found: ${lookupErr.message}` });
          }

          // Write linkedAdminUid to warehouse user's settings/profile
          const db = firestore();
          await db.doc(`users/${warehouseUid}/settings/profile`).set({
              linkedAdminUid: adminUid,
              linkedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          res.json({
              success: true,
              message: `Warehouse user (${warehouseEmail}) linked to admin UID ${adminUid}`,
              adminUid,
              warehouseUid,
          });
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });

  return router;
}

module.exports = { createWarehouseRouter };
