const express = require("express"),
  db = require("../../sequelize"),
  app = express();

module.exports = (app) => {
  app.route("/api/proposals/").post(async function (req, res) {
    const { title, proposal, userIds, thematicLineId } = req.body;

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
        thematicLineId: thematicLineId, // Agregar thematicLineId
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
        },
        {
          model: db.thematicLines,
          as: 'thematicLine', // Asegúrate de que este es el alias correcto
          attributes: ['id', 'thematicLine'] // Especifica los atributos que necesitas de thematicLines
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
    const { Sequelize } = require("sequelize"); // Import Sequelize for fn and col if needed, though Op is not used here directly

    if (!userId) {
      return res.status(400).json({ error: "El parámetro 'userId' es requerido." });
    }

    try {
      const userWithProposals = await db.users.findByPk(userId, {
        attributes: [], // We don't need the main user's attributes, just their proposals
        include: [{
          model: db.proposals,
          attributes: ['id', 'title', 'proposal', 'state', 'editable', 'createdAt', 'updatedAt'], // ...existing code...
          through: { attributes: [] }, // Don't include junction table attributes here
          include: [{ // Include users (authors) for each proposal
            model: db.users, // Users associated with the proposal
            attributes: ['id'], // Only fetch ID from users table directly
            through: { attributes: [] }, // Don't include junction table attributes here
            include: [{ // Include sigecos for each author to get name and lastname
              model: db.sigecos,
              attributes: ['name', 'lastname']
            }]
          },
          {
            model: db.thematicLines,
            as: 'thematicLine', // Asegúrate de que este es el alias correcto
            attributes: ['id', 'thematicLine'] // Especifica los atributos que necesitas de thematicLines
          }]
        }]
      });

      if (!userWithProposals) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const proposalsData = userWithProposals.proposals || [];
      
      const result = proposalsData.map(proposal => {
        const otherAuthors = proposal.users // 'users' is the default alias from Proposals.belongsToMany(Users)
          .filter(author => author.id !== parseInt(userId)) // Exclude the requesting user
          .map(author => {
            let fullname = "Nombre no disponible";
            if (author.sigeco && author.sigeco.name && author.sigeco.lastname) {
              fullname = `${author.sigeco.name} ${author.sigeco.lastname}`;
            }
            return {
              id: author.id,
              fullname: fullname
            };
          });
        
        return {
          id: proposal.id,
          title: proposal.title,
          proposal: proposal.proposal,
          thematicLine: proposal.thematicLine.thematicLine,
          state: proposal.state,
          editable: proposal.editable,
          createdAt: proposal.createdAt,
          updatedAt: proposal.updatedAt,
          authors: otherAuthors
        };
      });

      res.json(result);

    } catch (error) {
      console.error("Error al obtener las propuestas del usuario:", error);
      res.status(500).json({ error: "Error interno del servidor al obtener las propuestas." });
    }
  });

  app.route("/api/proposals/:id").put(async function (req, res) {
    const { id } = req.params;
    const { title, proposal, userIds, thematicLineId } = req.body;

    if (!id) {
      return res.status(400).json({ error: "El parámetro 'id' de la propuesta es requerido." });
    }

    if (!title && !proposal && !userIds) {
      return res.status(400).json({ error: "Se requiere al menos un campo para actualizar: 'title', 'proposal' o 'userIds'." });
    }

    if (userIds && (!Array.isArray(userIds) || userIds.length === 0)) {
      return res.status(400).json({ error: "Si se proporciona 'userIds', debe ser un array con al menos un ID de usuario." });
    }

    try {
      const proposalInstance = await db.proposals.findByPk(id);

      if (!proposalInstance) {
        return res.status(404).json({ error: "Propuesta no encontrada." });
      }

      if (title) {
        proposalInstance.title = title;
      }
      if (proposal) {
        proposalInstance.proposal = proposal;
      }
      if (thematicLineId) {
        proposalInstance.thematicLineId = thematicLineId; // Actualizar thematicLineId si se proporciona
      }

      // Guardar cambios de title y proposal
      await proposalInstance.save();

      // Actualizar asociaciones de usuarios si se proporcionan userIds
      if (userIds) {
        const users = await db.users.findAll({ where: { id: userIds } });
        if (users.length !== userIds.length) {
          // Consider if a partial update is acceptable or if this should be an atomic transaction
          return res.status(400).json({ error: "Uno o más IDs de usuario proporcionados no son válidos. La propuesta no fue actualizada con nuevos usuarios." });
        }
        await proposalInstance.setUsers(users); // Replaces all existing associations

        // Forzar la actualización de updatedAt para la propuesta principal
        // ya que setUsers() modifica la tabla de unión pero no necesariamente la propuesta misma.
        // Usamos instance.update() para asegurar la actualización del timestamp.
        await proposalInstance.update({ updatedAt: new Date() });
      }

      const updatedProposalWithAssociations = await db.proposals.findByPk(id, {
        include: [{
          model: db.users,
          attributes: ['id', 'email'],
          through: { attributes: [] }
        },
        {
          model: db.thematicLines,
          as: 'thematicLine',
          attributes: ['id', 'thematicLine']
        }]
      });

      res.json(updatedProposalWithAssociations);

    } catch (error) {
      console.error("Error al actualizar la propuesta:", error);
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Error interno del servidor al actualizar la propuesta." });
    }
  });

  
    
}
