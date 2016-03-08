
// Exported as the callback function that 'sequelize.import' requires
module.exports = function(sequelize, DataTypes) {

  var Job = sequelize.define('job', {
    jobId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'job_id'
    },
    guid: {
      type: DataTypes.STRING,
      field: 'guid',
      allowNull: false
    },
    jobType: {
      type: DataTypes.STRING,
      field: 'job_type',
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    freezeTableName: true // Model tableName will be the same as the model name
  });

  return Job;
}
