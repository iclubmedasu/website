const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Import route modules
const authRoutes = require('./auth');
const teamsRoutes = require('./teams');
const membersRoutes = require('./members');
const teamMembersRoutes = require('./teamMembers');
const teamRolesRoutes = require('./teamRoles');
const teamSubteamsRoutes = require('./teamSubteams');
const roleHistoryRoutes = require('./roleHistory');
const alumniRoutes = require('./alumni');
const administrationRoutes = require('./administration');
const projectsRoutes = require('./projects');
const tasksRoutes = require('./tasks');

// Auth routes (public)
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use('/teams', authenticateToken, teamsRoutes);
router.use('/members', authenticateToken, membersRoutes);
router.use('/team-members', authenticateToken, teamMembersRoutes);
router.use('/team-roles', authenticateToken, teamRolesRoutes);
router.use('/team-subteams', authenticateToken, teamSubteamsRoutes);
router.use('/role-history', authenticateToken, roleHistoryRoutes);
router.use('/alumni', authenticateToken, alumniRoutes);
// Administration: any authenticated user can view (GET); write operations would require requireAdmin if added later
router.use('/administration', authenticateToken, administrationRoutes);
router.use('/projects', authenticateToken, projectsRoutes);
router.use('/tasks', authenticateToken, tasksRoutes);

// API documentation endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'iClub Management API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            members: '/api/members',
            teams: '/api/teams',
            teamRoles: '/api/team-roles',
            teamSubteams: '/api/team-subteams',
            teamMembers: '/api/team-members',
            roleHistory: '/api/role-history',
            alumni: '/api/alumni',
            administration: '/api/administration',
            projects: '/api/projects',
            tasks: '/api/tasks',
        }
    });
});

module.exports = router;