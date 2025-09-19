'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tweets', 'grokAnalysis', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Tweets', 'crossValidation', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Tweets', 'analysisConfidence', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Tweets', 'consensusResult', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Tweets', 'newsValidation', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Tweets', 'grokAnalysis');
    await queryInterface.removeColumn('Tweets', 'crossValidation');
    await queryInterface.removeColumn('Tweets', 'analysisConfidence');
    await queryInterface.removeColumn('Tweets', 'consensusResult');
    await queryInterface.removeColumn('Tweets', 'newsValidation');
  }
};
