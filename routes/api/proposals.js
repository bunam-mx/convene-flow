const express = require("express"),
  db = require("../../sequelize"),
  app = express();

module.exports = (app) => {
  app.route("/api/proposals/").post(async function (req, res) {
    const { title, proposal, userIds } = req.body;

    if (!title || !proposal) {
      return res.status(400).json({ error: "Los campos 'title' y 'proposal' son requeridos." });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "Se requiere un array 'userIds' con al menos un ID de usuario." });
    }

    try {
      // Crear la propuesta
      const newProposal = await db.proposals.create({
        title: title,
        proposal: proposal,
      });

      // Asociar los usuarios a la propuesta
      if (newProposal && userIds && userIds.length > 0) {
        // Verificar que los usuarios existan antes de asociarlos (opcional pero recomendado)
        const users = await db.users.findAll({ where: { id: userIds } });
        if (users.length !== userIds.length) {
          // Rollback o manejo de error si algún usuario no existe
          // Por simplicidad, aquí solo enviaremos un error, pero podrías querer eliminar la propuesta creada.
          await newProposal.destroy(); // Eliminar la propuesta si los usuarios no son válidos
          return res.status(400).json({ error: "Uno o más IDs de usuario no son válidos." });
        }
        await newProposal.setUsers(userIds); // Sequelize maneja la tabla de unión
      }

      // Opcional: Devolver la propuesta con los usuarios asociados
      const proposalWithAssociations = await db.proposals.findByPk(newProposal.id, {
        include: [{
          model: db.users,
          attributes: ['id', 'email'], // Especifica qué atributos de usuario devolver
          through: { attributes: [] } // No incluir atributos de la tabla de unión
        }]
      });

      res.status(201).json(proposalWithAssociations);

    } catch (error) {
      console.error("Error al crear la propuesta:", error);
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Error interno del servidor al crear la propuesta." });
    }
  });

  app.route("/api/proposals/:userId").get(async function (req, res) {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "El parámetro 'userId' es requerido." });
    }

    try {
      const userWithProposals = await db.users.findByPk(userId, {
        include: [{
          model: db.proposals,
          attributes: ['id', 'title', 'proposal', 'createdAt', 'updatedAt'], // Campos de la propuesta a devolver
          through: { attributes: [] } // No incluir atributos de la tabla de unión
        }]
      });

      if (!userWithProposals) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      // userWithProposals.proposals contendrá el array de propuestas asociadas
      res.json(userWithProposals.proposals || []); 

    } catch (error) {
      console.error("Error al obtener las propuestas del usuario:", error);
      res.status(500).json({ error: "Error interno del servidor al obtener las propuestas." });
    }
  });
    
}
