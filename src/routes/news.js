import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../utils/auth.js';

const router = Router();

function profileFilters(employee) {
  return { city: employee.state, sector: employee.sector };
}

function buildArticleBody(post, blocks = []) {
  const blockText = blocks
    .filter((block) => block && block.id != null)
    .map((block) => {
      if (block.type === 'heading') return `\n${block.content}`;
      if (block.type === 'image') return block.imageUrl || block.content || '';
      return block.content || '';
    })
    .filter(Boolean)
    .join('\n\n');

  return [post.summary, blockText].filter(Boolean).join('\n\n') || 'No preview available.';
}

router.get('/news', authRequired, async (req, res) => {
  try {
    const [employeeRows] = await pool.query('SELECT * FROM employees WHERE matricule = ?', [req.user.matricule]);
    const employee = employeeRows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const filters = profileFilters(employee);
    const [rows] = await pool.query(
      `SELECT p.*, JSON_ARRAYAGG(JSON_OBJECT('id', b.id, 'type', b.type, 'content', b.content, 'imageUrl', b.image_url, 'order', b.order)) AS blocks FROM news_posts p LEFT JOIN news_blocks b ON b.news_post_id = p.id WHERE p.status = 'published' AND (p.start_date IS NULL OR p.start_date <= CURDATE()) AND (p.end_date IS NULL OR p.end_date >= CURDATE())` +
      (filters.city ? ' AND (p.city IS NULL OR p.city = ?)' : '') +
      (filters.sector ? ' AND (p.sector IS NULL OR p.sector = ?)' : '') +
      ' GROUP BY p.id ORDER BY p.published_at DESC',
      [filters.city, filters.sector].filter(Boolean),
    );
    return res.json(rows.map((post) => {
      const parsedBlocks = typeof post.blocks === 'string' ? JSON.parse(post.blocks) : post.blocks;
      const blocks = Array.isArray(parsedBlocks) ? parsedBlocks : [];
      return {
        id: String(post.id),
        title: post.title,
        body: buildArticleBody(post, blocks),
        date: post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : new Date(post.created_at).toISOString().slice(0, 10),
      };
    }));
  } catch (error) {
    console.error('Get news error', error);
    return res.status(500).json({ message: 'Unable to fetch news' });
  }
});

router.get('/news/posts', authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT p.*, JSON_ARRAYAGG(JSON_OBJECT('id', b.id, 'type', b.type, 'content', b.content, 'imageUrl', b.image_url, 'order', b.order)) AS blocks FROM news_posts p LEFT JOIN news_blocks b ON b.news_post_id = p.id GROUP BY p.id ORDER BY p.created_at DESC`);
    return res.json(rows.map((post) => {
      const parsedBlocks = typeof post.blocks === 'string' ? JSON.parse(post.blocks) : post.blocks;
      const blocks = Array.isArray(parsedBlocks) ? parsedBlocks.filter((block) => block?.id != null) : [];
      return {
        ...post, blocks, createdAt: post.created_at, publishedAt: post.published_at,
        startDate: post.start_date, endDate: post.end_date,
      };
    }));
  } catch (error) {
    console.error('Get news posts error', error);
    return res.status(500).json({ message: 'Unable to fetch news posts' });
  }
});

router.post('/news/posts', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  const { title, summary, status = 'draft', author = 'HR Team', startDate, endDate, city, sector, blocks = [] } = req.body || {};
  if (!title || !['draft', 'published'].includes(status)) return res.status(400).json({ message: 'Title and valid status are required' });
  const slug = String(req.body.slug || title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) return res.status(400).json({ message: 'Invalid slug or date format' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(`INSERT INTO news_posts (title, slug, status, author, summary, published_at, start_date, end_date, city, sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [title.trim(), slug, status, author, summary || null, status === 'published' ? (startDate || new Date()) : null, startDate || null, endDate || null, city || null, sector || null]);
    for (const [index, block] of blocks.entries()) {
      if (!['heading', 'paragraph', 'image'].includes(block.type) || !block.content) continue;
      await connection.query('INSERT INTO news_blocks (news_post_id, type, content, image_url, `order`) VALUES (?, ?, ?, ?, ?)', [result.insertId, block.type, block.content, block.imageUrl || null, index + 1]);
    }
    await connection.commit();
    return res.status(201).json({ id: String(result.insertId), title: title.trim(), slug, status, author, summary: summary || '', createdAt: new Date().toISOString(), publishedAt: status === 'published' ? (startDate || new Date().toISOString()) : undefined, startDate, endDate, city, sector, blocks });
  } catch (error) {
    await connection.rollback();
    console.error('Create news post error', error);
    return res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'A news post with this slug already exists' : 'Unable to create news post' });
  } finally { connection.release(); }
});

export default router;
