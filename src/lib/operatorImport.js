// Panjang NPSN (Nomor Pokok Sekolah Nasional) adalah 8 digit.
export const NPSN_LENGTH = 8;

// Kolom skema SADAR EDU yang harus dicocokkan dengan kolom berkas sumber.
export const FIELDS = [
  { key: 'npsn', label: 'NPSN', rule: 'String \u2022 wajib', required: true },
  { key: 'name', label: 'Nama sekolah', rule: 'Teks \u2022 wajib', required: true },
  { key: 'lat', label: 'Lintang', rule: 'Desimal atau kosong', required: false },
  { key: 'lng', label: 'Bujur', rule: 'Desimal atau kosong', required: false },
  { key: 'students', label: 'Peserta didik', rule: 'Bilangan bulat atau kosong', required: false },
];

const ALIASES = {
  npsn: ['npsn'],
  name: ['namasekolah', 'nama', 'sekolah', 'namasatuanpendidikan'],
  lat: ['lintang', 'latitude', 'lat'],
  lng: ['bujur', 'longitude', 'long', 'lng', 'lon'],
  students: ['pesertadidik', 'jumlahpesertadidik', 'siswa', 'jumlahsiswa'],
};

const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function detectDelimiter(firstLine) {
  const candidates = [',', ';', '\t'];
  const counts = candidates.map((c) => firstLine.split(c).length - 1);
  return candidates[counts.indexOf(Math.max(...counts))];
}

// Membaca CSV (kutip ganda, CRLF, BOM). Semua nilai dibiarkan sebagai teks
// supaya nol di depan NPSN tidak hilang.
export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const cleaned = rows.filter((r) => r.some((value) => value.trim() !== ''));
  const [headers = [], ...data] = cleaned;
  return { headers: headers.map((h) => h.trim()), rows: data };
}

// Menebak kolom sumber untuk tiap kolom skema berdasarkan nama judul kolom.
export function guessMapping(headers) {
  const mapping = {};
  FIELDS.forEach(({ key }) => {
    const index = headers.findIndex((header) => ALIASES[key].includes(normalize(header)));
    mapping[key] = index === -1 ? '' : String(index);
  });
  return mapping;
}

export function isMappingComplete(mapping) {
  return FIELDS.filter((field) => field.required).every((field) => mapping[field.key] !== '');
}

const parseDecimal = (value) => {
  const text = value.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
};

export function validateRows(rows, mapping) {
  const read = (row, key) => (mapping[key] === '' ? '' : (row[Number(mapping[key])] ?? '').trim());
  const affected = { npsn: 0, koordinat: 0, numerik: 0, identitas: 0 };
  const errors = [];
  let needsFix = 0;
  let noMarker = 0;

  rows.forEach((row, index) => {
    const line = index + 2;
    const problems = [];

    const npsn = read(row, 'npsn');
    const name = read(row, 'name');
    if (npsn === '' || name === '') {
      affected.identitas += 1;
      if (npsn === '') problems.push({ rule: 'Identitas', field: 'npsn', value: '', message: 'NPSN kosong' });
      if (name === '') problems.push({ rule: 'Identitas', field: 'name', value: '', message: 'Nama sekolah kosong' });
    }
    if (npsn !== '' && !new RegExp(`^\\d{${NPSN_LENGTH}}$`).test(npsn)) {
      affected.npsn += 1;
      problems.push({
        rule: 'Format NPSN',
        field: 'npsn',
        value: npsn,
        message: `NPSN "${npsn}" bukan ${NPSN_LENGTH} digit`,
      });
    }

    const latText = read(row, 'lat');
    const lngText = read(row, 'lng');
    const lat = latText === '' ? null : parseDecimal(latText);
    const lng = lngText === '' ? null : parseDecimal(lngText);
    const hasInput = latText !== '' || lngText !== '';
    const validPair = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!validPair) noMarker += 1;
    if (hasInput && !validPair) {
      affected.koordinat += 1;
      problems.push({
        rule: 'Koordinat',
        field: 'koordinat',
        value: [latText, lngText].filter((part) => part !== '').join(', '),
        message: `Koordinat "${latText}, ${lngText}" tidak valid`,
      });
    }

    const students = read(row, 'students');
    if (students !== '' && !/^\d+$/.test(students)) {
      affected.numerik += 1;
      problems.push({
        rule: 'Nilai numerik',
        field: 'students',
        value: students,
        message: `"${students}" bukan bilangan bulat`,
      });
    }

    if (problems.length > 0) {
      needsFix += 1;
      problems.forEach((problem) => errors.push({ line, ...problem }));
    }
  });

  const gate = (count) => (count === 0 ? 'Lulus' : 'Perlu perbaikan');

  return {
    totalRows: rows.length,
    passedRows: rows.length - needsFix,
    needsFixRows: needsFix,
    noMarkerRows: noMarker,
    findings: [
      { rule: 'Format NPSN', provision: 'String dan panjang karakter', affected: affected.npsn },
      { rule: 'Koordinat', provision: 'Invalid tetap di daftar', affected: affected.koordinat },
      { rule: 'Nilai numerik', provision: 'Null tidak menjadi 0', affected: affected.numerik },
      { rule: 'Identitas', provision: 'Nama dan NPSN wajib', affected: affected.identitas },
    ],
    gates: [
      { name: 'Identitas', status: gate(affected.identitas + affected.npsn) },
      { name: 'Koordinat', status: gate(affected.koordinat) },
      { name: 'Nilai numerik', status: gate(affected.numerik) },
      // Sumber dan periode belum punya tempat pengisian pada alur ini.
      { name: 'Provenance', status: 'Menunggu' },
    ],
    errors: errors.slice(0, 1000),
    errorsTotal: errors.length,
    ranAt: new Date().toISOString(),
  };
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export const FIELD_LABELS = {
  npsn: 'NPSN',
  name: 'Nama sekolah',
  koordinat: 'Koordinat',
  students: 'Peserta didik',
};

