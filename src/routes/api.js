import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { authRequired, signToken } from '../utils/auth.js';

const router = Router();
const MOCK_OTP = '123456';

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

function normalizeProfileFilters(employee) {
  return {
    state: employee.state,
    sector: employee.sector,
  };
}

function currentEmployee(req) {
  return req.user || null;
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'leoni-in-backend' });
});

router.post('/auth/login', async (req, res) => {
  const { matricule, password } = req.body || {};

  if (!matricule || !password) {
    return res.status(400).json({ message: 'Matricule and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM employees WHERE matricule = ?',
      [String(matricule).trim()]
    );

    const employee = rows[0];
    if (!employee) {
      return res.status(401).json({ message: 'Invalid matricule or password' });
    }

    const validPassword = await bcrypt.compare(String(password), employee.password_hash);
    if (!validPassword) {
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

  if (!matricule || !password) {
    return res.status(400).json({ code: 'INVALID_CREDENTIALS', message: 'Matricule and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    const employee = rows[0];

    if (!employee) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid matricule or password' });
    }

    const validPassword = await bcrypt.compare(String(password), employee.password_hash);
    if (!validPassword) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid matricule or password' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Verify credentials route error', error);
    return res.status(500).json({ code: 'UNKNOWN_ERROR', message: 'Unable to verify credentials' });
  }
});

router.post('/auth/2fa/send', async (req, res) => {
  const { matricule } = req.body || {};

  if (!matricule) {
    return res.status(400).json({ message: 'Matricule is required' });
  }

  try {
    const [rows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [String(matricule).trim()]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    return res.json({ ok: true, method: 'sms', otp: MOCK_OTP });
  } catch (error) {
    console.error('2FA send error', error);
    return res.status(500).json({ message: 'Unable to send verification code' });
  }
});

router.post('/auth/2fa/verify', async (req, res) => {
  const { matricule, code } = req.body || {};

  if (!matricule || !code) {
    return res.status(400).json({ message: 'Matricule and code are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM employees WHERE matricule = ?',
      [String(matricule).trim()]
    );

    const employee = rows[0];
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const normalized = String(code).trim().toLowerCase();
    const isValid = normalized === 'skip' || normalized === 'demo' || normalized === '000000' || String(code).trim() === MOCK_OTP;
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    const token = signToken({
      matricule: employee.matricule,
      role: employee.role,
      id: employee.id,
    });

    return res.json({
      token,
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role,
    });
  } catch (error) {
    console.error('2FA verify error', error);
    return res.status(500).json({ message: 'Unable to verify code' });
  }
});

router.get('/profile', authRequired, async (req, res) => {
  try {
    const user = currentEmployee(req);
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [user.matricule]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    return res.json(employeeToProfile(rows[0]));
  } catch (error) {
    console.error('Get profile error', error);
    return res.status(500).json({ message: 'Unable to fetch profile' });
  }
});

router.patch('/profile', authRequired, async (req, res) => {
  const user = currentEmployee(req);
  const updates = req.body || {};

  try {
    const [rows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [user.matricule]);
    const employee = rows[0];
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const values = {
      address_line_1: updates.addressLine1 ?? employee.address_line_1,
      address_line_2: updates.addressLine2 ?? employee.address_line_2,
      phone: updates.phone ?? employee.phone,
      avatar_url: updates.avatarUrl ?? employee.avatar_url,
    };

    await pool.query(
      `UPDATE employees SET address_line_1 = ?, address_line_2 = ?, phone = ?, avatar_url = ? WHERE matricule = ?`,
      [values.address_line_1, values.address_line_2, values.phone, values.avatar_url, user.matricule]
    );

    const [updatedRows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [user.matricule]);
    return res.json(employeeToProfile(updatedRows[0]));
  } catch (error) {
    console.error('Update profile error', error);
    return res.status(500).json({ message: 'Unable to update profile' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  return router.patch('/profile', req, res);
});

router.get('/news', authRequired, async (req, res) => {
  const user = currentEmployee(req);

  try {
    const [employeeRows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [user.matricule]);
    const employee = employeeRows[0];
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const filters = normalizeProfileFilters(employee);
    const [rows] = await pool.query(
      `SELECT * FROM news_posts WHERE status = 'published' AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE())` +
      (filters.city ? ' AND (city IS NULL OR city = ?)' : '') +
      (filters.sector ? ' AND (sector IS NULL OR sector = ?)' : '') +
      ' ORDER BY published_at DESC',
      [filters.city, filters.sector].filter(Boolean)
    );

    const result = rows.map((post) => ({
      id: String(post.id),
      title: post.title,
      body: post.summary || 'No preview available.',
      date: post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : new Date(post.created_at).toISOString().slice(0, 10),
    }));

    return res.json(result);
  } catch (error) {
    console.error('Get news error', error);
    return res.status(500).json({ message: 'Unable to fetch news' });
  }
});

router.get('/news/posts', authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, JSON_ARRAYAGG(JSON_OBJECT(
        'id', b.id,
        'type', b.type,
        'content', b.content,
        'imageUrl', b.image_url,
        'order', b.order
      )) AS blocks
      FROM news_posts p
      LEFT JOIN news_blocks b ON b.news_post_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    const result = rows.map((post) => ({
      ...post,
      blocks: post.blocks ? JSON.parse(post.blocks) : [],
      createdAt: post.created_at,
      publishedAt: post.published_at,
      startDate: post.start_date,
      endDate: post.end_date,
    }));

    return res.json(result);
  } catch (error) {
    console.error('Get news posts error', error);
    return res.status(500).json({ message: 'Unable to fetch news posts' });
  }
});

router.get('/docs', authRequired, async (_req, res) => {
  return res.json([
    { id: '1', name: 'Employee Handbook.pdf', url: 'https://example.com/handbook.pdf' },
    { id: '2', name: 'Leave Request Form.pdf', url: 'https://example.com/leave-form.pdf' },
  ]);
});

router.get('/document-requests', authRequired, async (req, res) => {
  const user = currentEmployee(req);

  try {
    const [rows] = await pool.query(
      'SELECT d.* FROM document_requests d JOIN employees e ON e.id = d.employee_id WHERE e.matricule = ? ORDER BY d.created_at DESC',
      [user.matricule]
    );

    return res.json(rows.map((row) => ({
      id: String(row.id),
      matricule: user.matricule,
      type: row.type,
      reason: row.reason || undefined,
      status: row.status,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Get document requests error', error);
    return res.status(500).json({ message: 'Unable to fetch document requests' });
  }
});

router.get('/documents/requests', authRequired, async (req, res) => {
  return router.get('/document-requests')(req, res);
});

router.post('/document-requests', authRequired, async (req, res) => {
  const user = currentEmployee(req);
  const { type, reason } = req.body || {};

  try {
    const [employeeRows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const [result] = await pool.query(
      'INSERT INTO document_requests (employee_id, type, reason, status) VALUES (?, ?, ?, ?)',
      [employee.id, type, reason || null, 'pending']
    );

    return res.status(201).json({
      id: String(result.insertId),
      matricule: user.matricule,
      type,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create document request error', error);
    return res.status(500).json({ message: 'Unable to create document request' });
  }
});

router.post('/documents/requests', authRequired, async (req, res) => {
  return router.post('/document-requests')(req, res);
});

router.get('/support-tickets', authRequired, async (req, res) => {
  const user = currentEmployee(req);

  try {
    const [rows] = await pool.query(
      user.role === 'admin'
        ? `SELECT t.*, e.matricule FROM support_tickets t JOIN employees e ON e.id = t.employee_id ORDER BY t.created_at DESC`
        : `SELECT t.*, e.matricule FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE e.matricule = ? ORDER BY t.created_at DESC`,
      user.role === 'admin' ? [] : [user.matricule]
    );

    const result = rows.map((ticket) => ({
      id: String(ticket.id),
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.created_at,
      messages: [],
    }));

    return res.json(result);
  } catch (error) {
    console.error('Get tickets error', error);
    return res.status(500).json({ message: 'Unable to fetch tickets' });
  }
});

router.get('/support/tickets', authRequired, async (req, res) => {
  return router.get('/support-tickets')(req, res);
});

router.get('/support-tickets/:id', authRequired, async (req, res) => {
  const { id } = req.params;

  try {
    const [ticketRows] = await pool.query(
      `SELECT t.*, e.matricule FROM support_tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ?`,
      [id]
    );

    if (!ticketRows.length) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    const ticket = ticketRows[0];
    const [messageRows] = await pool.query(
      'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [id]
    );

    return res.json({
      id: String(ticket.id),
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.created_at,
      messages: messageRows.map((message) => ({
        id: String(message.id),
        sender: message.sender,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    console.error('Get ticket details error', error);
    return res.status(500).json({ message: 'Unable to fetch ticket' });
  }
});

router.get('/support/tickets/:id', authRequired, async (req, res) => {
  return router.get('/support-tickets/:id')(req, res);
});

router.post('/support-tickets', authRequired, async (req, res) => {
  const user = currentEmployee(req);
  const { category, subject, message } = req.body || {};

  if (!category || !subject || !message) {
    return res.status(400).json({ message: 'Category, subject, and message are required' });
  }

  try {
    const [employeeRows] = await pool.query('SELECT id FROM employees WHERE matricule = ?', [user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const [result] = await pool.query(
      'INSERT INTO support_tickets (employee_id, category, subject, status) VALUES (?, ?, ?, ?)',
      [employee.id, category, subject, 'open']
    );

    await pool.query(
      'INSERT INTO support_messages (ticket_id, sender, content) VALUES (?, ?, ?)',
      [result.insertId, 'employee', message]
    );

    return res.status(201).json({
      id: String(result.insertId),
      category,
      subject,
      status: 'open',
      createdAt: new Date().toISOString(),
      messages: [{
        id: 'generated',
        sender: 'employee',
        content: message,
        createdAt: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.error('Create ticket error', error);
    return res.status(500).json({ message: 'Unable to create ticket' });
  }
});

router.post('/support/tickets', authRequired, async (req, res) => {
  return router.post('/support-tickets')(req, res);
});

router.post('/support-tickets/:id/replies', authRequired, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    const [ticketRows] = await pool.query('SELECT * FROM support_tickets WHERE id = ?', [id]);
    if (!ticketRows.length) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    await pool.query(
      'INSERT INTO support_messages (ticket_id, sender, content) VALUES (?, ?, ?)',
      [id, 'employee', message]
    );

    await pool.query('UPDATE support_tickets SET status = ? WHERE id = ?', ['in_progress', id]);

    return res.json({ ok: true, message: 'Reply added successfully' });
  } catch (error) {
    console.error('Reply ticket error', error);
    return res.status(500).json({ message: 'Unable to add reply' });
  }
});

router.post('/support/tickets/:id/reply', authRequired, async (req, res) => {
  return router.post('/support-tickets/:id/replies')(req, res);
});

router.post('/support/tickets/:ticketId/reply', authRequired, async (req, res) => {
  const { ticketId } = req.params;
  const { message } = req.body || {};
  req.params.id = ticketId;
  return router.post('/support-tickets/:id/replies')(req, res);
});

export default router;
