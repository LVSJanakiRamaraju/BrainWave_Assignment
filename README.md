# BrainWave Employee Portal — Custom Employee Portal with Zoho One Integration

A web-based employee portal with built-in authentication, Role-Based Access Control (RBAC), and secure Zoho One API integration. Employees authenticate through the portal and access only the Zoho applications permitted by their assigned role — they never need individual Zoho credentials.

## Features

- **Custom Authentication**: Email/password login and signup via Supabase Auth
- **Role-Based Access Control (RBAC)**: Five roles (Admin, HR, Sales, Support, Finance) with granular permissions
- **Zoho One Integration**: Backend proxy edge function manages OAuth tokens securely; employees never touch Zoho credentials
- **Conditional Dashboard**: Each role sees only its authorized Zoho applications
- **Admin Panel**: Manage users, assign roles, view permissions, and inspect audit logs
- **Audit Logging**: All administrative actions are tracked in an append-only audit trail
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Icons**: Lucide React
- **Zoho Integration**: Supabase Edge Function (Deno runtime) proxying Zoho OAuth v2

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` with employee info (name, department, status) |
| `roles` | Five roles: Admin, HR, Sales, Support, Finance |
| `permissions` | Granular permissions (e.g., `zoho.people.access`, `admin.users.manage`) |
| `user_roles` | Maps users to roles (many-to-many) |
| `role_permissions` | Maps roles to permissions (many-to-many) |
| `zoho_applications` | Zoho app catalog linked to roles |
| `audit_logs` | Append-only audit trail of admin actions |

### Role → Zoho App Mapping

| Role | Zoho Application |
|------|-----------------|
| Admin | Zoho One Dashboard |
| HR | Zoho People |
| Sales | Zoho CRM |
| Support | Zoho Desk |
| Finance | Zoho Books |

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@brainwave.com | Admin123! |
| HR | hr@brainwave.com | HR123! |
| Sales | sales@brainwave.com | Sales123! |
| Support | support@brainwave.com | Support123! |
| Finance | finance@brainwave.com | Finance123! |

## Local Development

```bash
# Install dependencies
npm install

# Configure Supabase (copy the example and fill in your project values)
copy .env.example .env

# Start the dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

The local `.env` file is ignored by Git. Never commit service-role keys, Zoho client secrets, or refresh tokens.

To run the Zoho Edge Function locally with the same values, use the Supabase CLI from the project directory:

```bash
supabase functions serve zoho-proxy --env-file .env
```

## Zoho OAuth Configuration

To connect the Zoho API integration:

1. Sign up for a [Zoho One free trial](https://www.zoho.com/one/)
2. Register an application in the [Zoho API Console](https://api-console.zoho.com)
3. Generate a `Client ID`, `Client Secret`, and `Refresh Token`
4. Configure these as edge function secrets:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REFRESH_TOKEN`

From the project directory, link the Supabase project and set the secrets without committing them:

```bash
supabase link --project-ref ssuvwhbyytpwdbyfonhy
supabase secrets set ZOHO_CLIENT_ID="your-client-id" ZOHO_CLIENT_SECRET="your-client-secret" ZOHO_REFRESH_TOKEN="your-refresh-token"
supabase functions deploy zoho-proxy
```

After deploying the migrations, create accounts with the department matching their role (`HR`, `Sales`, `Support`, or `Finance`). The database automatically assigns that non-Admin role. Assign `Admin` explicitly from the database or an existing administrator account.

The Zoho client secret and refresh token must remain in Supabase Edge Function secrets in production. They must never be added to `VITE_*` variables or sent to the browser. `VITE_*` values are bundled into the public frontend; `Deno.env.get("ZOHO_*")` is evaluated only inside the Edge Function.

The backend edge function (`zoho-proxy`) uses these credentials to automatically refresh access tokens server-side. Employees never see or enter Zoho credentials.

## Architecture

```
┌──────────────────────────────────────────────┐
│                   Frontend                    │
│  (React + Tailwind — Login, Dashboard, Admin) │
└──────────────────┬───────────────────────────┘
                   │ JWT Auth
┌──────────────────▼───────────────────────────┐
│              Supabase Backend                  │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Auth   │  │PostgreSQL│  │Edge Function │ │
│  │(JWT)    │  │  (RLS)   │  │(Zoho Proxy)  │ │
│  └─────────┘  └──────────┘  └──────┬───────┘ │
└─────────────────────────────────────┼────────┘
                                      │ OAuth v2
                               ┌──────▼───────┐
                               │  Zoho APIs   │
                               └──────────────┘
```

## RBAC Implementation

- **Database-level**: RLS policies on every table enforce ownership and admin checks
- **API-level**: The Zoho proxy edge function verifies the user's JWT, fetches their roles, and only returns apps permitted by those roles
- **UI-level**: The dashboard conditionally renders only authorized applications

## License

This project is built as part of the BrainWave assignment.
