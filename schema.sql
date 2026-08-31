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
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
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
-- Short-lived, single-use Gmail/SMS 2FA challenges. Only the code hash is stored.
CREATE TABLE IF NOT EXISTS two_factor_challenges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  method ENUM('sms', 'email') NOT NULL,
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
  attachment_name VARCHAR(255),
  attachment_mime VARCHAR(100),
  attachment_size INT UNSIGNED,
  attachment_data MEDIUMBLOB,
  status ENUM('pending', 'in_progress', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS document_request_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  sender ENUM('employee', 'hr') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE,
  INDEX idx_request_id (request_id),
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

-- Expo push tokens for background notifications.
CREATE TABLE IF NOT EXISTS push_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  platform VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_push_employee (employee_id)
);
