// Splits a command into tokens, keeping the original spelling for product and
// customer names. Numbers glued to units ("10kg", "500g", "1.5l") are split.
const TAMIL_SUFFIX = 'க்கு';

function splitGlued(word) {
  const glued = word.match(/^(\d+(?:\.\d+)?)([a-z]+|%)$/i);
  if (glued) return [glued[1], glued[2]];
  const pct = word.match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) return [pct[1], '%'];
  // Particles glued with a hyphen: "Traders-ku", "Kumar-ki".
  const hyphen = word.match(/^(.+)-(ku|kku|ki|ko|kaga)$/i);
  if (hyphen) return [hyphen[1], hyphen[2]];
  // Tamil dative suffix glued to the name: "ரவிக்கு".
  if (word.length > TAMIL_SUFFIX.length && word.endsWith(TAMIL_SUFFIX)) return [word.slice(0, -TAMIL_SUFFIX.length), TAMIL_SUFFIX];
  return [word];
}

function tokenize(text) {
  const cleaned = String(text || '')
    .normalize('NFC')
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    .replace(/’/g, "'")
    .replace(/([,;])/g, ' $1 ')
    .replace(/(\d),(\d{3})\b/g, '$1$2');

  const tokens = [];
  for (const piece of cleaned.split(/\s+/)) {
    if (!piece) continue;
    if (piece === ',' || piece === ';') {
      tokens.push({ text: piece, raw: piece });
      continue;
    }
    // Drop punctuation at the edges, keep inner hyphens/dots/slashes ("Parle-G", "1.5", "1/2").
    const word = piece.replace(/^[^\p{L}\p{N}₹%&]+|[^\p{L}\p{N}%\p{M}]+$/gu, '').replace(/'/g, '');
    if (!word) continue;
    for (const part of splitGlued(word)) {
      tokens.push({ text: part.toLowerCase(), raw: part });
    }
  }
  return tokens;
}

module.exports = { tokenize };
