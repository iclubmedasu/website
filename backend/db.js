require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const globalForPrisma = globalThis;

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Create adapter
const adapter = new PrismaPg(pool);

// Create PrismaClient with the adapter
const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = { prisma };