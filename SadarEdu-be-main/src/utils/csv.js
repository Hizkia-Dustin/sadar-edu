/**
 * Parser CSV sederhana (RFC 4180): kutip ganda, koma/titik-koma sebagai pemisah,
 * baris kosong dilewati. Mengembalikan array objek dengan header sebagai kunci.
 */
function parseCSV(text) {
  if (typeof text !== 'string') return [];
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => String(h).trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] === undefined ? '' : String(r[idx]).trim();
    });
    return obj;
  });
}

module.exports = { parseCSV };
