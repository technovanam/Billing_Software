const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const gst = require('../../lib/gst');

const seller = { companyName: 'Acme', gstin: '33AMWPB2116Q1ZS', bank: { ifsc: 'HDFC0001234' } };
const items = [
  { hsnCode: '7214', quantity: 10, rate: 100, gstRate: 18 },
  { hsnCode: '1006', quantity: 2, rate: 50, gstRate: 5, discount: 10 },
  { quantity: 3, rate: 33.33, gstRate: 12 },
  { hsnCode: '2202', quantity: 4, rate: 40, gstRate: 28, cessRate: 12 },
];

// Same inputs through the frontend engine must give the same numbers.
test('server and browser GST engines agree', async (t) => {
  const frontendPath = path.resolve(__dirname, '../../../Frontend/src/utils/gst.js');
  let fe;
  try {
    fe = await import(pathToFileURL(frontendPath).href);
  } catch {
    t.skip('Frontend not present next to Backend');
    return;
  }
  for (const isInterState of [false, true]) {
    for (const isRoundOff of [false, true]) {
      const a = gst.computeInvoice({ items, isInterState, isRoundOff, tcsRate: 0.1 });
      const b = fe.computeInvoice({ items, isInterState, isRoundOff, tcsRate: 0.1 });
      for (const k of ['taxableAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'cessAmount', 'tcsAmount', 'totalTax', 'roundOffAmount', 'total']) {
        assert.equal(a[k], b[k], `${k} differs (inter=${isInterState}, roundOff=${isRoundOff})`);
      }
      assert.deepEqual(a.taxBreakup, b.taxBreakup);
      assert.deepEqual(a.hsnSummary, b.hsnSummary);
    }
  }
  assert.deepEqual(gst.placeOfSupply(seller, { gstin: '29ABCDE1234F1Z5' }), fe.placeOfSupply(seller, { gstin: '29ABCDE1234F1Z5' }));
});

test('next invoice number continues the financial-year series', () => {
  const list = [{ invoiceNumber: '007/2026-27' }, { invoiceNumber: '099/2025-26' }];
  assert.equal(gst.nextInvoiceNumber(list, new Date(2026, 9, 7)), '008/2026-27');
  assert.equal(gst.nextInvoiceNumber([], new Date(2027, 3, 1)), '001/2027-28');
});

test('recurring profile -> GST invoice with customer, place of supply and seller', () => {
  const profile = {
    customerId: 'c1',
    gstVersion: 2,
    isGstEnabled: true,
    isRoundOff: true,
    discount: 10,
    items: [{ description: 'AMC', hsnCode: '998314', quantity: 1, rate: 5000, gstRate: 18 }],
    customerNotes: 'Thanks',
  };
  const customer = { id: 'c1', name: 'Bengaluru Co', gstin: '29ABCDE1234F1Z5' };
  const inv = gst.invoiceFromRecurringProfile({ profile, customer, sellerProfile: seller, invoiceNumber: '008/2026-27', runDate: '2026-10-07' });
  assert.equal(inv.invoiceNumber, '008/2026-27');
  assert.equal(inv.client.name, 'Bengaluru Co');
  assert.equal(inv.isInterState, true);
  assert.equal(inv.placeOfSupply.code, '29');
  assert.equal(inv.taxableAmount, 4500); // 10% profile discount on every line
  assert.equal(inv.igstAmount, 810);
  assert.equal(inv.amount, 5310);
  assert.equal(inv.seller.companyName, 'Acme');
  assert.equal(inv.gstVersion, 2);
});

test('older single-rate recurring profiles keep their CGST+SGST', () => {
  const profile = { customerId: 'c1', cgst: 9, sgst: 9, igst: 0, isRoundOff: false, items: [{ quantity: 2, rate: 500 }] };
  const inv = gst.invoiceFromRecurringProfile({ profile, customer: { id: 'c1', name: 'X', gstin: '29ABCDE1234F1Z5' }, sellerProfile: seller, invoiceNumber: '1', runDate: '2026-10-07' });
  assert.equal(inv.isInterState, false);
  assert.equal(inv.cgstAmount, 90);
  assert.equal(inv.amount, 1180);
});
