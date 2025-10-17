const express = require("express"),
  db = require("../../sequelize"),
  app = express();

const eventIncludeConfig = [
  {
    model: db.places,
    as: "place",
  },
  {
    model: db.participants,
    as: "participants",
    attributes: ["id", "name", "institution", "bio"],
    through: { attributes: ["order", "isModerator"] },
  },
  {
    model: db.users,
    as: "attendees",
    attributes: ["id", "email", "userType", "attendanceMode"],
    through: { attributes: [] },
  },
];

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const formatEvent = (eventInstance) => {
  if (!eventInstance) {
    return null;
  }

  const data = eventInstance.get ? eventInstance.get({ plain: true }) : eventInstance;
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const attendees = Array.isArray(data.attendees) ? data.attendees : [];

  data.participants = participants
    .map((participant) => {
      const order = participant?.eventParticipants?.order ?? participant?.order ?? 0;
      const isModerator = participant?.eventParticipants?.isModerator ?? false;
      return {
        id: participant.id,
        name: participant.name,
        institution: participant.institution,
        bio: participant.bio,
        isModerator,
        order,
      };
    })
    .sort((a, b) => a.order - b.order);

  data.attendees = attendees.map((attendee) => {
    return {
      id: attendee.id,
      email: attendee.email,
      userType: attendee.userType,
      attendanceMode: attendee.attendanceMode,
    };
  });

  return data;
};

const fetchEventWithAssociations = async (id, transaction) => {
  const event = await db.events.findByPk(id, {
    include: eventIncludeConfig,
    transaction,
  });
  return formatEvent(event);
};

const fetchAllEvents = async () => {
  const events = await db.events.findAll({
    include: eventIncludeConfig,
    order: [
      ["date", "ASC"],
      ["timeStart", "ASC"],
      ["order", "ASC"],
    ],
  });
  return events.map(formatEvent);
};

const fetchEventsByDate = async (targetDate) => {
  const events = await db.events.findAll({
    where: { date: targetDate },
    include: eventIncludeConfig,
    order: [
      ["timeStart", "ASC"],
      ["order", "ASC"],
    ],
  });

  return events.map(formatEvent);
};

const fetchEventsByAttendee = async (userId) => {
  const includeConfig = eventIncludeConfig.map((include) => {
    if (include.as === "attendees") {
      return {
        ...include,
        where: { id: userId },
        required: true,
      };
    }
    return include;
  });

  const events = await db.events.findAll({
    include: includeConfig,
    order: [
      ["date", "ASC"],
      ["timeStart", "ASC"],
      ["order", "ASC"],
    ],
  });

  return events.map(formatEvent);
};

const ensurePlaceExists = async (placeId, transaction) => {
  const place = await db.places.findByPk(placeId, { transaction });
  if (!place) {
    throw createHttpError(400, "The provided 'placeId' does not correspond to an existing place.");
  }
};

const ensureParticipantExists = async (participantId, transaction) => {
  const participant = await db.participants.findByPk(participantId, { transaction });
  if (!participant) {
    throw createHttpError(400, "The provided 'participantId' does not correspond to an existing participant.");
  }
};

const ensureUserExists = async (userId, transaction) => {
  const user = await db.users.findByPk(userId, { transaction });
  if (!user) {
    throw createHttpError(400, "The provided 'userId' does not correspond to an existing user.");
  }
  return user;
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

const parseOptionalBoolean = (rawValue, fieldName) => {
  if (rawValue === undefined) {
    return { provided: false };
  }

  if (typeof rawValue === "boolean") {
    return { provided: true, value: rawValue };
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return { provided: true, value: true };
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return { provided: true, value: false };
    }
  }

  throw createHttpError(400, `The field '${fieldName}' must be a boolean value.`);
};

