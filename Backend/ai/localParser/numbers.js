// Merges number expressions into single number tokens:
// "10", "1.5", "1/2", "ten", "pathu", "das", "twenty five", "2 and half",
// "rendu arai", "dedh", "a dozen", and Hindi "do" when it means two.
const { NUMBER_WORDS, FRACTION_WORDS, MIXED_WORDS, UNIT_WORDS } = require('./lexicon');

const DIGITS = /^\d+(\.\d+)?$/;
const SLASH = /^(\d+)\/(\d+)$/;
const JOINERS = new Set(['and', 'aur', 'um', 'a', 'न', 'और']);
const VERB_BEFORE_DO = new Set(['kar', 'de', 'dena', 'le', 'dedo', 'dijiye']);

function simpleValue(tok) {
  if (!tok) return null;
  const t = tok.text;
  if (DIGITS.test(t)) return { value: parseFloat(t), conf: 1 };
  const slash = t.match(SLASH);
  if (slash && Number(slash[2]) !== 0) return { value: Number(slash[1]) / Number(slash[2]), conf: 1 };
  if (t in NUMBER_WORDS) return { value: NUMBER_WORDS[t], conf: 0.95 };
  if (t in MIXED_WORDS) return { value: MIXED_WORDS[t], conf: 0.95 };
  return null;
}

function isUnitAt(tokens, i) {
  return Boolean(tokens[i] && (tokens[i].text in UNIT_WORDS));
}

// Hindi "do" is two only when it is followed by something to count and is not
// part of a verb ("kar do", "de do").
function hindiDo(tokens, i) {
  if (tokens[i]?.text !== 'do') return null;
  const prev = tokens[i - 1]?.text;
  const next = tokens[i + 1];
  if (!next || VERB_BEFORE_DO.has(prev)) return null;
  if (next.text === ',' || next.text === ';') return null;
  return { value: 2, conf: 0.9 };
}

function numberize(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];

    // "a dozen", "a kilo", "an extra" -> one, only before a unit.
    if ((tok.text === 'a' || tok.text === 'an') && isUnitAt(tokens, i + 1)) {
      out.push({ kind: 'num', value: 1, conf: 0.9, raw: tok.raw, text: '1' });
      continue;
    }
    // Stand-alone fraction: "half kg", "arai kilo", "aadha litre".
    if (tok.text in FRACTION_WORDS && !(out.length && out[out.length - 1].kind === 'num')) {
      out.push({ kind: 'num', value: FRACTION_WORDS[tok.text], conf: 0.9, raw: tok.raw, text: String(FRACTION_WORDS[tok.text]) });
      continue;
    }

    const base = simpleValue(tok) || hindiDo(tokens, i);
    if (!base) {
      out.push(tok);
      continue;
    }

    let value = base.value;
    let conf = base.conf;
    let j = i + 1;
    let raw = tok.raw;

    // English tens + ones: "twenty five".
    if (value >= 20 && value < 100 && value % 10 === 0 && tokens[j] && NUMBER_WORDS[tokens[j].text] > 0 && NUMBER_WORDS[tokens[j].text] < 10) {
      value += NUMBER_WORDS[tokens[j].text];
      raw += ` ${tokens[j].raw}`;
      j += 1;
    }
    // "2 and half", "two and a half", "do aur aadha".
    if (tokens[j] && JOINERS.has(tokens[j].text)) {
      let k = j + 1;
      if (tokens[k]?.text === 'a') k += 1;
      if (tokens[k] && tokens[k].text in FRACTION_WORDS) {
        value += FRACTION_WORDS[tokens[k].text];
        raw += ` ${tokens.slice(j, k + 1).map((t) => t.raw).join(' ')}`;
        conf = Math.min(conf, 0.9);
        j = k + 1;
      }
    }
    // "rendu arai" (2.5), "2 half".
    if (tokens[j] && tokens[j].text in FRACTION_WORDS && FRACTION_WORDS[tokens[j].text] === 0.5) {
      value += 0.5;
      raw += ` ${tokens[j].raw}`;
      conf = Math.min(conf, 0.9);
      j += 1;
    }

    out.push({ kind: 'num', value, conf, raw, text: String(value) });
    i = j - 1;
  }
  return out;
}

module.exports = { numberize };
