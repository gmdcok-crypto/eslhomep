CREATE TABLE IF NOT EXISTS inquiries (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  company VARCHAR(120) NULL,
  phone VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX idx_inquiries_created_at (created_at),
  INDEX idx_inquiries_category (category),
  INDEX idx_inquiries_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
