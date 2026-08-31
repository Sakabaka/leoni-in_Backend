import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
});

const dbName = process.env.DB_NAME || 'leoni_in';

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
await connection.query(`USE \`${dbName}\`;`);

const schema = `
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  matricule VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  department VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  state VARCHAR(255),
  sector VARCHAR(255),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  author VARCHAR(255) NOT NULL,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  city VARCHAR(255) NULL,
  sector VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS news_blocks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  news_post_id INT NOT NULL,
  type ENUM('heading', 'paragraph', 'image') NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT NULL,
  \`order\` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (news_post_id) REFERENCES news_posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  type ENUM('fiche_paie', 'attestation_salaire', 'attestation_travail') NOT NULL,
  reason TEXT,
  attachment_name VARCHAR(255),
  attachment_mime VARCHAR(100),
  attachment_size INT UNSIGNED,
  attachment_data MEDIUMBLOB,
  status ENUM('pending', 'in_progress', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_request_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  sender ENUM('employee', 'hr') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  category ENUM('message_hr', 'reclamation') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  sender ENUM('employee', 'hr') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  platform VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
`;

await connection.query(schema);

const seed = `
INSERT INTO employees (matricule, name, password_hash, role, department, phone, state, sector, address_line_1, address_line_2)
VALUES
  ('1234', 'John Doe', '$2a$10$5f.Tbs36wMqSkNbiqsDylemOnkpTJwFVJ1dP6i2pj1TCiyictLjim', 'user', 'Engineering', '+21600000001', 'Sousse', 'EX1', '12 Main Street', 'Sousse, Tunisia'),
  ('9999', 'Sara Admin', '$2a$10$lxuKbvtmtet.ivb3B47LIOvc4g2Ae76alVpBFcQtiXSrrdAqLhB0C', 'admin', 'Human Resources', '+21600000002', 'Tunis', 'HQ', '42 Avenue de la République', 'Tunis, Tunisia')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO news_posts (title, slug, status, author, summary, published_at, start_date, end_date, city, sector)
VALUES
  ('Welcome to the new HR portal', 'welcome-to-the-new-hr-portal', 'published', 'HR Team', 'A quick overview of the new employee experience and benefits available this quarter.', '2026-08-02 09:05:00', '2026-08-01', '2026-12-31', 'Sousse', 'EX1')
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO news_blocks (news_post_id, type, content, image_url, \`order\`)
SELECT id, 'heading', 'A better employee experience', NULL, 1 FROM news_posts WHERE slug = 'welcome-to-the-new-hr-portal'
ON DUPLICATE KEY UPDATE content = VALUES(content);

INSERT INTO news_blocks (news_post_id, type, content, image_url, \`order\`)
SELECT id, 'paragraph', 'We have added a new employee self-service portal to make access to documents, policies, and announcements faster and easier for everyone.', NULL, 2 FROM news_posts WHERE slug = 'welcome-to-the-new-hr-portal'
ON DUPLICATE KEY UPDATE content = VALUES(content);

INSERT INTO news_blocks (news_post_id, type, content, image_url, \`order\`)
SELECT id, 'image', 'Office update', 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80', 3 FROM news_posts WHERE slug = 'welcome-to-the-new-hr-portal'
ON DUPLICATE KEY UPDATE content = VALUES(content);
`;

await connection.query(seed);
console.log(`Database ${dbName} initialized successfully.`);
await connection.end();
