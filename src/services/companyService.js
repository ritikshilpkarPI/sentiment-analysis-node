const { Company, Team, User } = require('../models');

class CompanyService {
    static async createCompany(companyData) {
        return await Company.create(companyData);
    }

    static async getCompanyById(id) {
        return await Company.findByPk(id, {
            include: [
                {
                    model: Team,
                    include: [
                        {
                            model: User,
                            attributes: { exclude: ['password'] }
                        }
                    ]
                }
            ]
        });
    }

    static async getAllCompanies() {
        return await Company.findAll({
            include: [
                {
                    model: Team,
                    include: [
                        {
                            model: User,
                            attributes: { exclude: ['password'] }
                        }
                    ]
                }
            ]
        });
    }

    static async getCompanyTeams(companyId) {
        const company = await Company.findByPk(companyId, {
            include: [
                {
                    model: Team,
                    include: [
                        {
                            model: User,
                            attributes: { exclude: ['password'] }
                        }
                    ]
                }
            ]
        });
        return company ? company.Teams : [];
    }

    static async getCompanyMembers(companyId) {
        return await User.findAll({
            where: { companyId },
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: Team,
                    as: 'primaryTeam'
                }
            ]
        });
    }

    static async updateCompany(id, updateData) {
        const company = await Company.findByPk(id);
        if (!company) {
            throw new Error('Company not found');
        }
        return await company.update(updateData);
    }

    static async deleteCompany(id) {
        const company = await Company.findByPk(id);
        if (!company) {
            throw new Error('Company not found');
        }
        await company.destroy();
        return { message: 'Company deleted successfully' };
    }
}

module.exports = CompanyService; 