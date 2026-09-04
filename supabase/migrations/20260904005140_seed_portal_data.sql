/*
# Seed Initial Portal Data

## Overview
Populates the database with the five required roles, permissions for each role,
role-permission mappings, and the Zoho application catalog.

## Seeded Data
1. **Roles**: Admin, HR, Sales, Support, Finance
2. **Permissions**: One per Zoho app access + admin management permissions
3. **Role-Permission mappings**: Each role gets its corresponding Zoho app permission; Admin gets all
4. **Zoho Applications**: 
   - Zoho People (HR)
   - Zoho CRM (Sales)
   - Zoho Desk (Support)
   - Zoho Books (Finance)
   - Zoho One Dashboard (Admin)
*/

-- ============================================================
-- SEED ROLES
-- ============================================================
INSERT INTO roles (name, description) VALUES
  ('Admin', 'Full system access — manage users, roles, permissions, and view audit logs'),
  ('HR', 'Human Resources — access to Zoho People for employee management'),
  ('Sales', 'Sales team — access to Zoho CRM for customer relationship management'),
  ('Support', 'Customer Support — access to Zoho Desk for ticket management'),
  ('Finance', 'Finance team — access to Zoho Books for accounting and invoicing')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, description) VALUES
  ('zoho.people.access', 'Access Zoho People application'),
  ('zoho.crm.access', 'Access Zoho CRM application'),
  ('zoho.desk.access', 'Access Zoho Desk application'),
  ('zoho.books.access', 'Access Zoho Books application'),
  ('zoho.dashboard.access', 'Access Zoho One Dashboard'),
  ('admin.users.manage', 'Manage portal users and their roles'),
  ('admin.roles.manage', 'Manage roles and permissions'),
  ('admin.audit.view', 'View system audit logs')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED ROLE-PERMISSION MAPPINGS
-- ============================================================
-- HR gets Zoho People access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'HR' AND p.name = 'zoho.people.access'
ON CONFLICT DO NOTHING;

-- Sales gets Zoho CRM access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Sales' AND p.name = 'zoho.crm.access'
ON CONFLICT DO NOTHING;

-- Support gets Zoho Desk access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Support' AND p.name = 'zoho.desk.access'
ON CONFLICT DO NOTHING;

-- Finance gets Zoho Books access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Finance' AND p.name = 'zoho.books.access'
ON CONFLICT DO NOTHING;

-- Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED ZOHO APPLICATIONS
-- ============================================================
INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT 'Zoho People', 'Manage employee records, attendance, leave, and HR workflows', 'https://people.zoho.com', 'Users', 'HR', id FROM roles WHERE name = 'HR'
ON CONFLICT DO NOTHING;

INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT 'Zoho CRM', 'Track leads, deals, contacts, and sales pipelines', 'https://crm.zoho.com', 'Briefcase', 'Sales', id FROM roles WHERE name = 'Sales'
ON CONFLICT DO NOTHING;

INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT 'Zoho Desk', 'Manage customer support tickets and knowledge base', 'https://desk.zoho.com', 'Headphones', 'Support', id FROM roles WHERE name = 'Support'
ON CONFLICT DO NOTHING;

INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT 'Zoho Books', 'Accounting, invoicing, expense tracking, and financial reports', 'https://books.zoho.com', 'BookOpen', 'Finance', id FROM roles WHERE name = 'Finance'
ON CONFLICT DO NOTHING;

INSERT INTO zoho_applications (name, description, url, icon, category, role_id)
SELECT 'Zoho One Dashboard', 'Central admin dashboard for all Zoho applications', 'https://one.zoho.com', 'LayoutDashboard', 'Admin', id FROM roles WHERE name = 'Admin'
ON CONFLICT DO NOTHING;