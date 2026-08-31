import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../utils/auth.js';

const router = Router();

router.get('/support-tickets', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(req.user.role === 'admin'
      ? 'SELECT t.*, e.matricule, e.name AS employee_name FROM support_tickets t JOIN employees e ON e.id = t.employee_id ORDER BY t.created_at DESC'
      : 'SELECT t.*, e.matricule, e.name AS employee_name FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE e.matricule = ? ORDER BY t.created_at DESC', req.user.role === 'admin' ? [] : [req.user.matricule]);
    const [hrRows] = await pool.query("SELECT name FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1");
    const hrName = hrRows[0]?.name || 'HR';
    const result = await Promise.all(rows.map(async (ticket) => {
      const [messageRows] = await pool.query('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticket.id]);
      return {
        id: String(ticket.id), category: ticket.category, subject: ticket.subject,
        status: ticket.status, createdAt: ticket.created_at, employeeName: ticket.employee_name,
        messages: messageRows.map((message) => ({
          id: String(message.id), sender: message.sender,
          senderName: message.sender === 'hr' ? hrName : ticket.employee_name,
          content: message.content, createdAt: message.created_at,
        })),
      };
    }));
    return res.json(result);
  } catch (error) {
    console.error('Get tickets error', error);
    return res.status(500).json({ message: 'Unable to fetch tickets' });
  }
});

router.get('/support-tickets/:id', authRequired, async (req, res) => {
  try {
    const [ticketRows] = await pool.query(
      req.user.role === 'admin'
        ? 'SELECT t.*, e.matricule, e.name AS employee_name FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ?'
        : 'SELECT t.*, e.matricule, e.name AS employee_name FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ? AND e.matricule = ?',
      req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.matricule],
    );
    if (!ticketRows.length) return res.status(404).json({ message: 'Support ticket not found' });
    const ticket = ticketRows[0];
    const [messageRows] = await pool.query('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
    const [hrRows] = await pool.query("SELECT name FROM employees WHERE role = 'admin' ORDER BY id LIMIT 1");
    const hrName = hrRows[0]?.name || 'HR';
    return res.json({ id: String(ticket.id), category: ticket.category, subject: ticket.subject, status: ticket.status, createdAt: ticket.created_at, messages: messageRows.map((message) => ({ id: String(message.id), sender: message.sender, senderName: message.sender === 'hr' ? hrName : ticket.employee_name, content: message.content, createdAt: message.created_at })) });
  } catch (error) {
    console.error('Get ticket details error', error);
    return res.status(500).json({ message: 'Unable to fetch ticket' });
  }
});

router.post('/support-tickets', authRequired, async (req, res) => {
  const { category, subject, message } = req.body || {};
  if (!category || !subject || !message) return res.status(400).json({ message: 'Category, subject, and message are required' });
  try {
    const [employeeRows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [req.user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const [result] = await pool.query('INSERT INTO support_tickets (employee_id, category, subject, status) VALUES (?, ?, ?, ?)', [employee.id, category, subject, 'open']);
    await pool.query('INSERT INTO support_messages (ticket_id, sender, content) VALUES (?, ?, ?)', [result.insertId, 'employee', message]);
    return res.status(201).json({ id: String(result.insertId), category, subject, status: 'open', createdAt: new Date().toISOString(), messages: [{ id: 'generated', sender: 'employee', content: message, createdAt: new Date().toISOString() }] });
  } catch (error) {
    console.error('Create ticket error', error);
    return res.status(500).json({ message: 'Unable to create ticket' });
  }
});

router.post('/support-tickets/:id/replies', authRequired, async (req, res) => {
  const { message, status } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Message is required' });
  try {
    const [ticketRows] = await pool.query(
      req.user.role === 'admin'
        ? 'SELECT * FROM support_tickets WHERE id = ?'
        : 'SELECT t.* FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ? AND e.matricule = ?',
      req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.matricule],
    );
    if (!ticketRows.length) return res.status(404).json({ message: 'Support ticket not found' });
    const sender = req.user.role === 'admin' ? 'hr' : 'employee';
    const allowedStatuses = new Set(['open', 'in_progress', 'resolved']);
    const nextStatus = req.user.role === 'admin' && status ? status : 'in_progress';
    if (!allowedStatuses.has(nextStatus)) return res.status(400).json({ message: 'Invalid support ticket status' });
    await pool.query('INSERT INTO support_messages (ticket_id, sender, content) VALUES (?, ?, ?)', [req.params.id, sender, message]);
    await pool.query('UPDATE support_tickets SET status = ? WHERE id = ?', [nextStatus, req.params.id]);
    return res.json({ ok: true, message: 'Reply added successfully' });
  } catch (error) {
    console.error('Reply ticket error', error);
    return res.status(500).json({ message: 'Unable to add reply' });
  }
});

export default router;
