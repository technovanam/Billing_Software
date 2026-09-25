// Word lists for the local parser: English, Tamil, Hindi (Latin and native
// script) and their mixed forms. Keys are lower-case tokens after tokenising.

// Whole numbers. Hindi "do" (2) is handled specially in numbers.js because it
// is also a verb ("kar do", "de do").
const NUMBER_WORDS = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
  // Tamil (Latin)
  onnu: 1, oru: 1, ondru: 1, onru: 1, rendu: 2, randu: 2, irandu: 2, moonu: 3, munu: 3, moondru: 3,
  naalu: 4, nalu: 4, naangu: 4, anju: 5, anji: 5, ainthu: 5, aaru: 6, aru: 6, ezhu: 7, elu: 7,
  ettu: 8, ombodhu: 9, onbadhu: 9, onbathu: 9, ombathu: 9, pathu: 10, padhu: 10, paththu: 10,
  pathinonnu: 11, panirendu: 12, pannendu: 12, pathimoonu: 13, pathinaalu: 14, pathinanju: 15,
  pathinaaru: 16, pathinezhu: 17, pathinettu: 18, pathombodhu: 19, iruvadhu: 20, irubathu: 20,
  irupathu: 20, muppadhu: 30, muppathu: 30, narpadhu: 40, naarpathu: 40, aimbadhu: 50, aimbathu: 50,
  nooru: 100, nuru: 100,
  // Hindi (Latin)
  ek: 1, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, chah: 6, che: 6,
 saat: 7, aath: 8, nau: 9, das: 10, dus: 10, gyarah: 11, barah: 12, baarah: 12,
  terah: 13, chaudah: 14, pandrah: 15, pandra: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19,
  bees: 20, pachees: 25, pachchis: 25, tees: 30, chalis: 40, chaalis: 40, pachaas: 50,
  pachas: 50, sau: 100,
  // Tamil script
  'ஒன்று': 1, 'ஒரு': 1, 'ஒண்ணு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3, 'நான்கு': 4,
  'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
  'இருபது': 20, 'ஐம்பது': 50, 'நூறு': 100,
  // Devanagari
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
  'नौ': 9, 'दस': 10, 'बीस': 20, 'पचास': 50, 'सौ': 100,
};

// Stand-alone fractions and mixed amounts.
const FRACTION_WORDS = {
  half: 0.5, quarter: 0.25, arai: 0.5, kaal: 0.25, mukkaal: 0.75, aadha: 0.5, adha: 0.5, aadhaa: 0.5,
  paav: 0.25, pav: 0.25, pauna: 0.75, 'அரை': 0.5, 'கால்': 0.25, 'முக்கால்': 0.75, 'आधा': 0.5, 'पाव': 0.25,
};

const MIXED_WORDS = {
  dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, adhai: 2.5, adhaai: 2.5, onnarai: 1.5, rendarai: 2.5,
  'डेढ़': 1.5, 'ढाई': 2.5,
};

