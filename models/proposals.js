module.exports = (sequelize, DataTypes) => {
  const Proposals = sequelize.define("proposals", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    proposal: {
      type: DataTypes.TEXT, // Adecuado para ~500 palabras
      allowNull: false,
    },
    state: {
      type: DataTypes.ENUM('Enviado', 'En proceso', 'Aceptado', 'Aceptado con recomendaciones', 'Rechazado'),
      allowNull: false,
      defaultValue: 'Enviado',
    },
    editable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    thematicLineId: { // Add this foreign key
      type: DataTypes.INTEGER,
      allowNull: true, // Or false, depending on whether it's mandatory
      references: {
        model: 'thematicLines', // Name of the target table
        key: 'id'
      }
    }
    // Sequelize añade createdAt y updatedAt por defecto
  });

  Proposals.associate = (models) => {
    Proposals.belongsToMany(models.users, {
      through: 'userProposals', // Nombre de la tabla de unión
      foreignKey: 'proposalId',
      otherKey: 'userId',
      timestamps: false
    });
    Proposals.belongsTo(models.thematicLines, { // Add this association
      foreignKey: 'thematicLineId',
      as: 'thematicLine'
    });
  };

  return Proposals;
};
