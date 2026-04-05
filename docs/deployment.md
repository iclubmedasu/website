# Deployment Guide
 
## Services Required
 
| Service | Purpose | Provider |
|---------|---------|---------|
| Backend + Database | API and PostgreSQL | Railway |
| Members Portal | Frontend app | Netlify or Railway |
| Public Website | Public Next.js site | Netlify or Railway |
 
## Environment Variables
 
See .env.example for all required variables with descriptions.
 
## Railway Deployment (Backend)
 
1. Create a new Railway project
2. Add a PostgreSQL database service
3. Deploy the backend service from the /backend folder
4. Set all environment variables from .env.example
5. Run database migrations: prisma migrate deploy
 
## Netlify Deployment (Frontend)
 
1. Connect your GitHub repository
2. Set build command: pnpm --filter members-portal build
3. Set publish directory: members-portal/dist
4. Set environment variables

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