// Spoken unit -> canonical unit (matches matcher.js normalizeUnit output).
const UNIT_WORDS = {
  bag: 'bag', bags: 'bag', moota: 'bag', mootai: 'bag', moottai: 'bag', mutta: 'bag', bori: 'bag',
  bora: 'bag', sack: 'bag', sacks: 'bag', 'மூட்டை': 'bag', 'बोरी': 'bag', 'बोरा': 'bag',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', 'கிலோ': 'kg', 'किलो': 'kg',
  g: 'gram', gm: 'gram', gms: 'gram', gram: 'gram', grams: 'gram', gramme: 'gram', 'கிராம்': 'gram', 'ग्राम': 'gram',
  l: 'litre', ltr: 'litre', ltrs: 'litre', lit: 'litre', litre: 'litre', litres: 'litre', liter: 'litre',
  liters: 'litre', 'லிட்டர்': 'litre', 'लीटर': 'litre',
  ml: 'ml',
  box: 'box', boxes: 'box', petti: 'box', dabba: 'box', dibba: 'box', carton: 'box', 'பெட்டி': 'box', 'डिब्बा': 'box',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', nos: 'piece', unit: 'piece', units: 'piece',
  dozen: 'dozen', dozens: 'dozen', dz: 'dozen', darjan: 'dozen', darzan: 'dozen', 'டஜன்': 'dozen', 'दर्जन': 'dozen',
  packet: 'packet', packets: 'packet', pkt: 'packet', pkts: 'packet', pack: 'packet', packs: 'packet',
  paketu: 'packet', 'பாக்கெட்': 'packet', 'पैकेट': 'packet',
  bottle: 'bottle', bottles: 'bottle', bottil: 'bottle',
  meter: 'metre', metre: 'metre', meters: 'metre', metres: 'metre', mtr: 'metre',
};
// Single letters are units only when glued to or right after a number ("2l", "500 g").
const SHORT_UNITS = new Set(['g', 'l', 'm']);

// Words that join items in a list.
const SEPARATORS = new Set([',', ';', 'and', 'aur', 'or', 'um', 'then', 'plus', 'also', 'matrum', 'phir', 'n', '&', 'और', 'மற்றும்', 'அப்புறம்']);

// Words that end a customer name when they follow it ("Ravi Traders ku").
const CUSTOMER_SUFFIX = new Set(['ku', 'kku', 'ukku', 'ki', 'ko', 'kaga', 'kaaga', 'kosam', 'को', 'की', 'க்கு']);
// Two-word suffix "ke liye".
const CUSTOMER_SUFFIX_PAIRS = [['ke', 'liye'], ['ka', 'bill'], ['के', 'लिए']];
// Words that start a customer name ("for Selvam Stores").
const CUSTOMER_PREFIX = new Set(['for', 'to']);

const PAYMENT_WORDS = {
  cash: 'cash', nagad: 'cash', naqad: 'cash', rokka: 'cash', 'नकद': 'cash', 'कैश': 'cash', 'கேஷ்': 'cash',
  upi: 'upi', gpay: 'upi', googlepay: 'upi', phonepe: 'upi', paytm: 'upi', bhim: 'upi', qr: 'upi',
  'यूपीआई': 'upi',
  card: 'card', swipe: 'card', debit: 'card',
  bank: 'bank', neft: 'bank', rtgs: 'bank', imps: 'bank', cheque: 'bank', check: 'bank', transfer: 'bank',
};
const PAYMENT_PAIRS = [[['google', 'pay'], 'upi'], [['phone', 'pe'], 'upi'], [['credit', 'card'], 'card'], [['debit', 'card'], 'card'], [['bank', 'transfer'], 'bank']];
// Filler around payment words ("UPI se payment", "cash la", "by card").
const PAYMENT_FILLER = new Set(['payment', 'pay', 'paid', 'se', 'la', 'le', 'by', 'via', 'through', 'mode', 'in', 'mein', 'me', 'il', 'mela', 'panni', 'pannu', 'kar', 'karo', 'se', 'से', 'ல']);

// Credit terms: "15 days credit", "15 naal kadan", "15 din udhaar".
const DAY_WORDS = new Set(['day', 'days', 'naal', 'naatkal', 'din', 'dino', 'dinon', 'நாள்', 'दिन']);
const CREDIT_WORDS = new Set(['credit', 'kadan', 'kadana', 'udhaar', 'udhar', 'udaar', 'baaki', 'baki', 'கடன்', 'उधार']);