// Membaca "lintang, bujur" menjadi dua nilai teks. Teks kosong berarti koordinat dikosongkan.
function parseCoordinatePair(text) {
  const value = text.trim();
  if (value === '') return { lat: '', lng: '' };

  let parts = value.split(/\s*;\s*/);
  if (parts.length !== 2) parts = value.split(/\s*,\s+/);
  if (parts.length !== 2 && value.split(',').length === 2) parts = value.split(',');
  if (parts.length !== 2) return null;

  const lat = parseDecimal(parts[0]);
  const lng = parseDecimal(parts[1]);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: String(lat), lng: String(lng) };
}

// Memeriksa usulan perbaikan. Hasilnya: { ok, message } atau { ok, patches }
// dengan patches berisi kolom berkas yang akan diubah.
export function validateProposal(field, text, mapping) {
  const value = text.trim();

  if (field === 'npsn') {
    if (!new RegExp(`^\\d{${NPSN_LENGTH}}$`).test(value)) {
      return { ok: false, message: `NPSN harus ${NPSN_LENGTH} digit angka.` };
    }
    return { ok: true, patches: [{ column: Number(mapping.npsn), value }] };
  }

  if (field === 'name') {
    if (value === '') return { ok: false, message: 'Nama sekolah tidak boleh kosong.' };
    return { ok: true, patches: [{ column: Number(mapping.name), value }] };
  }

  if (field === 'students') {
    if (value !== '' && !/^\d+$/.test(value)) {
      return { ok: false, message: 'Isi bilangan bulat, atau kosongkan.' };
    }
    return { ok: true, patches: [{ column: Number(mapping.students), value }] };
  }

  if (field === 'koordinat') {
    if (mapping.lat === '' || mapping.lng === '') {
      return { ok: false, message: 'Kolom Lintang dan Bujur belum dipetakan di halaman impor.' };
    }
    const pair = parseCoordinatePair(value);
    if (!pair) {
      return { ok: false, message: 'Tulis sebagai lintang, bujur (contoh -6.595, 106.816), atau kosongkan.' };
    }
    return {
      ok: true,
      patches: [
        { column: Number(mapping.lat), value: pair.lat },
        { column: Number(mapping.lng), value: pair.lng },
      ],
    };
  }

  return { ok: false, message: 'Jenis temuan ini belum bisa diperbaiki.' };
}

// Isian provenance yang tampil di halaman publik (halaman Review pengajuan).
export const PROVENANCE_FIELDS = [
  { key: 'source', label: 'Sumber dataset', required: true },
  { key: 'period', label: 'Periode data', required: true },
  { key: 'scope', label: 'Cakupan wilayah', required: true },
  { key: 'license', label: 'Lisensi penggunaan', required: true },
  { key: 'attribution', label: 'Atribusi peta dasar', required: false },
  { key: 'note', label: 'Catatan pembaruan', required: false },
];

export const EMPTY_PROVENANCE = {
  source: '',
  period: '',
  scope: '',
  license: '',
  attribution: '',
  note: '',
};

const filled = (value) => (value ?? '').trim() !== '';

export function isProvenanceComplete(provenance) {
  return PROVENANCE_FIELDS.filter((field) => field.required).every((field) => filled(provenance[field.key]));
}

// Lima gerbang yang harus terbuka sebelum dataset boleh diajukan.
export function getSubmissionGates({ draft, validation, provenance }) {
  const needsFix = validation?.needsFixRows ?? 0;
  return [
    { name: 'Dataset dipilih', passed: Boolean(draft), detail: draft ? draft.fileName : '' },
    { name: 'Validasi selesai', passed: Boolean(validation), detail: '' },
    {
      name: 'Anomali ditinjau',
      passed: Boolean(validation) && needsFix === 0,
      detail: validation && needsFix > 0 ? `${needsFix} baris perlu perbaikan` : '',
    },
    { name: 'Provenance lengkap', passed: isProvenanceComplete(provenance), detail: '' },
    { name: 'Atribusi tersedia', passed: filled(provenance.attribution), detail: '' },
  ];
}

// Ringkasan pratinjau publik dari draf: jumlah sekolah, yang punya marker, dan daftar awalnya.
export function summarizePreview(draft, limit = 100) {
  const { rows, mapping } = draft;
  const read = (row, key) => (mapping[key] === '' ? '' : (row[Number(mapping[key])] ?? '').trim());
  let withMarker = 0;
  const preview = [];

  rows.forEach((row) => {
    const lat = parseDecimal(read(row, 'lat'));
    const lng = parseDecimal(read(row, 'lng'));
    const hasMarker = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (hasMarker) withMarker += 1;
    if (preview.length < limit) {
      preview.push({ npsn: read(row, 'npsn'), name: read(row, 'name'), hasMarker });
    }
  });

  return { total: rows.length, withMarker, withoutMarker: rows.length - withMarker, rows: preview };
}