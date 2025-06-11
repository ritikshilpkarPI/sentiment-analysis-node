const express = require('express');
const router = express.Router();
const { Team, User, Keyword, Company, Result } = require('../models');
const { authenticateToken, checkRole, checkTeamAccess, checkUserRoleUpdateAccess } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Get all teams
router.get('/', authenticateToken, async (req, res) => {
    try {
        const teams = await Team.findAll({
            include: [
                { model: User },
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] }
                }
            ]
        });
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Error fetching teams' });
    }
});

// Create new team
router.post('/', authenticateToken, checkRole(['COMPANY_ADMIN']), async (req, res) => {
    try {
        const { name, description, companyId, keywords } = req.body;
        
        // Validate companyId
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // Check if company exists
        const company = await Company.findByPk(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        // Create team
        const team = await Team.create({
            name,
            description,
            companyId: companyId,
            isActive: true
        });

        // Add keywords if provided
        if (keywords && keywords.length > 0) {
            const keywordPromises = keywords.map(async (keywordText) => {
                // Find or create keyword
                const [keyword] = await Keyword.findOrCreate({
                    where: { keyword: keywordText },
                    defaults: { isActive: true }
                });
                // Add to team
                await team.addKeyword(keyword);
                return keyword;
            });
            await Promise.all(keywordPromises);
        }

        // Fetch team with associations
        const createdTeam = await Team.findByPk(team.id, {
            include: [
                { model: User },
                { model: Company },
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] }
                }
            ]
        });

        res.status(201).json(createdTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Error creating team' });
    }
});

// Get all users across teams
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{ model: Team }]
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Create user with team and company details
router.post('/users', authenticateToken, checkRole(['COMPANY_ADMIN']), async (req, res) => {
    try {
        const { email, password, name, role, companyId, teamId, canAddKeywords } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            name,
            role: role || 'USER',
            companyId: companyId.id,
            teamId: teamId.id,
            canAddKeywords: canAddKeywords || false
        });

        // Generate token
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                companyId: user.companyId,
                teamId: user.teamId,
                canAddKeywords: user.canAddKeywords
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Get team members
router.get('/:teamId/users', authenticateToken, checkTeamAccess, async (req, res) => {
    try {
        const team = await Team.findByPk(req.params.teamId, {
            include: [{ model: User }]
        });
        
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        res.json(team.Users);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: 'Error fetching team members' });
    }
});

// Add member to team
router.post('/:teamId/members', authenticateToken, checkRole(['COMPANY_ADMIN']), checkTeamAccess, async (req, res) => {
    try {
        const { userId } = req.body;
        const teamId = req.params.teamId;
        
        // Check if team exists
        const team = await Team.findByPk(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Check if user exists
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user's team
        await user.update({ teamId: team.id });
        
        // Fetch updated user with team details
        const updatedUser = await User.findByPk(userId, {
            include: [
                { model: Team },
                { model: Company }
            ]
        });

        res.json({
            message: 'Member added successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Error adding member' });
    }
});

// Remove member from team
router.delete('/:teamId/members/:userId', authenticateToken, checkTeamAccess, async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        
        // Check if team exists
        const team = await Team.findByPk(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Check if user exists
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is a member of the team
        if (user.teamId !== teamId) {
            return res.status(400).json({ error: 'User is not a member of this team' });
        }

        // Remove user from team
        await user.update({ teamId: null });
        
        // Fetch updated team with members
        const updatedTeam = await Team.findByPk(teamId, {
            include: [
                { model: User },
                { model: Company },
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] },
                    where: { isActive: true }
                }
            ]
        });

        res.json({
            message: 'Member removed successfully',
            team: updatedTeam
        });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Error removing member' });
    }
});

// Remove member from team
router.delete('/:teamId/users/:userId', authenticateToken, checkRole(['COMPANY_ADMIN']), checkTeamAccess, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.teamId !== req.params.teamId) {
            return res.status(400).json({ error: 'User is not a member of this team' });
        }

        await user.update({ teamId: null });
        
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Error removing member' });
    }
});

// Add keyword to team
router.post('/:teamId/keywords', authenticateToken, checkTeamAccess, async (req, res) => {
    try {
        const { keyword } = req.body;
        const teamId = req.params.teamId;

        // Check if team exists and is active
        const team = await Team.findOne({
            where: { 
                id: teamId,
                isActive: true
            }
        });
        if (!team) {
            return res.status(404).json({ error: 'Team not found or inactive' });
        }

        // Find or create keyword
        const [keywordRecord] = await Keyword.findOrCreate({
            where: { keyword },
            defaults: { isActive: true }
        });

        // Add keyword to team
        await team.addKeyword(keywordRecord);

        // Fetch updated team with keywords
        const updatedTeam = await Team.findByPk(teamId, {
            include: [
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] },
                    where: { isActive: true }
                }
            ]
        });

        res.status(201).json({
            message: 'Keyword added successfully',
            team: updatedTeam
        });
    } catch (error) {
        console.error('Error adding keyword:', error);
        res.status(500).json({ error: 'Error adding keyword' });
    }
});

// Get team by ID
router.get('/:teamId', authenticateToken, checkTeamAccess, async (req, res) => {
    try {
        const team = await Team.findByPk(req.params.teamId, {
            include: [
                { model: User },
                { model: Company },
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] },
                    where: { isActive: true }
                }
            ]
        });
        
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        res.json(team);
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: 'Error fetching team' });
    }
});

