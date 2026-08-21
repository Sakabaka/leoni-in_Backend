import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../utils/auth.js';

const router = Router();

router.get('/docs', authRequired, (_req, res) => res.json([
  { id: '1', name: 'Employee Handbook.pdf', url: 'https://example.com/handbook.pdf' },
  { id: '2', name: 'Leave Request Form.pdf', url: 'https://example.com/leave-form.pdf' },
]));

router.get('/document-requests', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT d.* FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE e.matricule = ? ORDER BY d.created_at DESC', [req.user.matricule]);
    return res.json(rows.map((row) => ({ id: String(row.id), matricule: req.user.matricule, type: row.type, reason: row.reason || undefined, status: row.status, createdAt: row.created_at })));
  } catch (error) {
    console.error('Get document requests error', error);
    return res.status(500).json({ message: 'Unable to fetch document requests' });
  }
});

router.post('/document-requests', authRequired, async (req, res) => {
  const { type, reason } = req.body || {};
  try {
    const [employeeRows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [req.user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const [result] = await pool.query('INSERT INTO document_requests (employee_id, type, reason, status) VALUES (?, ?, ?, ?)', [employee.id, type, reason || null, 'pending']);
    return res.status(201).json({ id: String(result.insertId), matricule: req.user.matricule, type, reason, status: 'pending', createdAt: new Date().toISOString() });
  } catch (error) {
    console.error('Create document request error', error);
    return res.status(500).json({ message: 'Unable to create document request' });
  }
});

export default router;
