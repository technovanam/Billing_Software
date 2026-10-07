// Offline GSTIN check: structure, state code and the official check digit.
// Whether the registration is active can only be confirmed on the GST portal.

export const GST_STATE_CODES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinCheckDigit(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export const GSTIN_PATTERN = /\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i;

export function checkGstin(input) {
  const gstin = String(input || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const problems = [];
  if (gstin.length !== 15) problems.push(`it has ${gstin.length} characters instead of 15`);
  const formatOk = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
  if (gstin.length === 15 && !formatOk) problems.push("the pattern is wrong (expected 2 digits, PAN, entity number, Z, check digit)");
  const stateCode = gstin.slice(0, 2);
  const state = GST_STATE_CODES[stateCode] || null;
  if (gstin.length === 15 && !state) problems.push(`state code ${stateCode} does not exist`);
  const expected = gstin.length === 15 ? gstinCheckDigit(gstin.slice(0, 14)) : null;
  const checksumOk = expected !== null && expected === gstin[14];
  if (formatOk && !checksumOk) problems.push(`the check digit should be ${expected}, not ${gstin[14]} (likely a typo)`);
  return { gstin, valid: problems.length === 0, problems, state, stateCode, pan: gstin.slice(2, 12), entity: gstin[12] || null };
}
