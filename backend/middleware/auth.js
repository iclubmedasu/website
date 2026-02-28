const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ADMINISTRATION_TEAM_NAME = 'Administration';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Fallback: accept token from query string (for browser-opened download links)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

/** Require user to be developer or in Administration team. Use after authenticateToken. */
const requireAdmin = async (req, res, next) => {
    if (req.user.isDeveloper) return next();
    if (!req.user.memberId) return res.status(403).json({ error: 'Admin access required' });
    const adminMembership = await prisma.teamMember.findFirst({
        where: {
            memberId: req.user.memberId,
            isActive: true,
            team: { name: ADMINISTRATION_TEAM_NAME }
        }
    });
    if (!adminMembership) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };