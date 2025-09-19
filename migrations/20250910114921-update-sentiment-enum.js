'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
prompt     // Add new sentiment values to the existing enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Sentiments_label" ADD VALUE 'SARCASTIC';
      ALTER TYPE "enum_Sentiments_label" ADD VALUE 'RELIGIOUS';
      ALTER TYPE "enum_Sentiments_label" ADD VALUE 'FUNNY';
      ALTER TYPE "enum_Sentiments_label" ADD VALUE 'PROVOCATIVE';
    `);
  },

  async down (queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type and updating all references
    // For now, we'll leave the values as they won't cause issues
    console.log('Note: Cannot remove enum values in PostgreSQL. Manual intervention required if needed.');
  }
};
