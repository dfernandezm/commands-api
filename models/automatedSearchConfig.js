module.exports = function(sequelize, DataTypes) {

  var AutomatedSearchConfig = sequelize.define('automatedSearchConfig', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    subtitlesEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'subtitles_enabled'
    },
    downloadStartsAutomatically: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'download_starts_automatically'
    },
    referenceDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'reference_date'
    },
    subtitlesLanguages: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'subtitles_languages'
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'content_type'
    },
    contentTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'content_title'
    },
    preferredQuality: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'preferred_quality'
    },
    preferredFormat: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'preferred_format'
    },
    contentLanguage: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'content_language'
    },
    lastCheckedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_checked_date'
    },
    lastDownloadDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_download_date'
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  },{
    classMethods: {
      associate: function(models) {
        AutomatedSearchConfig.belongsTo(models.torrent)
      }
    },
    underscored: true,
    timestamps: false,
    tableName: 'automated_search_config'
  });

  return AutomatedSearchConfig;
};
