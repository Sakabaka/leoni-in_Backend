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
    const [rows] = await pool.query(
      req.user.role === 'admin'
        ? 'SELECT d.*, e.matricule, e.name AS employee_name FROM document_requests d JOIN employees e ON e.id = d.employee_id ORDER BY d.created_at DESC'
        : 'SELECT d.*, e.matricule, e.name AS employee_name FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE e.matricule = ? ORDER BY d.created_at DESC',
      req.user.role === 'admin' ? [] : [req.user.matricule],
    );

    const result = await Promise.all(rows.map(async (row) => {
      const [messageRows] = await pool.query(
        'SELECT id, sender, content, created_at FROM document_request_messages WHERE request_id = ? ORDER BY created_at ASC',
        [row.id],
      );
      const [hrRows] = await pool.query("SELECT name, matricule FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1");
      const hrName = hrRows[0]?.name || 'HR';
      const hrMatricule = hrRows[0]?.matricule;

      return {
        id: String(row.id),
        matricule: row.matricule,
        employeeName: row.employee_name,
        type: row.type,
        reason: row.reason || undefined,
        status: row.status,
        createdAt: row.created_at,
        response: messageRows.find((message) => message.sender === 'hr')?.content || undefined,
        messages: messageRows.map((message) => ({
          id: String(message.id),
          sender: message.sender,
          senderName: message.sender === 'hr' ? hrName : row.employee_name,
          senderMatricule: message.sender === 'hr' ? hrMatricule : row.matricule,
          content: message.content,
          createdAt: message.created_at,
        })),
      };
    }));

    return res.json(result);
  } catch (error) {
    console.error('Get document requests error', error);
    return res.status(500).json({ message: 'Unable to fetch document requests' });
  }
});

router.get('/document-requests/:id', authRequired, async (req, res) => {
  try {
    const [requestRows] = await pool.query(
      req.user.role === 'admin'
        ? 'SELECT d.*, e.matricule, e.name AS employee_name FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE d.id = ?'
        : 'SELECT d.*, e.matricule, e.name AS employee_name FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE d.id = ? AND e.matricule = ?',
      req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.matricule],
    );

    if (!requestRows.length) {
      return res.status(404).json({ message: 'Document request not found' });
    }

    const request = requestRows[0];
    const [messageRows] = await pool.query(
      'SELECT id, sender, content, created_at FROM document_request_messages WHERE request_id = ? ORDER BY created_at ASC',
      [req.params.id],
    );
    const [hrRows] = await pool.query("SELECT name, matricule FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1");
    const hrName = hrRows[0]?.name || 'HR';
    const hrMatricule = hrRows[0]?.matricule;

    return res.json({
      id: String(request.id),
      matricule: request.matricule,
      employeeName: request.employee_name,
      type: request.type,
      reason: request.reason || undefined,
      status: request.status,
      createdAt: request.created_at,
      response: messageRows.find((message) => message.sender === 'hr')?.content || undefined,
      messages: messageRows.map((message) => ({
        id: String(message.id),
        sender: message.sender,
        senderName: message.sender === 'hr' ? hrName : request.employee_name,
        senderMatricule: message.sender === 'hr' ? hrMatricule : request.matricule,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    console.error('Get document request error', error);
    return res.status(500).json({ message: 'Unable to fetch document request' });
  }
});

router.post('/document-requests', authRequired, async (req, res) => {
  const { type, reason } = req.body || {};
  try {
    const [employeeRows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [req.user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const [result] = await pool.query('INSERT INTO document_requests (employee_id, type, reason, status) VALUES (?, ?, ?, ?)', [employee.id, type, reason || null, 'pending']);
    const createdAt = new Date().toISOString();

    await pool.query('INSERT INTO document_request_messages (request_id, sender, content) VALUES (?, ?, ?)', [result.insertId, 'employee', reason || `Requested ${type}`]);

    return res.status(201).json({
      id: String(result.insertId),
      matricule: req.user.matricule,
      type,
      reason,
      status: 'pending',
      createdAt,
      response: undefined,
      messages: [{ id: 'generated', sender: 'employee', content: reason || `Requested ${type}`, createdAt }],
    });
  } catch (error) {
    console.error('Create document request error', error);
    return res.status(500).json({ message: 'Unable to create document request' });
  }
});

router.post('/document-requests/:id/replies', authRequired, async (req, res) => {
  const { message, status } = req.body || {};
  if (!message && !(req.user.role === 'admin' && status)) return res.status(400).json({ message: 'Message or status is required' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only HR administrators can answer document requests' });

  try {
    const [requestRows] = await pool.query('SELECT d.*, e.matricule, e.name AS employee_name FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE d.id = ?', [req.params.id]);
    if (!requestRows.length) return res.status(404).json({ message: 'Document request not found' });

    const allowedStatuses = new Set(['pending', 'in_progress', 'approved', 'rejected']);
    const nextStatus = status || 'in_progress';
    if (!allowedStatuses.has(nextStatus)) return res.status(400).json({ message: 'Invalid document request status' });
    if (message) {
      await pool.query('INSERT INTO document_request_messages (request_id, sender, content) VALUES (?, ?, ?)', [req.params.id, 'hr', message]);
    }
    await pool.query('UPDATE document_requests SET status = ? WHERE id = ?', [nextStatus, req.params.id]);

    const [rows] = await pool.query('SELECT * FROM document_request_messages WHERE request_id = ? ORDER BY created_at ASC', [req.params.id]);
    const [hrRows] = await pool.query("SELECT name, matricule FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1");
    const hrName = hrRows[0]?.name || 'HR';
    const hrMatricule = hrRows[0]?.matricule;

    return res.json({
      id: String(req.params.id),
      matricule: requestRows[0].matricule,
      type: requestRows[0].type,
      reason: requestRows[0].reason || undefined,
      status: nextStatus,
      createdAt: requestRows[0].created_at,
      response: rows.find((entry) => entry.sender === 'hr')?.content || undefined,
      messages: rows.map((entry) => ({
        id: String(entry.id),
        sender: entry.sender,
        senderName: entry.sender === 'hr' ? hrName : requestRows[0].employee_name,
        senderMatricule: entry.sender === 'hr' ? hrMatricule : requestRows[0].matricule,
        content: entry.content,
        createdAt: entry.created_at,
      })),
    });
  } catch (error) {
    console.error('Reply document request error', error);
    return res.status(500).json({ message: 'Unable to add reply' });
  }
});

export default router;
