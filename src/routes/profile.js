import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../utils/auth.js';

const router = Router();

function employeeToProfile(row) {
  return {
    matricule: row.matricule,
    name: row.name,
    department: row.department,
    role: row.role,
    state: row.state,
    sector: row.sector,
    addressLine1: row.address_line_1 || undefined,
    addressLine2: row.address_line_2 || undefined,
    phone: row.phone || undefined,
    avatarUrl: row.avatar_url || undefined,
  };
}

router.get('/profile', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [req.user.matricule]);
    if (!rows.length) return res.status(404).json({ message: 'Employee not found' });
    return res.json(employeeToProfile(rows[0]));
  } catch (error) {
    console.error('Get profile error', error);
    return res.status(500).json({ message: 'Unable to fetch profile' });
  }
});

router.patch('/profile', authRequired, async (req, res) => {
  const updates = req.body || {};
  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [req.user.matricule]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const values = {
      address_line_1: updates.addressLine1 ?? employee.address_line_1,
      address_line_2: updates.addressLine2 ?? employee.address_line_2,
      phone: updates.phone ?? employee.phone,
      avatar_url: updates.avatarUrl ?? employee.avatar_url,
    };
    await pool.query(
      'UPDATE employees SET address_line_1 = ?, address_line_2 = ?, phone = ?, avatar_url = ? WHERE matricule = ?',
      [values.address_line_1, values.address_line_2, values.phone, values.avatar_url, req.user.matricule],
    );
    const [updatedRows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [req.user.matricule]);
    return res.json(employeeToProfile(updatedRows[0]));
  } catch (error) {
    console.error('Update profile error', error);
    return res.status(500).json({ message: 'Unable to update profile' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  req.method = 'PATCH';
  return router.handle(req, res);
});

export default router;
