import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { signToken } from '../utils/auth.js';
import { validateMatricule, validatePassword } from '../utils/validation.js';
import { codesMatch, deliverCode, generateCode, hashCode, isMethodEnabled } from '../services/twoFactor.js';

const router = Router();

router.post('/auth/login', async (req, res) => {
  const { matricule, password } = req.body || {};
  if (!matricule || !password) return res.status(400).json({ message: 'Matricule and password are required' });

  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];
    if (!employee) return res.status(401).json({ message: 'Invalid matricule or password' });
    if (!await bcrypt.compare(String(password), employee.password_hash)) {
      return res.status(401).json({ message: 'Invalid matricule or password' });
    }
    return res.json({ ok: true, message: 'Credentials valid' });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ message: 'Unable to verify credentials' });
  }
});

router.post('/auth/verify-credentials', async (req, res) => {
  const { matricule, password } = req.body || {};
  if (!matricule || !password) return res.status(400).json({ code: 'INVALID_CREDENTIALS', message: 'Matricule and password are required' });
  if (!validateMatricule(matricule)) return res.status(400).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid matricule format' });
  if (!validatePassword(password)) return res.status(400).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid password format' });

  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];
    if (!employee || !await bcrypt.compare(String(password), employee.password_hash)) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid matricule or password' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Verify credentials route error', error);
    return res.status(500).json({ code: 'UNKNOWN_ERROR', message: 'Unable to verify credentials' });
  }
});

router.post('/auth/2fa/methods', async (req, res) => {
  const { matricule } = req.body || {};
  if (!matricule) return res.status(400).json({ message: 'Matricule is required' });
  try {
    const [rows] = await pool.query('SELECT phone, email FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const destinations = { sms: employee.phone, whatsapp: employee.phone, email: employee.email };
    const methods = Object.keys(destinations).filter((method) => isMethodEnabled(method, destinations[method]));
    return res.json({ methods });
  } catch (error) {
    console.error('2FA methods error', error);
    return res.status(500).json({ message: 'Unable to load 2FA methods' });
  }
});

router.post('/auth/2fa/send', async (req, res) => {
  const { matricule, method = 'sms' } = req.body || {};
  if (!matricule) return res.status(400).json({ message: 'Matricule is required' });
  if (!['sms', 'whatsapp', 'email'].includes(method)) return res.status(400).json({ message: 'Unsupported 2FA method' });

  try {
    const [rows] = await pool.query('SELECT id, phone, email FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const destination = method === 'email' ? employee.email : employee.phone;
    if (!destination) return res.status(400).json({ message: `No ${method} destination is configured for this employee` });
    const code = generateCode();
    await pool.query(`INSERT INTO two_factor_challenges (employee_id, method, destination, code_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`, [employee.id, method, destination, hashCode(code)]);
    await deliverCode({ method, destination, code });
    return res.json({ ok: true, method, expiresInSeconds: 600 });
  } catch (error) {
    console.error('2FA send error', error);
    return res.status(503).json({ message: '2FA delivery is not configured yet' });
  }
});

router.post('/auth/2fa/verify', async (req, res) => {
  const { matricule, code } = req.body || {};
  if (!matricule || !code) return res.status(400).json({ message: 'Matricule and code are required' });

  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const [challengeRows] = await pool.query(`SELECT * FROM two_factor_challenges WHERE employee_id = ? AND used_at IS NULL AND expires_at > NOW() AND attempts < 5 ORDER BY created_at DESC LIMIT 1`, [employee.id]);
    const challenge = challengeRows[0];
    if (!challenge) return res.status(401).json({ message: 'No active verification code. Request a new code.' });
    const valid = codesMatch(String(code).trim(), challenge.code_hash);
    await pool.query('UPDATE two_factor_challenges SET attempts = attempts + 1 WHERE id = ?', [challenge.id]);
    if (!valid) return res.status(401).json({ message: 'Invalid or expired code' });
    await pool.query('UPDATE two_factor_challenges SET used_at = NOW() WHERE id = ?', [challenge.id]);
    const token = signToken({ matricule: employee.matricule, role: employee.role, id: employee.id });
    return res.json({ token, matricule: employee.matricule, name: employee.name, role: employee.role });
  } catch (error) {
    console.error('2FA verify error', error);
    return res.status(500).json({ message: 'Unable to verify code' });
  }
});

export default router;
