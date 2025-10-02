const db = require("../../sequelize");

const participantIncludeConfig = [
  {
    model: db.events,
    as: "events",
    attributes: ["id", "title", "date", "timeStart", "timeEnd", "order", "eventType", "placeId"],
    through: { attributes: ["order"] },
  },
];

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const formatParticipant = (participantInstance) => {
  if (!participantInstance) {
    return null;
  }

  const data = participantInstance.get ? participantInstance.get({ plain: true }) : participantInstance;
  const events = Array.isArray(data.events) ? data.events : [];

  data.events = events
    .map((event) => {
      const order = event?.eventParticipants?.order ?? event?.order ?? 0;
      return {
        id: event.id,
        title: event.title,
        date: event.date,
        timeStart: event.timeStart,
        timeEnd: event.timeEnd,
        eventType: event.eventType,
        placeId: event.placeId,
        order,
      };
    })
    .sort((a, b) => a.order - b.order);

  return data;
};

const fetchParticipantWithAssociations = async (id, transaction) => {
  const participant = await db.participants.findByPk(id, {
    include: participantIncludeConfig,
    transaction,
  });
  return formatParticipant(participant);
};

const fetchAllParticipants = async () => {
  const participants = await db.participants.findAll({
    include: participantIncludeConfig,
    order: [["name", "ASC"]],
  });
  return participants.map(formatParticipant);
};

const ensureEventExists = async (eventId, transaction) => {
  const event = await db.events.findByPk(eventId, { transaction });
  if (!event) {
    throw createHttpError(400, "The provided 'eventId' does not correspond to an existing event.");
  }
};

const computeNextParticipantOrder = async (eventId, transaction) => {
  const maxOrder = await db.eventParticipants.max("order", {
    where: { eventId },
    transaction,
  });

  if (Number.isInteger(maxOrder)) {
    return maxOrder + 1;
  }

  return 0;
};

