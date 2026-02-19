# SubTrack (Portable Deployment)

SubTrack is a full-stack TypeScript app (React + Express + PostgreSQL) that can run on any local environment and most cloud providers.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Quick Start (Local)

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the template:

```bash
cp .env.example .env
```

3. Fill in required environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`

4. Apply schema to your database:

```bash
npm run db:push
```

5. Run development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5000` by default.

## Production

Build and run:

```bash
npm run build
npm run start
```

You can override the port with `PORT`.

## Cloud Hosting Notes

This app is cloud-provider neutral. It works on platforms like Render, Railway, Fly.io, AWS, GCP, Azure, DigitalOcean, and others.

Set these environment variables in your provider:

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Long random string

### Optional

- `PORT`: Server port (provider usually injects this)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Enable Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: Enable GitHub OAuth

## Container Deployment

A production `Dockerfile` is included.

```bash
docker build -t subtrack .
docker run --env-file .env -p 5000:5000 subtrack
```
