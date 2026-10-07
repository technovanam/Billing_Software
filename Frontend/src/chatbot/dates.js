// Date handling for the chatbot. Invoices store dates as "YYYY-MM-DD" strings,
// payments as "DD/MM/YYYY", expenses as Firestore Timestamps or Dates, so every
// value goes through toDate(). All periods use the browser's local time (IST).
import { normalize } from "./text.js";

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const formatDate = (d) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

// Financial year (April to March) containing `d`.
export function financialYear(d) {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { start: new Date(startYear, 3, 1), end: new Date(startYear + 1, 3, 1), label: `FY ${startYear}-${String(startYear + 1).slice(2)}` };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ALIASES = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/**
 * Reads a time period from the text. Returns { start, end, label } with `end`
 * exclusive, or null when the text names no period.
 */
export function parsePeriod(text, now = new Date()) {
  const q = ` ${normalize(text)} `;
  const today = startOfDay(now);
  const span = (start, end, label) => ({ start, end, label });

  if (/ (today|todays|iniku|innaiku|aaj) /.test(q)) return span(today, addDays(today, 1), "today");
  if (/ (yesterday|yesterdays|nethu|netru|kal) /.test(q)) return span(addDays(today, -1), today, "yesterday");

  let m = q.match(/ (?:last|past|previous) (\d+) days? /);
  if (m) return span(addDays(today, -(Number(m[1]) - 1)), addDays(today, 1), `the last ${m[1]} days`);

  const weekStart = addDays(today, -((today.getDay() + 6) % 7)); // Monday
  if (/ this week /.test(q)) return span(weekStart, addDays(weekStart, 7), "this week");
  if (/ (last|previous) week /.test(q)) return span(addDays(weekStart, -7), weekStart, "last week");

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (/ this month /.test(q)) return span(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1), "this month");
  if (/ (last|previous) month /.test(q)) return span(new Date(now.getFullYear(), now.getMonth() - 1, 1), monthStart, "last month");

  const fy = financialYear(now);
  if (/ (this|current) (fy|financial year) | this year /.test(q)) return span(fy.start, fy.end, `this financial year (${fy.label})`);
  if (/ (last|previous) (fy|financial year) | last year /.test(q)) {
    const prev = financialYear(new Date(fy.start.getFullYear() - 1, 5, 1));
    return span(prev.start, prev.end, `last financial year (${prev.label})`);
  }

  // "september", "sept 2026", "in oct"
  const words = q.trim().split(" ");
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const idx = MONTHS.indexOf(w) >= 0 ? MONTHS.indexOf(w) : MONTH_ALIASES[w];
    if (idx === undefined || idx < 0) continue;
    if (w === "may" && !/ (in|for|during|of) may /.test(q) && !/^\d{4}$/.test(words[i + 1] || "")) continue; // "may I"
    let year = /^\d{4}$/.test(words[i + 1] || "") ? Number(words[i + 1]) : null;
    if (year === null) {
      // Latest such month that is not in the future.
      year = now.getFullYear();
      if (idx > now.getMonth()) year -= 1;
    }
    return span(new Date(year, idx, 1), new Date(year, idx + 1, 1), `${MONTHS[idx][0].toUpperCase()}${MONTHS[idx].slice(1)} ${year}`);
  }
  return null;
}

export const inPeriod = (date, period) => Boolean(date && (!period || (date >= period.start && date < period.end)));
