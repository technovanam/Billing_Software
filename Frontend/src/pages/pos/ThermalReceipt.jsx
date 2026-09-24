import React, { useRef } from "react";
import PropTypes from "prop-types";
import { Printer, CheckCircle2, ArrowLeft } from "lucide-react";

// Generate a clean, fully-filled, continuous 1D Barcode matching retail receipts (like D-Mart)
const Barcode1D = ({ value = "4150090110002" }) => {
  // Realistic high-density Code-128 style bit pattern spanning full width (260px)
  const pattern = [
    2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 2, 1, 1, 2, 3, 1, 2, 1, 1, 2, 2, 3, 1,
    1, 2, 1, 3, 2, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2,
    2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 2, 1, 1, 2, 1, 3, 1, 2, 2,
    1, 3, 2, 1, 1, 2, 1, 2, 3, 1, 2, 1, 1, 3, 2, 2, 1, 1, 2, 3, 1, 2, 1, 1,
    2, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1
  ];

  let currentX = 0;
  const elements = [];

  for (let i = 0; i < pattern.length; i++) {
    const width = pattern[i];
    const isBar = i % 2 === 0;
    if (isBar) {
      elements.push(
        <rect
          key={i}
          x={currentX}
          y="0"
          width={width}
          height={i % 6 === 0 ? 44 : 38}
          fill="black"
        />
      );
    }
    currentX += width;
  }

  const totalWidth = currentX;

  return (
    <div className="flex flex-col items-center justify-center my-2 w-full">
      <svg
        height="44"
        viewBox={`0 0 ${totalWidth} 44`}
        className="w-[260px] max-w-full"
        preserveAspectRatio="none"
      >
        {elements}
      </svg>
      <span className="tabular-nums text-[9.5px] tracking-widest text-black mt-1 font-bold">
        *{value}*
      </span>
    </div>
  );
};

Barcode1D.propTypes = {
  value: PropTypes.string,
};