module.exports = (app) => {
  app.get("/api/participants", async (req, res) => {
    try {
      const participants = await fetchAllParticipants();
      res.json(participants);
    } catch (error) {
      console.error("Error fetching participants:", error);
      res.status(500).json({ error: "Unable to fetch participants." });
    }
  });

  app.get("/api/participants/:id", async (req, res) => {
    try {
      const participant = await fetchParticipantWithAssociations(req.params.id);

      if (!participant) {
        return res.status(404).json({ error: "Participant not found." });
      }

      res.json(participant);
    } catch (error) {
      console.error("Error fetching participant:", error);
      res.status(500).json({ error: "Unable to fetch participant." });
    }
  });

  app.post("/api/participants", async (req, res) => {
    const { name, institution, bio } = req.body;

    if (!name) {
      return res.status(400).json({ error: "The field 'name' is required." });
    }

    try {
      const newParticipant = await db.participants.create({ name, institution, bio });
      const participantWithRelations = await fetchParticipantWithAssociations(newParticipant.id);
      res.status(201).json(participantWithRelations);
    } catch (error) {
      console.error("Error creating participant:", error);
      res.status(500).json({ error: "Unable to create participant." });
    }
  });

  app.put("/api/participants/:id", async (req, res) => {
    const { name, institution, bio } = req.body;

    if (name === undefined && institution === undefined && bio === undefined) {
      return res.status(400).json({
        error: "Provide at least one field to update: 'name', 'institution', or 'bio'.",
      });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const participant = await db.participants.findByPk(req.params.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!participant) {
          throw createHttpError(404, "Participant not found.");
        }

        if (name !== undefined) participant.name = name;
        if (institution !== undefined) participant.institution = institution;
        if (bio !== undefined) participant.bio = bio;

        await participant.save({ transaction });
      });

      const participantWithRelations = await fetchParticipantWithAssociations(req.params.id);
      res.json(participantWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error updating participant:", error);
      res.status(500).json({ error: "Unable to update participant." });
    }
  });

  app.delete("/api/participants/:id", async (req, res) => {
    try {
      const participant = await db.participants.findByPk(req.params.id);

      if (!participant) {
        return res.status(404).json({ error: "Participant not found." });
      }

      await participant.destroy();
      res.json({ message: "Participant deleted successfully.", participantId: participant.id });
    } catch (error) {
      console.error("Error deleting participant:", error);
      res.status(500).json({ error: "Unable to delete participant." });
    }
  });

  app.post("/api/participants/:id/events", async (req, res) => {
    const { id } = req.params;
    const { eventId, order } = req.body;

    const numericParticipantId = Number(id);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({ error: "The route parameter 'id' must be an integer." });
    }

    if (eventId === undefined) {
      return res.status(400).json({ error: "Provide 'eventId' to link this participant to an event." });
    }

    const numericEventId = Number(eventId);
    if (!Number.isInteger(numericEventId)) {
      return res.status(400).json({ error: "The field 'eventId' must be an integer." });
    }

    let orderProvided = false;
    let numericOrder = 0;
    if (order !== undefined) {
      orderProvided = true;
      numericOrder = Number(order);
      if (!Number.isInteger(numericOrder)) {
        return res.status(400).json({ error: "The field 'order' must be an integer if provided." });
      }
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const participant = await db.participants.findByPk(numericParticipantId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!participant) {
          throw createHttpError(404, "Participant not found.");
        }

        await ensureEventExists(numericEventId, transaction);

        const existingLink = await db.eventParticipants.findOne({
          where: {
            participantId: numericParticipantId,
            eventId: numericEventId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingLink) {
          throw createHttpError(409, "Participant is already linked to this event.");
        }

        const assignedOrder = orderProvided
          ? numericOrder
          : await computeNextParticipantOrder(numericEventId, transaction);

        await db.eventParticipants.create(
          {
            eventId: numericEventId,
            participantId: numericParticipantId,
            order: assignedOrder,
          },
          { transaction }
        );
      });

      const participantWithRelations = await fetchParticipantWithAssociations(numericParticipantId);
      res.status(201).json(participantWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error linking participant to event:", error);
      res.status(500).json({ error: "Unable to link participant to the event." });
    }
  });

  app.put("/api/participants/:id/events/:eventId", async (req, res) => {
    const { id, eventId } = req.params;
    const { order } = req.body;

    const numericParticipantId = Number(id);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({ error: "The route parameter 'id' must be an integer." });
    }

    if (order === undefined) {
      return res.status(400).json({ error: "Provide 'order' to update the participant ordering within the event." });
    }

    const numericOrder = Number(order);
    if (!Number.isInteger(numericOrder)) {
      return res.status(400).json({ error: "The field 'order' must be an integer." });
    }

    const numericEventId = Number(eventId);
    if (!Number.isInteger(numericEventId)) {
      return res.status(400).json({ error: "The route parameter 'eventId' must be an integer." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const participant = await db.participants.findByPk(numericParticipantId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!participant) {
          throw createHttpError(404, "Participant not found.");
        }

        const link = await db.eventParticipants.findOne({
          where: {
            participantId: numericParticipantId,
            eventId: numericEventId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this event.");
        }

        link.order = numericOrder;
        await link.save({ transaction });
      });

  const participantWithRelations = await fetchParticipantWithAssociations(numericParticipantId);
      res.json(participantWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error updating participant order for event:", error);
      res.status(500).json({ error: "Unable to update the participant order for this event." });
    }
  });

  app.delete("/api/participants/:id/events/:eventId", async (req, res) => {
    const { id, eventId } = req.params;

    const numericParticipantId = Number(id);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({ error: "The route parameter 'id' must be an integer." });
    }

    const numericEventId = Number(eventId);
    if (!Number.isInteger(numericEventId)) {
      return res.status(400).json({ error: "The route parameter 'eventId' must be an integer." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const participant = await db.participants.findByPk(numericParticipantId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!participant) {
          throw createHttpError(404, "Participant not found.");
        }

        const link = await db.eventParticipants.findOne({
          where: {
            participantId: numericParticipantId,
            eventId: numericEventId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this event.");
        }

        await link.destroy({ transaction });
      });

  const participantWithRelations = await fetchParticipantWithAssociations(numericParticipantId);
      res.json(participantWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error removing participant from event:", error);
      res.status(500).json({ error: "Unable to remove the participant from this event." });
    }
  });
};