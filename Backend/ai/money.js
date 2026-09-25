// New AI code keeps money as integer paise. Existing product prices are stored
// as rupees (number or string such as "1,250.50"), so convert at the boundary.
function rupeesToPaise(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function lineTotalPaise(pricePaise, qty) {
  return Math.round(pricePaise * (Number(qty) || 0));
}

module.exports = { rupeesToPaise, lineTotalPaise };
