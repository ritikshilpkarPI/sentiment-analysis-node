const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Company, Team } = require('../models');

class UserService {
    static async createUser(userData) {
        try {
            const user = await User.create(userData);
            return user;
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        try {
            const user = await User.findByPk(id, {
                include: [
                    {
                        model: Company,
                        attributes: ['id', 'name']
                    },
                    {
                        model: Team,
                        attributes: ['id', 'name']
                    }
                ]
            });

            if (!user) {
                throw new Error('User not found');
            }

            return user;
        } catch (error) {
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const user = await User.findOne({ 
                where: { email },
                raw: false // Ensure we get a model instance
            });
            return user;
        } catch (error) {
            throw error;
        }
    }

    static async updateUser(id, updateData) {
        try {
            const user = await User.findByPk(id);
            if (!user) {
                throw new Error('User not found');
            }

            await user.update(updateData);
            return user;
        } catch (error) {
            throw error;
        }
    }

    static async deleteUser(id) {
        try {
            const user = await User.findByPk(id);
            if (!user) {
                throw new Error('User not found');
            }

            await user.destroy();
            return true;
        } catch (error) {
            throw error;
        }
    }

    static async getCompanyUsers(companyId) {
        try {
            const users = await User.findAll({
                where: { companyId },
                include: [
                    {
                        model: Team,
                        attributes: ['id', 'name']
                    }
                ]
            });
            return users;
        } catch (error) {
            throw error;
        }
    }

    static async getTeamUsers(teamId) {
        try {
            const users = await User.findAll({
                where: { teamId },
                include: [
                    {
                        model: Company,
                        attributes: ['id', 'name']
                    }
                ]
            });
            return users;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = UserService; 