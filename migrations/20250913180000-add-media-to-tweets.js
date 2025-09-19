'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tweets', 'mediaImages', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
    
    await queryInterface.addColumn('Tweets', 'mediaVideos', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Tweets', 'mediaImages');
    await queryInterface.removeColumn('Tweets', 'mediaVideos');
  }
};
