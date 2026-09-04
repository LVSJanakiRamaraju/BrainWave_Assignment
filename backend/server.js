require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const port = Number(process.env.PORT || 4000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const schema = fs.readFileSync(require('path').join(__dirname, 'schema.sql'), 'utf8');

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());

const publicUser = (row) => ({ id: row.id, email: row.email, full_name: row.full_name, department: row.department, status: row.status, created_at: row.created_at });
const signToken = (user) => jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
const errorMessage = (error) => error instanceof Error ? error.message : 'Request failed';

async function rolesFor(userId) {
  const { rows } = await pool.query('SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 ORDER BY r.name', [userId]);
  return rows;
}
async function isAdmin(userId) { return (await rolesFor(userId)).some((role) => role.name === 'Admin'); }
async function audit(action, actorId, targetId, details) { await pool.query('INSERT INTO audit_logs (action, actor_id, target_id, details) VALUES ($1, $2, $3, $4)', [action, actorId, targetId || null, details || null]); }
async function auth(req, res, next) {
  try {
    const value = req.headers.authorization || '';
    const token = value.startsWith('Bearer ') ? value.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [claims.sub]);
    if (!rows[0] || rows[0].status !== 'active') return res.status(401).json({ error: 'Invalid or suspended account' });
    req.user = rows[0];
    req.roles = await rolesFor(rows[0].id);
    next();
  } catch (error) { res.status(401).json({ error: 'Invalid or expired token' }); }
}
function adminOnly(req, res, next) { if (!req.roles.some((role) => role.name === 'Admin')) return res.status(403).json({ error: 'Admin access required' }); next(); }

app.get('/health', async (_req, res) => { try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); } catch (error) { res.status(503).json({ status: 'error', error: errorMessage(error) }); } });
app.post('/api/setup', async (_req, res) => { try { await pool.query(schema); res.json({ message: 'Database schema and seed data ready' }); } catch (error) { res.status(500).json({ error: errorMessage(error) }); } });

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, fullName, department } = req.body;
  if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('INSERT INTO users (email, password_hash, full_name, department) VALUES ($1, $2, $3, $4) RETURNING *', [email.toLowerCase(), await bcrypt.hash(password, 12), fullName, department || 'Unassigned']);
    const user = rows[0];
    const role = (await client.query("SELECT id FROM roles WHERE lower(name) = lower($1) AND name <> 'Admin'", [department || ''])).rows[0];
    if (role) await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, role.id]);
    await client.query('INSERT INTO audit_logs (action, actor_id, details) VALUES ($1, $2, $3)', ['user.signed_up', user.id, { email: user.email, department: user.department }]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Account created successfully' });
  } catch (error) { await client.query('ROLLBACK'); res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'An account with that email already exists' : errorMessage(error) }); } finally { client.release(); }
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  if (rows[0].status !== 'active') return res.status(403).json({ error: 'This account is suspended' });
  const roles = await rolesFor(rows[0].id); await audit('user.signed_in', rows[0].id, null, null);
  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]), profile: { ...publicUser(rows[0]), email: rows[0].email }, roles });
});
app.get('/api/auth/me', auth, async (req, res) => res.json({ user: publicUser(req.user), profile: { ...publicUser(req.user), email: req.user.email }, roles: req.roles }));

app.get('/api/apps', auth, async (req, res) => {
  const roleIds = req.roles.map((role) => role.id);
  const { rows } = await pool.query('SELECT DISTINCT name, description, url, icon, category FROM zoho_applications WHERE role_id = ANY($1::uuid[]) ORDER BY name', [roleIds]);
  res.json({ applications: rows, roles: req.roles.map((role) => role.name), zoho_connected: Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN) });
});
app.post('/api/apps/launch', auth, async (req, res) => {
  const roleIds = req.roles.map((role) => role.id);
  const { rows } = await pool.query('SELECT name, url FROM zoho_applications WHERE name = $1 AND role_id = ANY($2::uuid[])', [req.body.app_name, roleIds]);
  if (!rows[0]) { await audit('zoho.access.denied', req.user.id, null, { requested_app: req.body.app_name }); return res.status(403).json({ error: 'Access denied: your role does not permit this application' }); }
  let connected = false;
  if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN) {
    try { const response = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: process.env.ZOHO_REFRESH_TOKEN, client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' }) }); connected = response.ok && Boolean((await response.json()).access_token); } catch (_) { connected = false; }
  }
  await audit('zoho.access.granted', req.user.id, null, { app_name: rows[0].name });
  res.json({ app_name: rows[0].name, url: rows[0].url, zoho_connected: connected });
});

app.get('/api/admin/bootstrap', auth, adminOnly, async (_req, res) => {
  const [roles, permissions, users, logs] = await Promise.all([
    pool.query('SELECT * FROM roles ORDER BY name'), pool.query('SELECT * FROM permissions ORDER BY name'),
    pool.query('SELECT u.*, COALESCE(json_agg(r ORDER BY r.name) FILTER (WHERE r.id IS NOT NULL), \'[]\') AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id GROUP BY u.id ORDER BY u.created_at DESC'),
    pool.query('SELECT l.*, actor.full_name AS actor_name, target.full_name AS target_name FROM audit_logs l LEFT JOIN users actor ON actor.id = l.actor_id LEFT JOIN users target ON target.id = l.target_id ORDER BY l.created_at DESC LIMIT 100')
  ]);
  res.json({ roles: roles.rows, permissions: permissions.rows, users: users.rows.map((row) => ({ ...publicUser(row), roles: row.roles })), auditLogs: logs.rows.map((row) => ({ ...row, actor_profile: row.actor_name ? { full_name: row.actor_name } : null, target_profile: row.target_name ? { full_name: row.target_name } : null })) });
});
app.post('/api/admin/users/:id/roles/:roleId/toggle', auth, adminOnly, async (req, res) => { const { id, roleId } = req.params; const existing = await pool.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2', [id, roleId]); if (existing.rowCount) { await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [id, roleId]); await audit('user.role.removed', req.user.id, id, { role_id: roleId }); } else { await pool.query('INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)', [id, roleId, req.user.id]); await audit('user.role.assigned', req.user.id, id, { role_id: roleId }); } res.json({ message: 'Role updated' }); });
app.patch('/api/admin/users/:id/status', auth, adminOnly, async (req, res) => { const result = await pool.query("UPDATE users SET status = CASE WHEN status = 'active' THEN 'suspended' ELSE 'active' END WHERE id = $1 RETURNING status", [req.params.id]); if (!result.rows[0]) return res.status(404).json({ error: 'User not found' }); await audit(result.rows[0].status === 'suspended' ? 'user.suspended' : 'user.activated', req.user.id, req.params.id, { new_status: result.rows[0].status }); res.json({ status: result.rows[0].status }); });

app.use((error, _req, res, _next) => res.status(500).json({ error: errorMessage(error) }));
if (require.main === module) app.listen(port, () => console.log(`BrainWave API listening on port ${port}`));
module.exports = app;
