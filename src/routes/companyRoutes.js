const express = require('express');
const router = express.Router();
const { Company, Team, User } = require('../models');
const { authenticateToken, checkRole, checkCompanyAccess } = require('../middleware/auth');

// Get all companies (admin only)
router.get('/', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    try {
        const companies = await Company.findAll({
            include: [
                {
                    model: Team,
                    include: [User]
                }
            ]
        });
        res.json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Error fetching companies' });
    }
});

// Create new company
router.post('/', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    try {
        const { name, description } = req.body;
        const company = await Company.create({
            name,
            description
        });
        res.status(201).json(company);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Error creating company' });
    }
});

// Get company by ID
router.get('/:companyId', authenticateToken, checkCompanyAccess, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.companyId, {
            include: [
                {
                    model: Team,
                    include: [User]
                }
            ]
        });
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        res.json(company);
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({ error: 'Error fetching company' });
    }
});

// Get company teams
router.get('/:companyId/teams', authenticateToken, checkCompanyAccess, async (req, res) => {
    try {
        const teams = await Company.findByPk(req.params.companyId, {
            include: [
                {
                    model: Team,
                    include: [User]
                }
            ]
        });
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching company teams' });
    }
});

// Get company members
router.get('/:companyId/members', authenticateToken, checkCompanyAccess, async (req, res) => {
    try {
        const members = await Company.findByPk(req.params.companyId, {
            include: [
                {
                    model: User,
                    as: 'members'
                }
            ]
        });
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching company members' });
    }
});

// Update company
router.put('/:companyId', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    try {
        const { name, description } = req.body;
        const company = await Company.findByPk(req.params.companyId);
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        await company.update({
            name: name || company.name,
            description: description || company.description
        });
        
        res.json(company);
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ error: 'Error updating company' });
    }
});

// Delete company
router.delete('/:companyId', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.companyId);
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        await company.destroy();
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: 'Error deleting company' });
    }
});

module.exports = router; 