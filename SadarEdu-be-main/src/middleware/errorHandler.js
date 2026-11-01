// Memetakan error PostgreSQL yang umum menjadi status HTTP & pesan yang ramah
const PG_ERRORS = {
  '23505': [409, 'Data duplikat: nilai unik tersebut sudah ada.'],
  '23503': [400, 'Referensi data tidak valid (data induk tidak ditemukan atau masih dipakai).'],
  '23502': [400, 'Ada kolom wajib yang kosong.'],
  '22P02': [400, 'Format data tidak valid.'],
  '22023': [400, 'Parameter tidak valid.'],
  XX000: [400, 'Geometri tidak valid.'],
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('❌ API Error:', err.stack || err);

  let status = err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  if (err.code && PG_ERRORS[err.code]) {
    [status, message] = PG_ERRORS[err.code];
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Ukuran data terlalu besar.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Body request bukan JSON yang valid.';
  } else if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'Terjadi kesalahan pada server.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { detail: err.message, stack: err.stack }),
  });
};

/** Membuat error dengan status HTTP: throw httpError(400, 'pesan') */
const httpError = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

module.exports = errorHandler;
module.exports.httpError = httpError;
