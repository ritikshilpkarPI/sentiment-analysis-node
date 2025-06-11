const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserService = require('./userService');

class AuthService {
    static async register(userData) {
        try {
            // Check if user already exists
            const existingUser = await UserService.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('User already exists');
            }

            // Create user (password will be hashed by model hooks)
            const user = await UserService.createUser(userData);

            // Generate JWT token
            const token = this.generateToken(user);

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    companyId: user.companyId,
                    teamId: user.teamId
                },
                token
            };
        } catch (error) {
            throw error;
        }
    }

    static async login(email, password) {
        try {
            // Find user
            const user = await UserService.findByEmail(email);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Debug log
            console.log('Attempting login for:', email);

            // Check password using model's comparePassword method
            const isMatch = await user.comparePassword(password);
            console.log('Password match result:', isMatch);

            if (!isMatch) {
                throw new Error('Invalid credentials');
            }

            // Generate JWT token
            const token = this.generateToken(user);

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    companyId: user.companyId,
                    teamId: user.teamId
                },
                token
            };
        } catch (error) {
            console.error('Login error:', error.message);
            throw error;
        }
    }

    static generateToken(user) {
        return jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                companyId: user.companyId,
                teamId: user.teamId
            },
            process.env.JWT_SECRET || 'default-secret-key-for-development',
            { expiresIn: '24h' }
        );
    }

    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-for-development');
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    static async getCurrentUser(userId) {
        try {
            const user = await UserService.findById(userId);
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.Company,
                team: user.Team
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AuthService; 