const { Team, User, Keyword, Company } = require('../models');

class TeamService {
    static async createTeam(teamData) {
        return await Team.create(teamData);
    }

    static async getTeamById(id) {
        return await Team.findByPk(id, {
            include: [
                {
                    model: User,
                    attributes: { exclude: ['password'] }
                },
                {
                    model: Keyword
                },
                {
                    model: Company
                }
            ]
        });
    }

    static async getAllTeams() {
        return await Team.findAll({
            include: [
                {
                    model: User,
                    attributes: { exclude: ['password'] }
                },
                {
                    model: Keyword
                },
                {
                    model: Company
                }
            ]
        });
    }

    static async getTeamMembers(teamId) {
        const team = await Team.findByPk(teamId, {
            include: [
                {
                    model: User,
                    attributes: { exclude: ['password'] }
                }
            ]
        });
        return team ? team.Users : [];
    }

    static async addMemberToTeam(teamId, userId) {
        const team = await Team.findByPk(teamId);
        const user = await User.findByPk(userId);

        if (!team || !user) {
            throw new Error('Team or user not found');
        }

        await team.addUser(user);
        return this.getTeamById(teamId);
    }

    static async removeMemberFromTeam(teamId, userId) {
        const team = await Team.findByPk(teamId);
        const user = await User.findByPk(userId);

        if (!team || !user) {
            throw new Error('Team or user not found');
        }

        await team.removeUser(user);
        return this.getTeamById(teamId);
    }

    static async addKeywordToTeam(teamId, keywordData) {
        const team = await Team.findByPk(teamId);
        if (!team) {
            throw new Error('Team not found');
        }

        const keyword = await Keyword.create(keywordData);
        await team.addKeyword(keyword);
        return this.getTeamById(teamId);
    }

    static async getTeamKeywords(teamId) {
        const team = await Team.findByPk(teamId, {
            include: [Keyword]
        });
        return team ? team.Keywords : [];
    }

    static async updateTeam(id, updateData) {
        const team = await Team.findByPk(id);
        if (!team) {
            throw new Error('Team not found');
        }
        return await team.update(updateData);
    }

    static async deleteTeam(id) {
        const team = await Team.findByPk(id);
        if (!team) {
            throw new Error('Team not found');
        }
        await team.destroy();
        return { message: 'Team deleted successfully' };
    }
}

module.exports = TeamService; 