export default function ThermalReceipt({
  billData,
  companyProfile,
  onClose,
  onSaveInvoice,
  onResetForNextCustomer,
  isSaved,
  saving,
}) {
  const receiptRef = useRef(null);

  const handlePrint = () => {
    window.print();
  };

  const handleNewCustomerAndClose = () => {
    if (onResetForNextCustomer) {
      onResetForNextCustomer();
    } else {
      onClose();
    }
  };

  // Company details extracted from sign-in profile (NO owner personal name below company name)
  const compName = companyProfile?.companyName?.toUpperCase() || "TECHNO VANAM";
  const compLogo = companyProfile?.logoURL || null;
  const gstin = companyProfile?.gstin || "33AMWPB2116Q1ZS";
  const phone = companyProfile?.phone || "+917010777203";
  const address = [
    companyProfile?.address,
    companyProfile?.city,
    companyProfile?.state,
    companyProfile?.pincode ? `- ${companyProfile.pincode}` : "",
  ]
    .filter(Boolean)
    .join(", ") || "241, Thiru Neelakandar Street, Bhavani, Erode, Tamil Nadu - 638301";

  const {
    billNo = "415009011-0002",
    billDate = new Date(),
    cashier = "CSH-001",
    customerName = "",
    customerPhone = "",
    items = [],
    totalItems = 1,
    totalQty = 1,
    subtotal = 1000,
    cgstRate = 2.5,
    sgstRate = 2.5,
    cgstAmount = 25,
    sgstAmount = 25,
    cessAmount = 0,
    roundOff = 0,
    totalAmount = 1050,
    paymentMode = "Cash",
    cashReceived = 1050,
    balancePaid = 0,
    onlinePaymentDetails = null,
  } = billData || {};

  // Format Date and Time
  const dateObj = new Date(billDate);
  const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(
    dateObj.getMonth() + 1
  ).padStart(2, "0")}/${dateObj.getFullYear()}`;
  const formattedTime = dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto bg-slate-950/85 backdrop-blur-xs p-4 sm:p-6 animate-fade-in-up">
      {/* 1. Prominent Top Sticky Toolbar (ALWAYS visible, never hidden) */}
      <div className="print:hidden sticky top-2 z-30 w-full max-w-[420px] mb-4 flex items-center justify-between rounded-lg bg-white p-3 shadow-2xl border border-slate-200">
        <button
          onClick={onResetForNextCustomer ? handleNewCustomerAndClose : onClose}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
          title="Back to POS billing"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {onSaveInvoice && (
            <button
              onClick={!isSaved && !saving ? onSaveInvoice : undefined}
              disabled={isSaved || saving}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                isSaved
                  ? "bg-emerald-600 text-white shadow-sm cursor-default"
                  : saving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isSaved ? "Saved" : saving ? "Saving..." : "Save Bill"}</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. Authentic D-Mart Thermal Receipt Paper */}
      <div
        id="thermal-receipt-printable"
        ref={receiptRef}
        className="receipt-paper w-full max-w-[370px] bg-white text-black p-5 shadow-2xl rounded-sm border border-slate-300 tabular-nums text-[11px] leading-tight select-text mb-8"
      >
        {/* Company Header: Logo & Company Name only (no personal owner name) */}
        <div className="text-center space-y-1 mb-2">
          {compLogo && (
            <div className="flex justify-center mb-1">
              <img
                src={compLogo}
                alt="Logo"
                className="h-10 w-10 object-contain mx-auto"
              />
            </div>
          )}
          <h1 className="text-lg font-bold tracking-wider uppercase leading-tight">
            {compName}
          </h1>
          <p className="text-[9px]">CIN No : L51900MH2000PLC126473</p>
          <p className="text-[9px] font-bold">GSTIN : {gstin}</p>
          <p className="text-[9px]">FSSAI No : 11520048000277</p>
          <div className="my-1 border-t border-dashed border-black pt-0.5">
            <p className="text-[9px] uppercase">{compName} STORE</p>
            <p className="text-[9px] uppercase">{address}</p>
            <p className="text-[9px]">Phone : {phone}</p>
          </div>
        </div>

        {/* TAX INVOICE Header */}
        <div className="border-t border-b border-black py-0.5 text-center my-1.5">
          <span className="font-bold text-xs tracking-widest uppercase">TAX INVOICE</span>
        </div>

        {/* Metadata: Bill No, Bill Dt, Time, Cashier ID, and Customer Info */}
        <div className="text-[9.5px] space-y-0.5 my-1.5">
          <div className="flex justify-between">
            <span>
              <strong className="font-bold">Bill No :</strong> {billNo}
            </span>
            <span>
              <strong className="font-bold">Bill Dt :</strong> {formattedDate}({formattedTime})
            </span>
          </div>
          <div className="flex justify-between">
            <span>
              <strong className="font-bold">Cashier :</strong> {cashier}
            </span>
            {customerPhone && customerPhone !== "-" && (
              <span>
                <strong className="font-bold">Ph :</strong> {customerPhone}
              </span>
            )}
          </div>
          {customerName && customerName !== "Walk-in Counter Customer" && (
            <div className="flex justify-between border-t border-dashed border-slate-300 pt-0.5">
              <span>
                <strong className="font-bold">Customer :</strong> {customerName}
              </span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="border-t border-b border-black my-1 py-1">
          <div className="grid grid-cols-12 text-[9px] font-bold pb-0.5 border-b border-dashed border-black">
            <span className="col-span-3 text-left">HSN</span>
            <span className="col-span-4 text-left">Particulars</span>
            <span className="col-span-1 text-center">Qty/Kg</span>
            <span className="col-span-2 text-right">N/Rate</span>
            <span className="col-span-2 text-right">Value</span>
          </div>

          {/* GST Subhead */}
          <div className="text-[8.5px] italic text-slate-800 mt-1 mb-0.5">
            1) CGST @ {cgstRate.toFixed(2)}%, SGST @ {sgstRate.toFixed(2)}%
          </div>

          {/* Items Rows */}
          <div className="space-y-1 my-1">
            {items.map((item, idx) => {
              const itemRate = Number(item.rate || item.price || 0);
              const itemQty = Number(item.qty || item.quantity || 1);
              const itemTotal = Number(item.amount || item.total || itemRate * itemQty);
              const hsnCode = item.hsn || item.code || "151800";

              return (
                <div key={idx} className="grid grid-cols-12 text-[9.5px] items-start">
                  <span className="col-span-3 text-left truncate">{hsnCode}</span>
                  <span className="col-span-4 text-left uppercase font-bold truncate pr-1">
                    {item.name || item.description || `Item #${idx + 1}`}
                  </span>
                  <span className="col-span-1 text-center">{itemQty}</span>
                  <span className="col-span-2 text-right">{itemRate.toFixed(2)}</span>
                  <span className="col-span-2 text-right font-bold">{itemTotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items Count, Total Qty & Amount Summary */}
        <div className="flex justify-between items-center text-xs font-bold border-b border-black pb-1 my-1">
          <span>
            Items: <span className="font-bold">{totalItems}</span>
          </span>
          <span>
            Qty: <span className="font-bold">{totalQty}</span>
          </span>
          <span className="text-sm">₹ {totalAmount.toFixed(2)}</span>
        </div>

        {/* GST Breakup Section */}
        <div className="my-2 text-[8.5px]">
          <div className="text-center font-bold tracking-tight text-[9px] mb-0.5">
            &lt;------- GST Breakup Details -------&gt; (Amount INR)
          </div>
          <div className="grid grid-cols-6 text-center font-bold border-t border-b border-dashed border-black py-0.5">
            <span>GST IND</span>
            <span>Taxable Amount</span>
            <span>CGST</span>
            <span>SGST</span>
            <span>CESS</span>
            <span>Total Amount</span>
          </div>
          <div className="grid grid-cols-6 text-center py-0.5">
            <span>1</span>
            <span>{subtotal.toFixed(2)}</span>
            <span>{cgstAmount.toFixed(2)}</span>
            <span>{sgstAmount.toFixed(2)}</span>
            <span>{cessAmount > 0 ? cessAmount.toFixed(2) : "...."}</span>
            <span className="font-bold">{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Amount Received from Customer & Balance Paid / Online Mode */}
        <div className="border-t border-dashed border-black pt-1.5 my-1.5 space-y-0.5 text-[9.5px]">
          <div className="text-center font-bold text-[9px]">
            &lt;----- Payment & Settlement Details -----&gt;
          </div>
          {roundOff !== 0 && (
            <div className="flex justify-between px-2 text-[9px]">
              <span>Round Off Amount :</span>
              <span>
                {roundOff > 0 ? "+" : ""}
                ₹ {Number(roundOff).toFixed(2)} /-
              </span>
            </div>
          )}
          <div className="flex justify-between px-2 font-bold">
            <span>Payment Mode :</span>
            <span>{paymentMode === "Online" ? "ONLINE (RAZORPAY)" : "CASH"}</span>
          </div>
          {paymentMode === "Online" ? (
            <>
              <div className="flex justify-between px-2 font-bold">
                <span>Amount Paid :</span>
                <span>₹ {Number(totalAmount).toFixed(2)} /-</span>
              </div>
              {onlinePaymentDetails?.paymentId && (
                <div className="flex justify-between px-2 text-[8.5px] tabular-nums">
                  <span>Txn ID :</span>
                  <span>{onlinePaymentDetails.paymentId}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between px-2 font-bold">
                <span>Cash Received :</span>
                <span>₹ {Number(cashReceived || totalAmount).toFixed(2)} /-</span>
              </div>
              <div className="flex justify-between px-2 font-bold">
                <span>Balance Paid In Cash :</span>
                <span>₹ {Number(balancePaid || 0).toFixed(2)} /-</span>
              </div>
            </>
          )}
        </div>

        {/* Continuous Full-Width 1D Barcode (Filled completely across width) */}
        <div className="flex flex-col items-center justify-center my-3 border-t border-dashed border-black pt-2">
          <Barcode1D value={billNo.replace(/[^0-9]/g, "") || "4150090110002"} />
        </div>

        {/* Bottom Footer: Maintained by Techno Vanam */}
        <div className="border-t border-dashed border-black pt-2 mt-2 text-center">
          <p className="text-[9.5px] font-bold uppercase tracking-wider">
            MAINTAINED BY TECHNO VANAM
          </p>
          <p className="text-[7.5px] text-slate-600 font-sans mt-0.5">
            Thank You • Visit Again
          </p>
        </div>
      </div>

      {/* Embedded CSS for Thermal Print formatting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-printable,
          #thermal-receipt-printable * {
            visibility: visible;
          }
          #thermal-receipt-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 4mm;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            font-size: 10px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}

ThermalReceipt.propTypes = {
  billData: PropTypes.object.isRequired,
  companyProfile: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaveInvoice: PropTypes.func,
  isSaved: PropTypes.bool,
  saving: PropTypes.bool,
};
