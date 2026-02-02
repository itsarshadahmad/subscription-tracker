# SubTrack - Subscription Tracker

## Overview

SubTrack is a web-based subscription tracking application that helps users manage and understand all of their recurring subscriptions in one place. This is an MVP-focused product with manual entry only (no browser extensions or bank integrations).

**Core Features:**
- Track all subscriptions with service name, cost, billing cycle, and status
- View total monthly and yearly spending
- Get reminders before renewals
- Categorize subscriptions for better organization
- User preferences for currency and timezone

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` (dashboard, settings, landing, not-found)
- Reusable components in `client/src/components/`
- Custom hooks in `client/src/hooks/`
- Utility functions in `client/src/lib/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Build**: esbuild for production bundling

The server follows a modular structure:
- `server/index.ts` - Express app setup and middleware
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Database access layer with interface abstraction
- `server/db.ts` - Database connection setup

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `drizzle-kit push` command

**Database Tables:**
- `users` - User accounts (managed by Replit Auth)
- `sessions` - Session storage for authentication
- `subscriptions` - User subscription records
- `categories` - Subscription categories (default + user-created)
- `userPreferences` - User settings (currency, timezone, display name)

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Implementation**: Located in `server/replit_integrations/auth/`

The auth system uses Passport.js with OIDC strategy, storing sessions in the database and user information synced from Replit's identity provider.

## External Dependencies

### Third-Party Services
- **Replit Auth**: User authentication via OpenID Connect
- **PostgreSQL**: Primary database (DATABASE_URL environment variable required)

### Key NPM Packages
- **UI**: @radix-ui/* primitives, lucide-react icons, class-variance-authority
- **Data**: drizzle-orm, @tanstack/react-query, zod
- **Auth**: passport, openid-client, express-session, connect-pg-simple
- **Utilities**: date-fns for date manipulation

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `ISSUER_URL` - Replit OIDC issuer (defaults to https://replit.com/oidc)
- `REPL_ID` - Replit environment identifier