'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    var p = queryInterface.addColumn(
            'job',
            'guid',
            {
              type: Sequelize.STRING,
              allowNull: false
            }
         );

    return p.then(function() {
       queryInterface.describeTable('job').then(function(attrs) {
         console.log("Job attrs: ", attrs);
       })
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