module.exports = (app) => {
  app.route("/api/events/date/:date").get(async function (req, res) {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: "Provide a date value to filter events." });
    }

    try {
      const events = await fetchEventsByDate(date);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by date:", error);
      res.status(500).json({ error: "Unable to fetch events for the specified date." });
    }
  });

  app.route("/api/events/").get(async function (req, res) {
    try {
      const events = await fetchAllEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Unable to fetch events." });
    }
  });

  app.route("/api/events/attendees/:userId").get(async function (req, res) {
    const { userId } = req.params;

    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) {
      return res
        .status(400)
        .json({ error: "The route parameter 'userId' must be an integer." });
    }

    try {
      await ensureUserExists(numericUserId);

      const events = await fetchEventsByAttendee(numericUserId);
      const eventsWithoutAttendees = events.map((event) => {
        if (!event || typeof event !== "object") {
          return event;
        }
        const { attendees, ...rest } = event;
        return rest;
      });
      res.json(eventsWithoutAttendees);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error fetching events for attendee:", error);
      res
        .status(500)
        .json({ error: "Unable to fetch events for the specified attendee." });
    }
  });

  app.route("/api/events/:id").get(async function (req, res) {
    const { id } = req.params;

    try {
      const event = await fetchEventWithAssociations(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found." });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ error: "Unable to fetch event." });
    }
  });

  app.route("/api/events/").post(async function (req, res) {
    const {
      title,
      description,
      placeId,
      date,
      timeStart,
      timeEnd,
      order,
      eventType,
      url,
    } = req.body;

    if (!title || !description || !placeId || !date || !timeStart || !timeEnd) {
      return res.status(400).json({
        error: "Fields 'title', 'description', 'placeId', 'date', 'timeStart', and 'timeEnd' are required.",
      });
    }

    let numericOrder = 0;
    if (order !== undefined) {
      const parsedOrder = Number(order);
      if (!Number.isInteger(parsedOrder)) {
        return res.status(400).json({ error: "The field 'order' must be an integer if provided." });
      }
      numericOrder = parsedOrder;
    }

    try {
      let createdEvent;
      await db.sequelize.transaction(async (transaction) => {
        await ensurePlaceExists(placeId, transaction);

        createdEvent = await db.events.create(
          {
            title,
            description,
            placeId,
            date,
            timeStart,
            timeEnd,
            order: numericOrder,
            eventType,
            url,
          },
          { transaction }
        );
      });

      const eventWithRelations = await fetchEventWithAssociations(createdEvent.id);
      res.status(201).json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error creating event:", error);
      res.status(500).json({ error: "Unable to create event." });
    }
  });

  app.route("/api/events/:id").put(async function (req, res) {
    const { id } = req.params;
    const {
      title,
      description,
      placeId,
      date,
      timeStart,
      timeEnd,
      order,
      eventType,
      url,
    } = req.body;

    if (
      title === undefined &&
      description === undefined &&
      placeId === undefined &&
      date === undefined &&
      timeStart === undefined &&
      timeEnd === undefined &&
      order === undefined &&
      eventType === undefined &&
      url === undefined
    ) {
      return res.status(400).json({
        error: "Provide at least one field to update: 'title', 'description', 'placeId', 'date', 'timeStart', 'timeEnd', 'order', 'eventType', or 'url'.",
      });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        if (placeId !== undefined) {
          await ensurePlaceExists(placeId, transaction);
          event.placeId = placeId;
        }

        if (title !== undefined) event.title = title;
        if (description !== undefined) event.description = description;
        if (date !== undefined) event.date = date;
        if (timeStart !== undefined) event.timeStart = timeStart;
        if (timeEnd !== undefined) event.timeEnd = timeEnd;
        if (order !== undefined) {
          const numericOrder = Number(order);
          if (!Number.isInteger(numericOrder)) {
            throw createHttpError(400, "The field 'order' must be an integer if provided.");
          }
          event.order = numericOrder;
        }
        if (eventType !== undefined) event.eventType = eventType;
        if (url !== undefined) event.url = url;

        await event.save({ transaction });
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Unable to update event." });
    }
  });

  app.route("/api/events/:id").delete(async function (req, res) {
    const { id } = req.params;
    try {
      const event = await db.events.findByPk(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found." });
      }
      await event.destroy();
      res.json({
        message: "Event deleted successfully.",
        eventId: id,
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Unable to delete event." });
    }
  });

  app.route("/api/events/:id/participants").post(async function (req, res) {
    const { id } = req.params;
    const { participantId, order, isModerator } = req.body;

    if (participantId === undefined) {
      return res.status(400).json({
        error: "Provide 'participantId' to link a participant to this event.",
      });
    }

    const numericParticipantId = Number(participantId);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({
        error: "The field 'participantId' must be an integer.",
      });
    }

    let orderProvided = false;
    let numericOrder = 0;
    if (order !== undefined) {
      orderProvided = true;
      numericOrder = Number(order);
      if (!Number.isInteger(numericOrder)) {
        return res.status(400).json({
          error: "The field 'order' must be an integer if provided.",
        });
      }
    }

    const { provided: isModeratorProvided, value: isModeratorValue } = parseOptionalBoolean(
      isModerator,
      "isModerator"
    );

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        await ensureParticipantExists(numericParticipantId, transaction);

        const existingLink = await db.eventParticipants.findOne({
          where: {
            eventId: id,
            participantId: numericParticipantId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingLink) {
          throw createHttpError(409, "Participant is already linked to this event.");
        }

        const assignedOrder = orderProvided
          ? numericOrder
          : await computeNextParticipantOrder(id, transaction);

        await db.eventParticipants.create(
          {
            eventId: id,
            participantId: numericParticipantId,
            order: assignedOrder,
            isModerator: isModeratorProvided ? isModeratorValue : false,
          },
          { transaction }
        );
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.status(201).json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error adding participant to event:", error);
      res.status(500).json({ error: "Unable to add participant to the event." });
    }
  });

  app.route("/api/events/:id/participants/:participantId").put(async function (req, res) {
    const { id, participantId } = req.params;
    const { order, isModerator } = req.body;

    if (order === undefined && isModerator === undefined) {
      return res.status(400).json({
        error: "Provide 'order' or 'isModerator' to update this participant link.",
      });
    }

    let numericOrder;
    let orderProvided = false;
    if (order !== undefined) {
      numericOrder = Number(order);
      if (!Number.isInteger(numericOrder)) {
        return res.status(400).json({ error: "The field 'order' must be an integer." });
      }
      orderProvided = true;
    }

    const { provided: isModeratorProvided, value: isModeratorValue } = parseOptionalBoolean(
      isModerator,
      "isModerator"
    );

    const numericParticipantId = Number(participantId);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({ error: "The route parameter 'participantId' must be an integer." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        const link = await db.eventParticipants.findOne({
          where: {
            eventId: id,
            participantId: numericParticipantId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this event.");
        }

        if (orderProvided) {
          link.order = numericOrder;
        }

        if (isModeratorProvided) {
          link.isModerator = isModeratorValue;
        }

        await link.save({ transaction });
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error updating participant order:", error);
      res.status(500).json({ error: "Unable to update the participant order for this event." });
    }
  });

  app.route("/api/events/:id/participants/:participantId").delete(async function (req, res) {
    const { id, participantId } = req.params;

    const numericParticipantId = Number(participantId);
    if (!Number.isInteger(numericParticipantId)) {
      return res.status(400).json({ error: "The route parameter 'participantId' must be an integer." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        const link = await db.eventParticipants.findOne({
          where: {
            eventId: id,
            participantId: numericParticipantId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this event.");
        }

        await link.destroy({ transaction });
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error removing participant from event:", error);
      res.status(500).json({ error: "Unable to remove the participant from this event." });
    }
  });

  app.route("/api/events/:id/attendees").post(async function (req, res) {
    const { id } = req.params;
    const { userId } = req.body;

    if (userId === undefined) {
      return res.status(400).json({
        error: "Provide 'userId' to register a user for this event.",
      });
    }

    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) {
      return res.status(400).json({
        error: "The field 'userId' must be an integer.",
      });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        await ensureUserExists(numericUserId, transaction);

        const existingLink = await db.eventAttendees.findOne({
          where: {
            eventId: id,
            userId: numericUserId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingLink) {
          throw createHttpError(409, "User is already registered for this event.");
        }

        await db.eventAttendees.create(
          {
            eventId: id,
            userId: numericUserId,
          },
          { transaction }
        );
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.status(201).json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error registering user for event:", error);
      res.status(500).json({ error: "Unable to register user for the event." });
    }
  });

  app.route("/api/events/:id/attendees/:userId").delete(async function (req, res) {
    const { id, userId } = req.params;

    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) {
      return res.status(400).json({ error: "The route parameter 'userId' must be an integer." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const event = await db.events.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!event) {
          throw createHttpError(404, "Event not found.");
        }

        const link = await db.eventAttendees.findOne({
          where: {
            eventId: id,
            userId: numericUserId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "User is not registered for this event.");
        }

        await link.destroy({ transaction });
      });

      const eventWithRelations = await fetchEventWithAssociations(id);
      res.json(eventWithRelations);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error unregistering user from event:", error);
      res.status(500).json({ error: "Unable to unregister user from this event." });
    }
  });
};
