const { Pool, types } = require('pg');
require('dotenv').config();

// pg mengembalikan BIGINT (oid 20) dan NUMERIC (oid 1700) sebagai string.
// Ubah menjadi number agar JSON API konsisten (id & angka tidak berupa string).
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const dbHost = process.env.DB_HOST || 'localhost';
const isSupabasePooler = dbHost.includes('pooler.supabase.com');

// Supabase pooler pada port 5432 adalah Session Mode (dibatasi ketat pool_size: 15 client).
// Pada serverless (Vercel Functions), Session Mode menyebabkan error fatal: (EMAXCONNSESSION).
// Selalu gunakan port 6543 (Transaction Mode) untuk pooler Supabase agar konkurensi tak terbatas.
const dbPort = isSupabasePooler ? 6543 : parseInt(process.env.DB_PORT || '5432', 10);

const useSsl =
  process.env.DB_SSL === 'true' ||
  dbHost.includes('.supabase.co') ||
  dbHost.includes('.supabase.com') ||
  (process.env.DATABASE_URL || '').includes('supabase.');

const isServerless = Boolean(process.env.VERCEL);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: isServerless ? 5 : 20,
      idleTimeoutMillis: isServerless ? 2000 : 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      host: dbHost,
      port: dbPort,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'postgres',
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: isServerless ? 5 : 20,
      idleTimeoutMillis: isServerless ? 2000 : 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message || err);
});

const isConnError = (err) => {
  if (!err) return false;
  const m = (err.message || '').toLowerCase();
  return (
    m.includes('connection terminated') ||
    m.includes('closed') ||
    m.includes('econnreset') ||
    m.includes('socket hang up') ||
    m.includes('broken pipe') ||
    m.includes('max clients reached in session mode') ||
    err.code === '57P01' || // admin_shutdown
    err.code === '57P02' || // crash_shutdown
    err.code === '57P03'    // cannot_connect_now
  );
};

/** Menjalankan query dengan auto-retry 1x jika koneksi sempat terputus pada cold start / pool idle */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (isConnError(err)) {
      console.warn('⚠️ Koneksi PostgreSQL terputus saat freeze, mencoba ulang 1x...', err.message);
      await new Promise((r) => setTimeout(r, 200));
      return await pool.query(text, params);
    }
    throw err;
  }
};

/** Menjalankan beberapa query dalam satu transaksi. fn menerima client pg. */
const withTransaction = async (fn) => {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    if (isConnError(err)) {
      await new Promise((r) => setTimeout(r, 200));
      client = await pool.connect();
    } else {
      throw err;
    }
  }
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* abaikan kegagalan rollback */
    }
    throw err;
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  query,
  withTransaction,
  pool,
};
