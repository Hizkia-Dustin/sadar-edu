const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { signToken, ROLE } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ID = { [ROLE.UMUM]: 1, [ROLE.STAKEHOLDER]: 2, [ROLE.OPERATOR]: 3 };

const validate = ({ nama, email, password }) => {
  if (!nama || !email || !password) return 'Nama, email, dan password wajib diisi.';
  if (!EMAIL_RE.test(email)) return 'Format email tidak valid.';
  if (String(password).length < 8) return 'Password minimal 8 karakter.';
  return null;
};

// Registrasi publik: selalu menghasilkan akun role "Umum".
// Akun Stakeholder/Operator hanya dapat dibuat oleh Operator lewat POST /auth/users.
const register = async (req, res, next) => {
  try {
    const { nama, email, password } = req.body || {};
    const invalid = validate({ nama, email, password });
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const existing = await db.query('SELECT id_user FROM user_account WHERE email = $1', [String(email).toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO user_account (nama, email, password_hash, id_role) VALUES ($1, $2, $3, $4)
       RETURNING id_user, nama, email, id_role, status_aktif, created_at`,
      [nama, String(email).toLowerCase(), password_hash, ROLE_ID[ROLE.UMUM]]
    );
    res.status(201).json({ success: true, message: 'Registrasi berhasil.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Operator membuat akun dengan role tertentu
const createUser = async (req, res, next) => {
  try {
    const { nama, email, password, role } = req.body || {};
    const invalid = validate({ nama, email, password });
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    const roleName = Object.values(ROLE).find((r) => r.toLowerCase() === String(role || '').toLowerCase());
    if (!roleName) return res.status(400).json({ success: false, message: 'role harus salah satu dari: Umum, Stakeholder, Operator.' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO user_account (nama, email, password_hash, id_role) VALUES ($1, $2, $3, $4)
       RETURNING id_user, nama, email, status_aktif, created_at`,
      [nama, String(email).toLowerCase(), password_hash, ROLE_ID[roleName]]
    );
    res.status(201).json({ success: true, message: 'Akun berhasil dibuat.', data: { ...result.rows[0], role: roleName } });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id_user, u.nama, u.email, u.status_aktif, r.nama_role AS role, u.created_at
       FROM user_account u LEFT JOIN role r ON r.id_role = u.id_role ORDER BY u.created_at DESC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }
    const userQuery = await db.query(
      `SELECT u.*, r.nama_role FROM user_account u LEFT JOIN role r ON u.id_role = r.id_role WHERE u.email = $1`,
      [String(email).toLowerCase()]
    );
    // Pesan sama untuk email salah / password salah agar tidak membocorkan akun yang terdaftar
    const fail = () => res.status(401).json({ success: false, message: 'Email atau password salah.' });
    if (userQuery.rows.length === 0) return fail();

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return fail();
    if (!user.status_aktif) return res.status(403).json({ success: false, message: 'Akun Anda tidak aktif.' });

    const token = signToken({ id_user: user.id_user, email: user.email, role: user.nama_role });
    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: { id_user: user.id_user, nama: user.nama, email: user.email, role: user.nama_role },
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id_user, u.nama, u.email, u.status_aktif, r.nama_role AS role, u.created_at
       FROM user_account u LEFT JOIN role r ON u.id_role = r.id_role WHERE u.id_user = $1`,
      [req.user.id_user]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, createUser, listUsers, login, getProfile };
