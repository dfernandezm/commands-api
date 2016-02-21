module.exports = function(sequelize, DataTypes) {

  var TransmissionSettings = sequelize.define('transmissionSettings', {
     id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'id'
    },
    description: {
      type: DataTypes.STRING,
      field: 'description',
      allowNull: true
    },
    ipOrHost: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'ip_or_host'
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    baseDownloadsDir: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'base_downloads_dir'
    }
  }, {
    underscored: true,
    timestamps: false,
    tableName: 'transmission_settings'
  });

  return TransmissionSettings;
}
