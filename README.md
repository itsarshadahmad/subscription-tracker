# SubTrack (Portable + Cloud Ready)

SubTrack is a full-stack TypeScript app (React + Express + PostgreSQL) that runs locally and on most cloud providers.

## Resources
**[Project Screenshots](./Screenshots.md)**

**[About Project](./Document.md)**

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Quick Start (Localhost)

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the template:

```bash
cp .env.example .env
```

3. Set required values in `.env`:

- `DATABASE_URL`
- `SESSION_SECRET`

4. Apply database schema:

```bash
npm run db:push
```

5. Start development server:

```bash
npm run dev
```

App runs on `http://localhost:5000` by default.

## Production (VM / PaaS)

```bash
npm run build
npm run start
```

Set environment variables through your cloud provider dashboard or deployment config.

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Long random secret string

### Optional

- `PORT`: Defaults to `5000`
- `NODE_ENV`: Defaults to `production` when running built output
- `TRUST_PROXY`: Defaults to `1` (recommended behind load balancers)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Optional Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: Optional GitHub OAuth

## Docker

Build and run locally:

```bash
docker build -t subtrack .
docker run --env-file .env -p 5000:5000 subtrack
```

The Docker image is multi-stage and uses `node:20-alpine` to keep runtime size smaller.

## Kubernetes

Kubernetes manifests are in `k8s/`:

- `k8s/configmap.yaml`
- `k8s/secret.example.yaml`
- `k8s/deployment.yaml`
- `k8s/service.yaml`
- `k8s/ingress.yaml`

Apply them (after updating image and host values):

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.example.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```