// Command verbs.
const REMOVE_WORDS = new Set(['remove', 'delete', 'cancel', 'drop', 'hatao', 'hata', 'nikalo', 'nikal', 'eduthudu', 'eduthudunga', 'edu', 'vendam', 'venam', 'vendaam', 'हटाओ', 'வேண்டாம்']);
const UPDATE_WORDS = new Set(['make', 'change', 'set', 'update', 'modify']);
// Trailing verbs that mean "do it" ("cement 12 bags pannunga", "kar do").
const DO_VERBS = new Set(['pannunga', 'pannu', 'pannidu', 'podunga', 'podu', 'karo', 'kardo', 'karna', 'kariye', 'maathu', 'maathunga', 'badlo']);
const ADD_WORDS = new Set(['add', 'also', 'innum', 'inum', 'extra', 'more', 'aur', 'plus', 'serthu', 'sethu', 'jodo']);
const GIVE_FILLER = new Set(['dena', 'de', 'do', 'dijiye', 'kodu', 'kudunga', 'kodunga', 'thaa', 'thanga', 'venum', 'vendum', 'chahiye', 'please', 'pls', 'give', 'want', 'need', 'bill', 'billing', 'of', 'the', 'more', 'a', 'an', 'some', 'konjam', 'thoda', 'kuch', 'item', 'items', 'mattum', 'only', 'just', 'total', 'sir', 'anna', 'bhai', 'ji', 'venumnga', 'podunga', 'pannunga', 'karo', 'kar', 'கொடு', 'दो']);
const VAGUE_QTY = new Set(['some', 'konjam', 'thoda', 'kuch', 'few']);

const DISCOUNT_WORDS = new Set(['discount', 'off', 'kammi', 'kam', 'concession', 'less', 'chhoot', 'chhut']);
const PERCENT_WORDS = new Set(['percent', 'percentage', '%', 'pc', 'sathavigitham', 'pratishat', 'pratishad']);
const RUPEE_WORDS = new Set(['rs', 'rupees', 'rupee', 'rupay', 'rupaye', 'roopa', 'rubai', 'inr', '₹', 'ரூபாய்', 'रुपये']);

const CUSTOMER_WORDS = new Set(['customer', 'client', 'party', 'name', 'naam', 'peru', 'per', 'is', 'ka', 'ke', 'oda', 'kasatamar', 'ग्राहक']);

// Business questions answered by the AI Assistant, not the command bar.
const QUERY_PATTERNS = [
  /\b(today'?s?|todays|indru|aaj|this month|monthly|weekly|yesterday)\b.*\b(sales|sale|collection|revenue|profit|business|vyapar|vikri)\b/,
  /\b(sales|revenue|profit|collection)\b.*\b(today|month|week|year)\b/,
  /\bwho owes\b|\bpending payments?\b|\bdues?\b.*\b(list|who)\b|\bkitna baaki\b|\byaar kitta baaki\b/,
  /\bhow (much|many)\b.*\b(stock|left|sold|pending)\b|\bstock\b.*\b(left|remaining|evvalavu|kitna)\b/,
  /\btop (selling|products?|customers?)\b|\bbest selling\b|\breport\b/,
];

// Commands that are recognised but belong to a later phase.
const UNSUPPORTED_PATTERNS = [/\bsame as (last|previous)\b/, /\brepeat (last|previous)\b/, /\blast bill\b/, /\bthe usual\b/, /\busual\b/];

module.exports = {
  NUMBER_WORDS,
  FRACTION_WORDS,
  MIXED_WORDS,
  UNIT_WORDS,
  SHORT_UNITS,
  SEPARATORS,
  CUSTOMER_SUFFIX,
  CUSTOMER_SUFFIX_PAIRS,
  CUSTOMER_PREFIX,
  PAYMENT_WORDS,
  PAYMENT_PAIRS,
  PAYMENT_FILLER,
  DAY_WORDS,
  CREDIT_WORDS,
  REMOVE_WORDS,
  UPDATE_WORDS,
  DO_VERBS,
  ADD_WORDS,
  GIVE_FILLER,
  VAGUE_QTY,
  DISCOUNT_WORDS,
  PERCENT_WORDS,
  RUPEE_WORDS,
  CUSTOMER_WORDS,
  QUERY_PATTERNS,
  UNSUPPORTED_PATTERNS,
};
