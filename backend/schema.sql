CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  department text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS zoho_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  icon text,
  category text,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (name, role_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES users(id),
  target_id uuid REFERENCES users(id),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
('Admin', 'Full system access and audit visibility'),
('HR', 'Human resources and employee management'),
('Sales', 'Customer relationship and sales pipeline management'),
('Support', 'Customer support ticket management'),
('Finance', 'Accounting, invoicing, and financial reporting')
ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name, description) VALUES
('zoho.people.access', 'Access Zoho People'), ('zoho.crm.access', 'Access Zoho CRM'),
('zoho.desk.access', 'Access Zoho Desk'), ('zoho.books.access', 'Access Zoho Books'),
('zoho.dashboard.access', 'Access Zoho One Dashboard'), ('admin.users.manage', 'Manage users and roles'),
('admin.roles.manage', 'Manage roles and permissions'), ('admin.audit.view', 'View audit logs')
ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name = CASE r.name
  WHEN 'HR' THEN 'zoho.people.access' WHEN 'Sales' THEN 'zoho.crm.access'
  WHEN 'Support' THEN 'zoho.desk.access' WHEN 'Finance' THEN 'zoho.books.access' END
WHERE r.name <> 'Admin' ON CONFLICT DO NOTHING;
INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT v.name, v.description, v.url, v.icon, v.category, r.id FROM (VALUES
('Zoho People', 'Manage employee records, attendance, leave, and HR workflows', 'https://people.zoho.com', 'Users', 'HR', 'HR'),
('Zoho CRM', 'Track leads, deals, contacts, and sales pipelines', 'https://crm.zoho.com', 'Briefcase', 'Sales', 'Sales'),
('Zoho Desk', 'Manage customer support tickets and knowledge base', 'https://desk.zoho.com', 'Headphones', 'Support', 'Support'),
('Zoho Books', 'Accounting, invoicing, expenses, and financial reports', 'https://books.zoho.com', 'BookOpen', 'Finance', 'Finance'),
('Zoho One Dashboard', 'Central dashboard for Zoho applications', 'https://one.zoho.com', 'LayoutDashboard', 'Admin', 'Admin')
) AS v(name, description, url, icon, category, role_name) JOIN roles r ON r.name = v.role_name
ON CONFLICT (name, role_id) DO NOTHING;
