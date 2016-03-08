module.exports = function(sequelize, DataTypes) {

  var MediacenterSettings = sequelize.define('mediacenterSettings', {
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
    baseDownloadsPath: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'base_downloads_path'
    },
    baseLibraryPath: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'base_library_path'
    },
    isRemote: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'is_remote'
    },
    xbmcHostOrIp: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'xbmc_host_or_ip'
    },
    processingTempPath: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'processing_temp_path'
    },
    transcodeTempPath: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'transcode_temp_path'
    },
    preferredLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'preferred_language'
    },
    subtitlesEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'subtitles_enabled'
    }

  }, {
    underscored: true,
    timestamps: false,
    tableName: 'mediacenter_settings'
  });

  return MediacenterSettings;
}
