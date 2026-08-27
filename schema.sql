-- Leoni-in HR Portal Database Schema
-- MySQL 8.0+

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  matricule VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  department VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  state VARCHAR(255),
  sector VARCHAR(255),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_matricule (matricule),
  INDEX idx_role (role)
);

-- Short-lived, single-use 2FA challenges. Only the code hash is stored.
CREATE TABLE IF NOT EXISTS two_factor_challenges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  method ENUM('sms', 'whatsapp', 'email') NOT NULL,
  destination VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_2fa_employee (employee_id),
  INDEX idx_2fa_expiry (expires_at)
);

-- News posts table
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
  sector VARCHAR(255) NULL,
  INDEX idx_status (status),
  INDEX idx_published_at (published_at),
  INDEX idx_start_date (start_date),
  INDEX idx_end_date (end_date)
);

-- News blocks (content blocks within a news post)
CREATE TABLE IF NOT EXISTS news_blocks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  news_post_id INT NOT NULL,
  type ENUM('heading', 'paragraph', 'image') NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT NULL,
  `order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (news_post_id) REFERENCES news_posts(id) ON DELETE CASCADE,
  INDEX idx_news_post_id (news_post_id),
  INDEX idx_order (`order`)
);

-- Document requests table
CREATE TABLE IF NOT EXISTS document_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  type ENUM('fiche_paie', 'attestation_salaire', 'attestation_travail') NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  category ENUM('message_hr', 'reclamation') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  sender ENUM('employee', 'hr') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_created_at (created_at)
);

-- Seed data (optional)
INSERT INTO employees (matricule, name, password_hash, role, department, phone, state, sector, address_line_1, address_line_2)
VALUES
  ('1234', 'John Doe', '$2a$10$5f.Tbs36wMqSkNbiqsDylemOnkpTJwFVJ1dP6i2pj1TCiyictLjim', 'user', 'Engineering', '+21600000001', 'Sousse', 'EX1', '12 Main Street', 'Sousse, Tunisia'),
  ('9999', 'Sara Admin', '$2a$10$lxuKbvtmtet.ivb3B47LIOvc4g2Ae76alVpBFcQtiXSrrdAqLhB0C', 'admin', 'Human Resources', '+21600000002', 'Tunis', 'HQ', '42 Avenue de la République', 'Tunis, Tunisia')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO news_posts (title, slug, status, author, summary, published_at, start_date, end_date, city, sector)
VALUES
  ('Welcome to the new HR portal', 'welcome-to-the-new-hr-portal', 'published', 'HR Team', 'A quick overview of the new employee experience and benefits available this quarter.', '2026-08-02 09:05:00', '2026-08-01', '2026-12-31', 'Sousse', 'EX1')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Upgrade existing installations created before email and 2FA were added.
SET @email_column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'email'
);
SET @email_sql = IF(@email_column_exists = 0,
  'ALTER TABLE employees ADD COLUMN email VARCHAR(255) NULL AFTER phone',
  'SELECT 1'
);
PREPARE email_statement FROM @email_sql;
EXECUTE email_statement;
DEALLOCATE PREPARE email_statement;
