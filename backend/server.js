require('dotenv').config();
const express = require('express');
const { prisma } = require('./db');
const cors = require('cors');

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'loaded' : 'NOT LOADED');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'loaded' : 'NOT LOADED');
console.log('DEVELOPER_EMAIL:', process.env.DEVELOPER_EMAIL || 'dev@iclub.com');
console.log('GITHUB_STORAGE_REPO:', process.env.GITHUB_STORAGE_REPO ? 'loaded' : 'NOT SET');
console.log('GITHUB_STORAGE_TOKEN:', process.env.GITHUB_STORAGE_TOKEN ? 'loaded' : 'NOT SET');

const app = express();

// Enable CORS for local development
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware - Parse JSON bodies
app.use(express.json());

// Import routes
const routes = require('./routes');

// Use routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Database connection test endpoint
app.get('/test-db', async (req, res) => {
    try {
        await prisma.$connect();
        const count = await prisma.team.count();
        res.json({ status: 'connected', teamCount: count });
    } catch (error) {
        res.status(500).json({ status: 'failed', error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS enabled for http://localhost:5173`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the other process or use a different port.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});