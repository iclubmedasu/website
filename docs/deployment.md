# Deployment Guide
 
## Services Required
 
| Service | Purpose | Provider |
|---------|---------|---------|
| Backend + Database | API and PostgreSQL | Railway |
| Members Portal | Next.js Node.js app | Railway, Vercel, or Docker |
| Public Website | Public Next.js site | Netlify or Railway |
 
## Environment Variables
 
See .env.example for all required variables with descriptions.
 
## Railway Deployment (Backend)
 
1. Create a new Railway project
2. Add a PostgreSQL database service
3. Deploy the backend service from the /backend folder
4. Set all environment variables from .env.example
5. Run database migrations: prisma migrate deploy
 
## Members Portal Deployment (Next.js)
 
1. Build command: pnpm --filter members-portal build
2. Runtime: Node.js process (Next.js server)
3. App port: 3001
4. This app is not static files; it must run as a server process

## Members Portal Deployment Note

The members portal is now a Next.js app (not static files).
This means it requires a Node.js server to run.

Recommended deployment options:
1. Railway - supports Node.js apps natively (recommended)
2. Vercel - made by the Next.js team, zero config
3. Docker - use the provided Dockerfile

Note: Netlify can host Next.js apps but requires their
Next.js adapter. Railway or Vercel are simpler.

## Docker Deployment

### Local Docker Testing
```bash
# Start database and API
docker-compose up db api

# Build and run portal
docker-compose up portal
```

### Production Docker Build
```bash
# Build backend image
docker build -f backend/Dockerfile -t iclub-api .

# Build portal image
docker build -f members-portal/Dockerfile -t iclub-portal .
```

### Environment Variables for Docker
Copy .env.example to .env and fill in values before running.
The docker-compose.yml uses these values automatically.
 
## Post-Deployment Checklist
 
- [ ] Database migrations ran successfully
- [ ] Environment variables set correctly
- [ ] CORS configured for production domains
- [ ] JWT_SECRET is a strong random string
- [ ] HTTPS enabled on all services
