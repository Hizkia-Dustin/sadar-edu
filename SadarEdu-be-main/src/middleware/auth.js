const jwt = require('jsonwebtoken');

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET wajib diisi pada mode production.');
    }
    return 'dev_only_insecure_secret_change_me';
  }
  return secret;
};

const signToken = (payload) =>
  jwt.sign(payload, getSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

/** Wajib login. Token tidak ada/tidak valid -> 401 supaya FE dapat otomatis logout. */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    req.user = jwt.verify(token, getSecret());
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
  }
};

/** Batasi akses berdasarkan nama role (case-insensitive). Pakai setelah authenticateToken. */
const requireRole = (...roles) => {
  const allowed = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    const role = (req.user && req.user.role ? String(req.user.role) : '').toLowerCase();
    if (!allowed.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Fitur ini hanya untuk peran: ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

/** Seperti authenticateToken tetapi tidak menolak bila token tidak ada (req.user diisi jika valid). */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      req.user = jwt.verify(token, getSecret());
    } catch (_) {
      /* token buruk diabaikan pada rute publik */
    }
  }
  next();
};

const ROLE = { UMUM: 'Umum', STAKEHOLDER: 'Stakeholder', OPERATOR: 'Operator' };
const staffOnly = [authenticateToken, requireRole(ROLE.STAKEHOLDER, ROLE.OPERATOR)];
const operatorOnly = [authenticateToken, requireRole(ROLE.OPERATOR)];

module.exports = { authenticateToken, requireRole, optionalAuth, signToken, ROLE, staffOnly, operatorOnly };
