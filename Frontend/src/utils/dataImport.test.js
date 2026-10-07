// Run with: node --test src/utils/dataImport.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTallyMasters, parseCsv, rowsToRecords, dedupe, toPlain, fromPlain, checkBackup, sheetRows, decodeExport } from "./dataImport.js";

const TALLY = `<?xml version="1.0"?>
<ENVELOPE><BODY><IMPORTDATA><REQUESTDATA>
<TALLYMESSAGE><GROUP NAME="Chennai Debtors"><PARENT>Sundry Debtors</PARENT></GROUP></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="Kaveri Traders &amp; Co" RESERVEDNAME="">
  <ADDRESS.LIST TYPE="String"><ADDRESS>12 Anna Salai</ADDRESS><ADDRESS>Chennai</ADDRESS></ADDRESS.LIST>
  <PARENT>Chennai Debtors</PARENT><PARTYGSTIN>33aaaaa1111a1z1</PARTYGSTIN><LEDSTATENAME>Tamil Nadu</LEDSTATENAME>
  <OPENINGBALANCE>-25000.00</OPENINGBALANCE></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="Steel Supplier"><PARENT>Sundry Creditors</PARENT><OPENINGBALANCE>12000.00</OPENINGBALANCE></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="HDFC Bank"><PARENT>Bank Accounts</PARENT><OPENINGBALANCE>-150000</OPENINGBALANCE></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="Capital"><PARENT>Capital Account</PARENT><OPENINGBALANCE>200000</OPENINGBALANCE></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="Sales 18%"><PARENT>Sales Accounts</PARENT></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><STOCKITEM NAME="Steel Rod"><BASEUNITS>Nos</BASEUNITS><OPENINGBALANCE> 10 Nos</OPENINGBALANCE><OPENINGRATE>50.00/Nos</OPENINGRATE>
  <GSTDETAILS.LIST><HSNCODE>7214</HSNCODE><STATEWISEDETAILS.LIST><RATEDETAILS.LIST><GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD><GSTRATE> 18</GSTRATE></RATEDETAILS.LIST></STATEWISEDETAILS.LIST></GSTDETAILS.LIST>
  <STANDARDPRICELIST.LIST><RATE>75.00/Nos</RATE></STANDARDPRICELIST.LIST></STOCKITEM></TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;

test("Tally masters: parties, ledgers with opening balances, stock items", () => {
  const r = parseTallyMasters(TALLY);
  assert.equal(r.customers.length, 1);
  assert.equal(r.customers[0].name, "Kaveri Traders & Co");
  assert.equal(r.customers[0].openingBalance, 25000);
  assert.equal(r.customers[0].gstin, "33AAAAA1111A1Z1");
  assert.equal(r.customers[0].address, "12 Anna Salai, Chennai");
  assert.equal(r.suppliers[0].openingBalance, 12000);
  assert.deepEqual(r.accounts.map((a) => [a.name, a.group, a.openingBalance, a.openingSide]), [["HDFC Bank", "Bank Accounts", 150000, "Dr"], ["Capital", "Capital Account", 200000, "Cr"]]);
  assert.equal(r.skipped[0].name, "Sales 18%");
  assert.deepEqual(r.products[0], { name: "Steel Rod", unit: "Nos", hsn: "7214", price: 75, gstRate: 18, openingStock: 10, openingRate: 50, purchasePrice: 50 });
});

test("UTF-16 Tally export decodes", () => {
  const s = "<LEDGER NAME=\"A\"/>";
  const buf = new Uint8Array(2 + s.length * 2);
  buf[0] = 0xff;
  buf[1] = 0xfe;
  for (let i = 0; i < s.length; i++) buf[2 + i * 2] = s.charCodeAt(i);
  assert.equal(decodeExport(buf.buffer), s);
});

test("Excel/CSV rows map by heading, and duplicates are skipped", () => {
  const rows = parseCsv('Customer Name,GSTIN,Opening Balance,Notes\n"Acme, Inc",29abcde1234f1z5,"1,500"\nKaveri,,0,x\n');
  const { records, unknownColumns } = rowsToRecords(rows, "customers");
  assert.deepEqual(unknownColumns, ["notes"]);
  assert.equal(records[0].name, "Acme, Inc");
  assert.equal(records[0].gstin, "29ABCDE1234F1Z5");
  assert.equal(records[0].openingBalance, 1500);
  const { fresh, duplicates } = dedupe(records, [{ name: "kaveri" }]);
  assert.equal(fresh.length, 1);
  assert.equal(duplicates[0].name, "Kaveri");
  const p = rowsToRecords([["Item", "Rate", "GST %", "HSN"], ["Pump", 1000, 12, 8413]], "products").records[0];
  assert.deepEqual(p, { name: "Pump", price: 1000, gstRate: 12, hsn: "8413" });
  assert.equal(rowsToRecords([["Foo"], ["x"]], "products").missingName, true);
});

test("backup round-trips timestamps", () => {
  const ts = { toDate: () => new Date("2026-04-01T00:00:00.000Z") };
  const plain = toPlain({ a: ts, b: [ts], c: { d: 1 } });
  assert.deepEqual(plain, { a: { __ts: "2026-04-01T00:00:00.000Z" }, b: [{ __ts: "2026-04-01T00:00:00.000Z" }], c: { d: 1 } });
  const back = fromPlain(plain, (d) => ({ ts: d.toISOString() }));
  assert.deepEqual(back.a, { ts: "2026-04-01T00:00:00.000Z" });
  assert.equal(checkBackup({ app: "kanakku-desk", collections: {} }), "");
  assert.notEqual(checkBackup({}), "");
  assert.deepEqual(sheetRows([{ id: "1", at: { __ts: "2026-04-01T00:00:00.000Z" }, items: [1] }]), [["id", "at", "items"], ["1", "2026-04-01", "[1]"]]);
});
