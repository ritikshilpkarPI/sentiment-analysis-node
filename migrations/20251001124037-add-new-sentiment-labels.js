'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Sentiments', 'label', {
      type: Sequelize.ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'SARCASTIC', 'RELIGIOUS', 'FUNNY', 'PROVOCATIVE'),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to the original ENUM values if the migration is rolled back
    await queryInterface.changeColumn('Sentiments', 'label', {
      type: Sequelize.ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL'),
      allowNull: true
    });
  }
};
