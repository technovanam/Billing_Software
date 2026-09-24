/**
 * seedDemoUser.js
 * Seeds warehouse demo user using Firebase REST APIs only.
 * NO serviceAccountKey.json required.
 * Usage: node seedDemoUser.js
 */
require('dotenv').config();
const https = require('https');

const API_KEY    = process.env.VITE_FIREBASE_API_KEY  || 'AIzaSyCPBe8NvcAKWW9vvCvcdiWtmyQ2e0zkyiw';
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'billing-software-19d79';
const DEMO_EMAIL    = 'warehouse@demo.com';
const DEMO_PASSWORD = 'Warehouse@123';

function httpsPost(hostname, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers['Authorization'] = Bearer +token;
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}
function httpsReq(method, hostname, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = Bearer +token;
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const FS_HOST = 'firestore.googleapis.com';
const FS_BASE = /v1/projects/+PROJECT_ID+/databases/(default)/documents;
function toValue(v) {
  if (typeof v === 'string')  return { stringValue: v };
  if (typeof v === 'number')  return v % 1 === 0 ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null)             return { nullValue: null };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object')  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,val]) => [k, toValue(val)])) } };
  return { stringValue: String(v) };
}
function toFields(obj) { return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, toValue(v)])); }
async function setDoc(token, col, docId, obj) {
  const r = await httpsReq('PATCH', FS_HOST, FS_BASE+'/'+col+'/'+docId, { fields: toFields(obj) }, token);
  if (r.status >= 400) console.warn(  Warning setDoc / -> );
  return r;
}
async function addDoc(token, col, obj) {
  const r = await httpsPost(FS_HOST, FS_BASE+'/'+col, { fields: toFields(obj) }, token);
  if (r.status >= 400) console.warn(  Warning addDoc  -> );
  return r;
}

const PRODUCTS = [
  { barcode: '8901234567890', name: 'Aashirvaad Atta 5kg',       brand: 'Aashirvaad', category: 'Flour & Grains',    hsn: '1101', unit: 'Bag',   price: '275', purchasePrice: '240', minStockLevel: '10', initialStock: 50 },
  { barcode: '8906007452001', name: 'Parle-G Biscuits 800g',     brand: 'Parle',      category: 'Biscuits & Snacks', hsn: '1905', unit: 'Pack',  price: '45',  purchasePrice: '38',  minStockLevel: '20', initialStock: 120 },
  { barcode: '8901030869166', name: 'Surf Excel Easy Wash 1kg',  brand: 'Surf Excel', category: 'Detergents',        hsn: '3402', unit: 'Pack',  price: '110', purchasePrice: '95',  minStockLevel: '15', initialStock: 75 },
  { barcode: '8904187400018', name: 'Dairy Milk Silk 60g',       brand: 'Cadbury',    category: 'Chocolates',        hsn: '1806', unit: 'Piece', price: '99',  purchasePrice: '82',  minStockLevel: '30', initialStock: 8 },
  { barcode: '4902430723770', name: 'Colgate Strong Teeth 200g', brand: 'Colgate',    category: 'Oral Care',         hsn: '3306', unit: 'Tube',  price: '78',  purchasePrice: '65',  minStockLevel: '25', initialStock: 0 },
];

async function seed() {
  console.log('\n Warehouse Demo User Seed');
  console.log('-'.repeat(50));
  let idToken, uid;
  const su = await httpsPost('identitytoolkit.googleapis.com', /v1/accounts:signUp?key=+API_KEY, { email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true });
  if (su.status === 200 && su.body.idToken) {
    idToken = su.body.idToken; uid = su.body.localId;
    console.log('Created user: ' + DEMO_EMAIL + ' uid=' + uid);
  } else if (su.body?.error?.message === 'EMAIL_EXISTS') {
    console.log('User exists, signing in...');
    const si = await httpsPost('identitytoolkit.googleapis.com', /v1/accounts:signInWithPassword?key=+API_KEY, { email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true });
    if (si.status !== 200) { console.error('Sign-in failed:', si.body); process.exit(1); }
    idToken = si.body.idToken; uid = si.body.localId;
    console.log('Signed in: ' + DEMO_EMAIL + ' uid=' + uid);
  } else { console.error('Auth failed:', su.body); process.exit(1); }

  const b = (c) => 'users/'+uid+'/'+c;
  await setDoc(idToken, b('godowns'), 'mainGodown', { name: 'Main Godown', notes: 'Default warehouse godown', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  console.log('Godown created: Main Godown');

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i]; const pid = 'demo_product_'+(i+1); const sid = pid+'_mainGodown';
    await setDoc(idToken, b('products'), pid, { serialNumber: String(i+1).padStart(2,'0'), name: p.name, barcode: p.barcode, brand: p.brand, category: p.category, hsn: p.hsn, unit: p.unit, price: p.price, purchasePrice: p.purchasePrice, minStockLevel: p.minStockLevel, description: '', sku: '', imageUrl: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await setDoc(idToken, b('barcodeIndex'), p.barcode, { productId: pid, createdAt: new Date().toISOString() });
    await setDoc(idToken, b('stock'), sid, { productId: pid, barcode: p.barcode, productName: p.name, godownId: 'mainGodown', godownName: 'Main Godown', quantity: p.initialStock, updatedAt: new Date().toISOString() });
    if (p.initialStock > 0) await addDoc(idToken, b('stockMovements'), { productId: pid, barcode: p.barcode, productName: p.name, godownId: 'mainGodown', godownName: 'Main Godown', quantity: p.initialStock, type: 'IN', userId: uid, userEmail: DEMO_EMAIL, operatorName: 'System', referenceNo: 'SEED-001', remarks: 'Opening stock', createdAt: new Date().toISOString() });
    console.log('['+( i+1)+'] '+p.name+' barcode:'+p.barcode+' qty:'+p.initialStock);
  }
  console.log('\nSeed complete!');
  console.log('  Email   : ' + DEMO_EMAIL);
  console.log('  Password: ' + DEMO_PASSWORD);
  console.log('  URL: http://localhost:5173/signin\n');
  process.exit(0);
}
seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
