# SubTrack - Subscription Tracker

## Overview

SubTrack is a web-based subscription tracking application that helps users manage and understand all of their recurring subscriptions in one place. This is an MVP-focused product with manual entry only (no browser extensions or bank integrations).

**Core Features:**
- Track all subscriptions with service name, cost, billing cycle, and status
- View total monthly and yearly spending
- Get reminders before renewals
- Categorize subscriptions for better organization
- User preferences for currency and timezone

**Advanced Features (Feb 2026):**
- **Spending Insights**: Category breakdown, top subscriptions, personal vs shared spending analysis
- **Trend Analysis**: Historical spending charts showing monthly/yearly trends
- **Smart Alerts**: Automatic notifications for price increases, unused subscriptions, high spending warnings, trial expirations
- **Cost History**: Automatic tracking of price changes with timeline view
- **Calendar View**: Monthly billing calendar showing upcoming renewal dates
- **Multi-Currency Support**: Track subscriptions in different currencies with user's preferred display currency
- **Household/Shared Subscriptions**: Tag subscriptions as personal or shared with breakdown view
- **Spending Limits**: Set monthly budget limits with visual progress tracking and alerts

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
- Pages in `client/src/pages/` (dashboard, settings, landing, login, signup, not-found)
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
- `server/auth.ts` - Authentication setup and routes
- `server/storage.ts` - Database access layer with interface abstraction
- `server/db.ts` - Database connection setup

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `drizzle-kit push` command

**Database Tables:**
- `users` - User accounts with email, password (hashed), OAuth provider info
- `sessions` - Session storage for authentication
- `subscriptions` - User subscription records (with originalCurrency, sharingType, lastViewedAt)
- `categories` - Subscription categories (default + user-created)
- `userPreferences` - User settings (currency, timezone, displayName, monthlySpendingLimit)
- `cost_history` - Tracks price changes for subscriptions over time
- `monthly_snapshots` - Aggregated monthly spending data for trend analysis
- `alerts` - Smart alerts for price increases, unused subscriptions, spending warnings

### Authentication (Portable - works anywhere)
- **Email/Password**: bcrypt password hashing, Passport.js local strategy
- **Google OAuth**: Passport.js Google strategy (optional)
- **GitHub OAuth**: Passport.js GitHub strategy (optional)
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Implementation**: `server/auth.ts`

**Auth Routes:**
- POST `/api/auth/signup` - Create new account with email/password
- POST `/api/auth/login` - Login with email/password
- POST `/api/auth/logout` - End session
- GET `/api/auth/user` - Get current authenticated user
- GET `/api/auth/google` - Start Google OAuth flow
- GET `/api/auth/github` - Start GitHub OAuth flow

## Deployment / Portability

This app is fully portable and can be deployed anywhere. To deploy on another platform:

1. **Database**: Use any PostgreSQL provider (Neon, Supabase, Railway, Render, AWS RDS)
2. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string (required)
   - `SESSION_SECRET` - Random secret string for session encryption (required)
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - For Google OAuth (optional)
   - `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` - For GitHub OAuth (optional)
3. **Run migrations**: `npm run db:push`
4. **Start server**: `npm run dev` (development) or build and run for production

## External Dependencies

### Third-Party Services
- **PostgreSQL**: Primary database (DATABASE_URL environment variable required)
- **Google OAuth**: Optional - requires Google Cloud Console credentials
- **GitHub OAuth**: Optional - requires GitHub Developer App credentials

### Key NPM Packages
- **UI**: @radix-ui/* primitives, lucide-react icons, react-icons, class-variance-authority
- **Data**: drizzle-orm, @tanstack/react-query, zod
- **Auth**: passport, passport-local, passport-google-oauth20, passport-github2, bcryptjs, express-session, connect-pg-simple
- **Utilities**: date-fns for date manipulation

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption

### Environment Variables Optional (for OAuth)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
