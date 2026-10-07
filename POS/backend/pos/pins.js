// Cashier PINs are stored only as bcrypt hashes.
const bcrypt = require('bcryptjs');

const ROUNDS = 10;
const PIN_RE = /^\d{4}$/;

const isValidPin = (pin) => PIN_RE.test(String(pin ?? ''));
const hashPin = (pin) => bcrypt.hash(String(pin), ROUNDS);
const verifyPin = (pin, hash) => (hash ? bcrypt.compare(String(pin ?? ''), hash) : Promise.resolve(false));

module.exports = { isValidPin, hashPin, verifyPin };
