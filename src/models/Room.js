// models/Room.js
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define("Room", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bar_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sport: {
      type: DataTypes.STRING,
      defaultValue: "Fútbol",
    },
    tournament: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    team_home: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    team_away: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    match_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    prediction_close_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    entry_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_pool: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    room_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "active", "finished", "cancelled"),
      defaultValue: "pending",
    },
    current_score_home: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    current_score_away: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    result_score_home: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    result_score_away: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: "rooms",
    underscored: true,
  });

  Room.associate = (models) => {
    Room.belongsTo(models.User, {
      foreignKey: "bar_id",
      as: "bar",
    });
  };

  return Room;
};