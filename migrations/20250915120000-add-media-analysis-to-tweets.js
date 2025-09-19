'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tweets', 'mediaAnalysis', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('Tweets', 'mediaRelevance', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Tweets', 'mediaDescription', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Also fix the Topic name field to be TEXT instead of VARCHAR(255)
    await queryInterface.changeColumn('Topics', 'name', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Tweets', 'mediaAnalysis');
    await queryInterface.removeColumn('Tweets', 'mediaRelevance');
    await queryInterface.removeColumn('Tweets', 'mediaDescription');

    // Revert Topic name field back to STRING
    await queryInterface.changeColumn('Topics', 'name', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
