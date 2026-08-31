import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../utils/auth.js';

const router = Router();

router.post('/notifications/push-token', authRequired, async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== 'string') return res.status(400).json({ message: 'Push token is required' });

  try {
    const [employees] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [req.user.matricule]);
    if (!employees.length) return res.status(404).json({ message: 'Employee not found' });
    await pool.query(
      `INSERT INTO push_tokens (employee_id, token, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE employee_id = VALUES(employee_id), platform = VALUES(platform), updated_at = CURRENT_TIMESTAMP`,
      [employees[0].id, token, platform || null],
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Push token registration error', error);
    return res.status(500).json({ message: 'Unable to register push token' });
  }
});

router.delete('/notifications/push-token', authRequired, async (req, res) => {
  const { token } = req.body || {};
  if (token) await pool.query('DELETE FROM push_tokens WHERE token = ?', [token]);
  return res.status(204).send();
});

export default router;
