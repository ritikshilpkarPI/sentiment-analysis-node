const jwt = require('jsonwebtoken');
const { User, Team } = require('../models');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Set user data directly from token
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            companyId: decoded.companyId,
            teamId: decoded.teamId
        };
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.log({aa: req.user.role});
        

        // COMPANY_ADMIN has full access
        if (req.user.role === 'COMPANY_ADMIN') {
            return next();
        }

        // Check if user's role is in the allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
};

const checkCompanyAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const companyId = req.params.companyId || req.body.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // COMPANY_ADMIN has full access to their company
        if (req.user.role === 'COMPANY_ADMIN' && req.user.companyId === companyId) {
            return next();
        }

        // TEAM_ADMIN and TEAM_MEMBER can only view their company
        if (req.user.companyId === companyId) {
            // For write operations, only COMPANY_ADMIN is allowed
            if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.user.role !== 'COMPANY_ADMIN') {
                return res.status(403).json({ error: 'Access denied. Only company admins can modify company data.' });
            }
            return next();
        }

        res.status(403).json({ error: 'Access denied to this company' });
    } catch (error) {
        res.status(500).json({ error: 'Error checking company access' });
    }
};

const checkTeamAccess = async (req, res, next) => {
    try {
        const teamId = req.params.teamId;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!teamId) {
            return res.status(400).json({ error: 'Team ID is required' });
        }

        // Find the team
        const team = await Team.findOne({
            where: { id: teamId }
        });

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // COMPANY_ADMIN has full access to teams in their company
        if (user.role === 'COMPANY_ADMIN' && team.companyId === user.companyId) {
            return next();
        }

        // TEAM_ADMIN has access to their own team
        if (user.role === 'TEAM_ADMIN' && user.teamId === teamId) {
            // For write operations, check specific permissions
            if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
                // TEAM_ADMIN can add members and keywords
                if (req.path.includes('/members') || req.path.includes('/keywords')) {
                    return next();
                }
                return res.status(403).json({ error: 'Access denied. Team admins can only manage members and keywords.' });
            }
            return next();
        }

        // TEAM_MEMBER can only view their team
        if (user.role === 'TEAM_MEMBER' && user.teamId === teamId) {
            if (['GET'].includes(req.method)) {
                return next();
            }
            return res.status(403).json({ error: 'Access denied. Team members can only view data.' });
        }

        res.status(403).json({ error: 'Access denied to this team' });
    } catch (error) {
        console.error('Team access check error:', error);
        res.status(500).json({ error: 'Error checking team access' });
    }
};

const checkUserRoleUpdateAccess = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Find the user to update
        const userToUpdate = await User.findByPk(userId);
        if (!userToUpdate) {
            return res.status(404).json({ error: 'User not found' });
        }

        // COMPANY_ADMIN has full access to update any user in their company
        if (user.role === 'COMPANY_ADMIN') {
            // If user is updating their own role, allow it
            // if (user.id === userId) {
            //     return next();
            // }
            // // If user is updating someone else, check if they're in the same company
            // if (userToUpdate.companyId === user.companyId) {
            //     return next();
            // }
           return next();
        }

        // TEAM_ADMIN can only update users in their team
        if (user.role === 'TEAM_ADMIN' && userToUpdate.teamId === user.teamId) {
            return next();
        }

        res.status(403).json({ error: 'Access denied to update this user' });
    } catch (error) {
        console.error('User role update access check error:', error);
        res.status(500).json({ error: 'Error checking user role update access' });
    }
};

module.exports = {
    authenticateToken,
    checkRole,
    checkCompanyAccess,
    checkTeamAccess,
    checkUserRoleUpdateAccess
}; 