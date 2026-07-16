-- Create ROLES table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('super_admin'), ('funeral_admin'), ('teller')
ON CONFLICT (name) DO NOTHING;

-- Create USERS table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create FUNERALS table
CREATE TABLE IF NOT EXISTS funerals (
  id SERIAL PRIMARY KEY,
  funeral_id VARCHAR(20) UNIQUE NOT NULL,
  deceased_name VARCHAR(100) NOT NULL,
  photo VARCHAR(255),
  funeral_date DATE NOT NULL,
  venue VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'Upcoming',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create FUNERAL ASSIGNMENTS table
CREATE TABLE IF NOT EXISTS funeral_assignments (
  id SERIAL PRIMARY KEY,
  funeral_id INTEGER REFERENCES funerals(id),
  user_id INTEGER REFERENCES users(id),
  assigned_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create RECIPIENTS table
CREATE TABLE IF NOT EXISTS recipients (
  id SERIAL PRIMARY KEY,
  funeral_id INTEGER REFERENCES funerals(id),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create DONATIONS table
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  receipt_number VARCHAR(20) UNIQUE NOT NULL,
  funeral_id INTEGER REFERENCES funerals(id),
  donor_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  recipient_id INTEGER REFERENCES recipients(id),
  payment_method VARCHAR(50) NOT NULL,
  notes TEXT,
  teller_id INTEGER REFERENCES users(id),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create RECEIPTS table
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  receipt_number VARCHAR(20) UNIQUE NOT NULL,
  donation_id INTEGER REFERENCES donations(id),
  printed_at TIMESTAMP DEFAULT NOW(),
  printed_by INTEGER REFERENCES users(id)
);

-- Create BULK MESSAGE CAMPAIGNS table
CREATE TABLE IF NOT EXISTS message_campaigns (
  id SERIAL PRIMARY KEY,
  funeral_id INTEGER REFERENCES funerals(id),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create MESSAGE LOGS table
CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES message_campaigns(id),
  phone_number VARCHAR(20) NOT NULL,
  donor_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  sent_at TIMESTAMP
);

-- Create EDIT REQUESTS table (Teller proposes edits, Admin approves)
CREATE TABLE IF NOT EXISTS donation_edit_requests (
  id SERIAL PRIMARY KEY,
  donation_id INTEGER REFERENCES donations(id),
  requested_by INTEGER REFERENCES users(id),
  proposed_donor_name VARCHAR(100),
  proposed_phone_number VARCHAR(20),
  proposed_amount DECIMAL(10,2),
  proposed_recipient_id INTEGER REFERENCES recipients(id),
  proposed_payment_method VARCHAR(50),
  proposed_notes TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  reviewed_by INTEGER REFERENCES users(id),
  review_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- Create DONATION RECIPIENTS junction table (many-to-many)
CREATE TABLE IF NOT EXISTS donation_recipients (
  id SERIAL PRIMARY KEY,
  donation_id INTEGER REFERENCES donations(id),
  recipient_id INTEGER REFERENCES recipients(id)
);

-- Create AUDIT LOGS table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create SYSTEM SETTINGS table
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('organization_name', 'FDMS'),
  ('default_currency', 'GHS'),
  ('duplicate_check_minutes', '5'),
  ('backup_frequency_hours', '24')
  ('contact_phone', '+233 000 000 000')
ON CONFLICT (setting_key) DO NOTHING;