// Update team
router.put('/:teamId', authenticateToken, checkRole(['COMPANY_ADMIN']), checkTeamAccess, async (req, res) => {
    try {
        const { name, description, keywords, isActive, companyId } = req.body;
        const teamId = req.params.teamId;

        // Find team with all associations
        const team = await Team.findByPk(teamId, {
            include: [
                { model: User },
                { model: Company },
                { model: Keyword }
            ]
        });
        
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // If companyId is provided, validate it
        if (companyId) {
            const company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }
        }

        // Update team details
        await team.update({
            name: name || team.name,
            description: description || team.description,
            isActive: isActive !== undefined ? isActive : team.isActive,
            companyId: companyId || team.companyId
        });

        // Update keywords if provided
        if (keywords) {
            // Remove all existing keyword associations
            await team.setKeywords([]);
            
            // Add new keywords
            const keywordPromises = keywords.map(async (keywordText) => {
                const [keyword] = await Keyword.findOrCreate({
                    where: { keyword: keywordText },
                    defaults: { isActive: true }
                });
                await team.addKeyword(keyword);
                return keyword;
            });
            await Promise.all(keywordPromises);
        }

        // Fetch updated team with all associations
        const updatedTeam = await Team.findByPk(teamId, {
            include: [
                { model: User },
                { model: Company },
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] },
                    where: { isActive: true }
                }
            ]
        });

        res.json({
            message: 'Team updated successfully',
            team: updatedTeam
        });
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ 
            error: 'Error updating team',
            details: error.message 
        });
    }
});

// Delete team
router.delete('/:teamId', authenticateToken, checkRole(['COMPANY_ADMIN']), checkTeamAccess, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        
        // Find team with all associations
        const team = await Team.findByPk(teamId, {
            include: [
                { model: User },
                { model: Keyword },
                { model: Result }
            ]
        });
        
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // First, remove all keyword associations
        await team.setKeywords([]);

        // Update users to remove team association
        await User.update(
            { teamId: null },
            { where: { teamId: teamId } }
        );

        // Delete associated results
        await Result.destroy({
            where: { teamId: teamId }
        });

        // Finally delete the team
        await team.destroy();

        res.json({ 
            message: 'Team and associated records deleted successfully',
            deletedTeamId: teamId
        });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ 
            error: 'Error deleting team',
            details: error.message 
        });
    }
});

// Delete user
router.delete('/users/:userId', authenticateToken, checkRole(['COMPANY_ADMIN']), async (req, res) => {
    try {
        const userId = req.params.userId;

        // Find user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user
        await user.destroy();

        res.json({
            message: 'User deleted successfully',
            deletedUserId: userId
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            error: 'Error deleting user',
            details: error.message 
        });
    }
});

// Update user
router.put('/users/:userId', authenticateToken, checkRole(['COMPANY_ADMIN']), async (req, res) => {
    try {
        const userId = req.params.userId;
        const { email, password, name, role, companyId, teamId, canAddKeywords } = req.body;

        // Find user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        // Prepare update data
        const updateData = {
            email: email || user.email,
            name: name || user.name,
            role: role || user.role,
            companyId: companyId?.id || user.companyId,
            teamId: teamId?.id || user.teamId,
            canAddKeywords: canAddKeywords !== undefined ? canAddKeywords : user.canAddKeywords
        };

        // Only update password if provided
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        // Update user
        await user.update(updateData);

        // Fetch updated user with associations
        const updatedUser = await User.findByPk(userId, {
            include: [
                { model: Team },
                { model: Company }
            ]
        });

        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            error: 'Error updating user',
            details: error.message 
        });
    }
});

// Delete keyword from team
router.delete('/:teamId/keywords/:keywordId', authenticateToken, checkTeamAccess, async (req, res) => {
    try {
        const { teamId, keywordId } = req.params;

        // Check if team exists
        const team = await Team.findByPk(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Check if keyword exists
        const keyword = await Keyword.findByPk(keywordId);
        if (!keyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }

        // Remove keyword from team
        await team.removeKeyword(keyword);

        // Fetch updated team with keywords
        const updatedTeam = await Team.findByPk(teamId, {
            include: [
                { 
                    model: Keyword,
                    attributes: ['id', 'keyword', 'createdAt', 'isActive'],
                    through: { attributes: [] },
                    where: { isActive: true }
                }
            ]
        });

        res.json({
            message: 'Keyword removed successfully',
            team: updatedTeam
        });
    } catch (error) {
        console.error('Error removing keyword:', error);
        res.status(500).json({ error: 'Error removing keyword' });
    }
});

// Update user role in team
router.patch('/users/:userId/role', authenticateToken, checkUserRoleUpdateAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // Find the user to update
        const userToUpdate = await User.findByPk(userId);
        if (!userToUpdate) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the role
        await userToUpdate.update({ role });

        res.json({
            message: 'User role updated successfully',
            user: userToUpdate
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Error updating user role' });
    }
});

// Update user permissions in team
router.patch('/users/:userId/permissions', authenticateToken, checkUserRoleUpdateAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { canAddKeywords } = req.body;

        // Find the user to update
        const userToUpdate = await User.findByPk(userId);
        if (!userToUpdate) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the permissions
        await userToUpdate.update({ canAddKeywords });

        res.json({
            message: 'User permissions updated successfully',
            user: userToUpdate
        });
    } catch (error) {
        console.error('Error updating user permissions:', error);
        res.status(500).json({ error: 'Error updating user permissions' });
    }
});

module.exports = router; 