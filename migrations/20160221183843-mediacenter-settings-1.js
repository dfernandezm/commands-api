'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
     var p1 = queryInterface.addColumn(
             'mediacenter_settings',
             'subtitles_enabled',
             {
               type: Sequelize.BOOLEAN,
               allowNull: true
             }
          );
    var p2 = queryInterface.addColumn(
            'mediacenter_settings',
            'preferred_language',
            {
              type: Sequelize.STRING,
              allowNull: true
            }
         );

    return p1.then(function(data) {
           return p2.then(function(data2) {
             queryInterface.describeTable('mediacenter_settings').then(function(attrs) {
               console.log("Attrs ", attrs);
             })
           });
         });
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
  }
};
