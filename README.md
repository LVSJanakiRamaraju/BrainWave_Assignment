# BrainWave Employee Portal

A React employee portal with JWT authentication, PostgreSQL-backed RBAC, audit logging, and server-side Zoho One integration. Employees use portal credentials only; Zoho credentials remain on the API server.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, JWT
- Database: PostgreSQL, including Neon
- Integration: Zoho OAuth v2 through the Express API

## Local setup

```powershell
npm install
cd backend
npm install
cd ..
copy .env.example .env
```

Set the values in `.env`, then initialize the schema and seed roles/apps:

```powershell
node backend/server.js
curl -Method POST http://localhost:4000/api/setup
```

Run the frontend in another terminal:

```powershell
npm run dev
```

The frontend uses `VITE_API_URL=http://localhost:4000/api`. The API reads `DATABASE_URL`, `JWT_SECRET`, and the Zoho variables server-side.

## Production

Deploy `backend/` to Render, Railway, Fly.io, or another Node host. Configure these API environment variables there:

```env
DATABASE_URL=your-postgresql-connection-string
JWT_SECRET=your-long-random-secret
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REFRESH_TOKEN=your-zoho-refresh-token
FRONTEND_URL=https://your-frontend.example.com
PORT=4000
```

Configure the frontend build with:

```env
VITE_API_URL=https://your-api.example.com/api
```

Run `POST /api/setup` once after deployment to create and seed the database. Do not put database, JWT, or Zoho secrets in `VITE_*` variables because Vite exposes those values to the browser.

## Features

- Email/password signup and login
- Automatic department role assignment for HR, Sales, Support, and Finance
- Admin-only user status and role management
- Permission and audit log views
- Role-restricted Zoho People, CRM, Desk, Books, and One Dashboard links
- Server-side Zoho token refresh with no token returned to the browser

## Test accounts

Create accounts through the signup screen. Select `HR`, `Sales`, `Support`, or `Finance` as the department to receive that role. Assign `Admin` explicitly after the first account exists.

## Security

The `.env` file is ignored by Git. Rotate any database, JWT, or Zoho credentials that have been shared outside your deployment secret manager.
