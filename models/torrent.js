module.exports = function(sequelize, DataTypes) {

  var Torrent = sequelize.define('mediacenterSettings', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    guid: {
      type: DataTypes.STRING,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    magnetLink: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'magnet_link'
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    asset: {
      type: DataTypes.STRING,
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'content_type'
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'file_path'
    },
    transmissionId: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
      field: 'transmission_id'
    },
    torrentName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    origin: {
      type: DataTypes.STRING,
      allowNull: true
    },
    torrentFileLink: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'torrent_file_link'
    },
    percentDone: {
      type: 'DOUBLE',
      allowNull: true,
      field: 'percent_done'
    },
    renamedPath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'renamed_path'
    },
    size: {
      type: DataTypes.INTEGER(11),
      allowNull: true
    },
    seeds: {
      type: DataTypes.INTEGER(11),
      allowNull: true
    },
    dateStarted: {
      type: DataTypes.DATE,
      allowNull: true
    },
    dateFinished: {
      type: DataTypes.DATE,
      allowNull: true
    },
    automatedSearchConfigId: {
      type: DataTypes.INTEGER(11),
      field: 'automated_search_config_id',
      allowNull: true,
      references: {
        model: 'automatedSearchConfig',
        key: 'id'
      }
    }
  }, {
    underscored: true,
    timestamps: false,
    tableName: 'mediacenter_settings'
  });

  return Torrent;
}
