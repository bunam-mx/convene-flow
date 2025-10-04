const express = require("express"),
  db = require("../../sequelize"),
  app = express();

const includeAttendeesConfig = [
  {
    model: db.users,
    as: "attendees",
    attributes: ["id", "email", "attendanceMode"],
    through: { attributes: [] },
  },
];

const includeParticipantsConfig = [
  {
    model: db.participants,
    as: "participants",
    attributes: ["id", "name", "institution", "bio"],
    through: { attributes: ["order"] },
  },
];

const includePlaceConfig = [
  {
    model: db.places,
    as: "place",
    attributes: ["id", "placeName"],
  },
];

const workshopIncludeConfig = [...includeAttendeesConfig, ...includeParticipantsConfig, ...includePlaceConfig];

const formatWorkshop = (workshopInstance) => {
  if (!workshopInstance) {
    return null;
  }

  const data = workshopInstance.get ? workshopInstance.get({ plain: true }) : workshopInstance;

  const participants = Array.isArray(data.participants) ? data.participants : [];
  data.participants = participants
    .map((participant) => {
      const order = participant?.workshopParticipants?.order ?? participant?.order ?? 0;
      return {
        id: participant.id,
        name: participant.name,
        institution: participant.institution,
        bio: participant.bio,
        order,
      };
    })
    .sort((a, b) => a.order - b.order);

  if (data.place) {
    data.place = {
      id: data.place.id,
      placeName: data.place.placeName,
    };
  } else {
    data.place = null;
  }

  return data;
};

const fetchWorkshopWithAssociations = async (id) => {
  const workshop = await db.workshops.findByPk(id, {
    include: workshopIncludeConfig,
  });

  return formatWorkshop(workshop);
};

const fetchWorkshopWithoutAttendees = async (id) => {
  return db.workshops.findByPk(id);
};

const fetchAllWorkshops = async () => {
  const workshops = await db.workshops.findAll({
    include: workshopIncludeConfig,
    order: [
      ["date", "ASC"],
      ["timeStart", "ASC"],
      ["order", "ASC"],
    ],
  });

  return workshops.map(formatWorkshop);
};

const fetchWorkshopsByDate = async (date) => {
  const workshops = await db.workshops.findAll({
    where: { date },
    include: [...includeParticipantsConfig, ...includePlaceConfig],
    order: [
      ["timeStart", "ASC"],
      ["order", "ASC"],
    ],
  });

  return workshops.map(formatWorkshop);
};

const validateAttendeeIds = async (userIds = []) => {
  if (!Array.isArray(userIds)) {
    return "The field 'attendeeIds' must be an array of user IDs.";
  }
  if (userIds.length === 0) {
    return null; // empty array is allowed -> no attendees to attach
  }

  const existingCount = await db.users.count({ where: { id: userIds } });
  if (existingCount !== userIds.length) {
    return "One or more provided user IDs do not exist.";
  }
  return null;
};

const normalizeUserIds = (ids = []) => Array.from(new Set(ids));
const isValidCapacity = (value) => Number.isInteger(value) && value >= 0;
const exceedsCapacity = (capacity, count) => capacity > 0 && count > capacity;
const parseCapacity = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return { provided: false, value: undefined };
  }

  if (typeof rawValue === "string" && rawValue.trim() === "") {
    return { provided: true, value: NaN };
  }

  const numericValue = Number(rawValue);
  return { provided: true, value: numericValue };
};
const parseOrderValue = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return { provided: false, value: 0, valid: true };
  }

  const numericValue = Number(rawValue);
  return {
    provided: true,
    value: numericValue,
    valid: Number.isInteger(numericValue),
  };
};
const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
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

const computeNextWorkshopParticipantOrder = async (workshopId, transaction) => {
  const maxOrder = await db.workshopParticipants.max("order", {
    where: { workshopId },
    transaction,
  });

  if (Number.isInteger(maxOrder)) {
    return maxOrder + 1;
  }

  return 0;
};

module.exports = (app) => {
  app.route("/api/workshops/").get(async function (req, res) {
    try {
      const workshops = await fetchAllWorkshops();
      res.json(workshops);
    } catch (error) {
      console.error("Error fetching workshops:", error);
      res.status(500).json({ error: "Unable to fetch workshops." });
    }
  });

  app.route("/api/workshops/clean").get(async function (req, res) {
    try {
      const workshops = await db.workshops.findAll();
      res.json(workshops);
    } catch (error) {
      console.error("Error fetching workshops:", error);
      res.status(500).json({ error: "Unable to fetch workshops." });
    }
  });

  app.route("/api/workshops/date/:date").get(async function (req, res) {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: "Provide a date value to filter workshops." });
    }

    try {
      const workshops = await fetchWorkshopsByDate(date);
      res.json(workshops);
    } catch (error) {
      console.error("Error fetching workshops by date:", error);
      res.status(500).json({ error: "Unable to fetch workshops for the specified date." });
    }
  });

  app.route("/api/workshops/").post(async function (req, res) {
    const {
      title,
      purpose,
      keyPoints,
      participantDeliverable,
      date,
      timeStart,
      timeEnd,
      order,
      participantCapacity,
      placeId,
      url,
    } = req.body;

    if (req.body.attendeeIds !== undefined) {
      return res.status(400).json({
        error: "Attendees must register individually. Do not include 'attendeeIds' when creating a workshop.",
      });
    }

    if (!title || !purpose || !keyPoints || !participantDeliverable || !date || !timeStart || !timeEnd || !placeId) {
      return res.status(400).json({
        error: "Fields 'title', 'purpose', 'keyPoints', 'participantDeliverable', 'date', 'timeStart', 'timeEnd', and 'placeId' are required.",
      });
    }

    try {
      const { provided: capacityProvided, value: parsedCapacity } = parseCapacity(participantCapacity);
      const { provided: orderProvided, value: parsedOrder, valid: isOrderValid } = parseOrderValue(order);
      const numericPlaceId = Number(placeId);

      if (capacityProvided && !isValidCapacity(parsedCapacity)) {
        return res.status(400).json({
          error: "The field 'participantCapacity' must be a non-negative integer.",
        });
      }

      if (!isOrderValid) {
        return res.status(400).json({
          error: "The field 'order' must be an integer if provided.",
        });
      }

      if (!Number.isInteger(numericPlaceId)) {
        return res.status(400).json({
          error: "The field 'placeId' must be an integer.",
        });
      }

      await ensurePlaceExists(numericPlaceId);

      const newWorkshop = await db.workshops.create({
        title,
        purpose,
        keyPoints,
        participantDeliverable,
        date,
        timeStart,
        timeEnd,
        order: orderProvided ? parsedOrder : 0,
        participantCapacity: capacityProvided ? parsedCapacity : 0,
        registeredParticipants: 0,
        placeId: numericPlaceId,
        url,
      });

      const workshopWithRelations = await fetchWorkshopWithAssociations(newWorkshop.id);
      res.status(201).json(workshopWithRelations);
    } catch (error) {
      console.error("Error creating workshop:", error);
      res.status(500).json({ error: "Unable to create workshop." });
    }
  });

  app.route("/api/workshops/:id").get(async function (req, res) {
    const { id } = req.params;

    try {
      const workshop = await fetchWorkshopWithAssociations(id);
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found." });
      }
      res.json(workshop);
    } catch (error) {
      console.error("Error fetching workshop:", error);
      res.status(500).json({ error: "Unable to fetch workshop." });
    }
  });

  app.route("/api/workshops/:id/clean").get(async function (req, res) {
    const { id } = req.params;

    try {
      const workshop = await fetchWorkshopWithoutAttendees(id);
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found." });
      }
      res.json(workshop);
    } catch (error) {
      console.error("Error fetching workshop:", error);
      res.status(500).json({ error: "Unable to fetch workshop." });
    }
  });

  app.route("/api/workshops/:id").put(async function (req, res) {
    const { id } = req.params;
    const {
      title,
      purpose,
      keyPoints,
      participantDeliverable,
      date,
      timeStart,
      timeEnd,
      order,
      participantCapacity,
      attendeeIds,
      placeId,
      url,
    } = req.body;

    if (
      !title &&
      !purpose &&
      !keyPoints &&
      !participantDeliverable &&
      date === undefined &&
      timeStart === undefined &&
      timeEnd === undefined &&
      order === undefined &&
      attendeeIds === undefined &&
      participantCapacity === undefined &&
      placeId === undefined &&
      url === undefined
    ) {
      return res.status(400).json({
        error: "Provide at least one field to update: 'title', 'purpose', 'keyPoints', 'participantDeliverable', 'date', 'timeStart', 'timeEnd', 'order', 'participantCapacity', 'placeId', 'url', or 'attendeeIds'.",
      });
    }

    try {
      const workshop = await db.workshops.findByPk(id);
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found." });
      }

      const { provided: capacityProvided, value: parsedCapacity } = parseCapacity(participantCapacity);
      const { provided: orderProvided, value: parsedOrder, valid: isOrderValid } = parseOrderValue(order);
      const placeIdProvided = placeId !== undefined;
      const numericPlaceId = placeIdProvided ? Number(placeId) : null;

      if (capacityProvided && !isValidCapacity(parsedCapacity)) {
        return res.status(400).json({
          error: "The field 'participantCapacity' must be a non-negative integer.",
        });
      }

      if (orderProvided && !isOrderValid) {
        return res.status(400).json({
          error: "The field 'order' must be an integer if provided.",
        });
      }

      if (placeIdProvided) {
        if (!Number.isInteger(numericPlaceId)) {
          return res.status(400).json({ error: "The field 'placeId' must be an integer." });
        }
        await ensurePlaceExists(numericPlaceId);
      }

      if (title !== undefined) workshop.title = title;
      if (purpose !== undefined) workshop.purpose = purpose;
      if (keyPoints !== undefined) workshop.keyPoints = keyPoints;
      if (participantDeliverable !== undefined) workshop.participantDeliverable = participantDeliverable;
      if (date !== undefined) workshop.date = date;
      if (timeStart !== undefined) workshop.timeStart = timeStart;
      if (timeEnd !== undefined) workshop.timeEnd = timeEnd;
      if (orderProvided) workshop.order = parsedOrder;
      if (url !== undefined) workshop.url = url;
      if (placeIdProvided) workshop.placeId = numericPlaceId;

      let targetCapacity = capacityProvided ? parsedCapacity : workshop.participantCapacity;
      if (capacityProvided) {
        if (exceedsCapacity(parsedCapacity, workshop.registeredParticipants)) {
          return res.status(400).json({
            error: "Participant capacity cannot be less than the current attendee count.",
          });
        }
        workshop.participantCapacity = parsedCapacity;
      }

      if (attendeeIds !== undefined) {
        const validationError = await validateAttendeeIds(attendeeIds);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
        const uniqueAttendeeIds = normalizeUserIds(attendeeIds);
        if (exceedsCapacity(targetCapacity, uniqueAttendeeIds.length)) {
          return res.status(400).json({
            error: "The number of attendees cannot exceed the participant capacity.",
          });
        }
        await workshop.setAttendees(uniqueAttendeeIds);
        workshop.registeredParticipants = uniqueAttendeeIds.length;
      }

      await workshop.save();

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      console.error("Error updating workshop:", error);
      res.status(500).json({ error: "Unable to update workshop." });
    }
  });

  app.route("/api/workshops/:id").delete(async function (req, res) {
    const { id } = req.params;
    try {
      const workshop = await db.workshops.findByPk(id);
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found." });
      }
      await workshop.destroy();
      res.json({
        message: "Workshop deleted successfully.",
        workshopId: id,
      });
    } catch (error) {
      console.error("Error deleting workshop:", error);
      res.status(500).json({ error: "Unable to delete workshop." });
    }
  });

  app.route("/api/workshops/:id/attendees").post(async function (req, res) {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Provide 'userId' to register an attendee." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const workshop = await db.workshops.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!workshop) {
          throw createHttpError(404, "Workshop not found.");
        }

        const attendee = await db.users.findByPk(userId, { transaction });
        if (!attendee) {
          throw createHttpError(404, "User not found.");
        }

        const alreadyRegistered = await workshop.hasAttendee(attendee, { transaction });
        if (alreadyRegistered) {
          throw createHttpError(409, "User is already registered for this workshop.");
        }

        if (
          workshop.participantCapacity > 0 &&
          workshop.registeredParticipants >= workshop.participantCapacity
        ) {
          throw createHttpError(400, "This workshop has reached its participant capacity.");
        }

        await workshop.addAttendee(attendee, { transaction });
        await workshop.increment("registeredParticipants", { by: 1, transaction });
      });

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      if (error && error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error adding attendee:", error);
      res.status(500).json({ error: "Unable to add attendee to the workshop." });
    }
  });

  app.route("/api/workshops/:id/participants").post(async function (req, res) {
    const { id } = req.params;
    const { participantId, order } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: "Provide 'participantId' to link a participant to this workshop." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const workshop = await db.workshops.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!workshop) {
          throw createHttpError(404, "Workshop not found.");
        }

        await ensureParticipantExists(participantId, transaction);

        const existingLink = await db.workshopParticipants.findOne({
          where: { workshopId: id, participantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingLink) {
          throw createHttpError(409, "Participant is already linked to this workshop.");
        }

        const { provided: orderProvided, value: parsedOrder, valid: isOrderValid } = parseOrderValue(order);

        if (orderProvided && !isOrderValid) {
          throw createHttpError(400, "The field 'order' must be an integer if provided.");
        }

        const finalOrder = orderProvided ? parsedOrder : await computeNextWorkshopParticipantOrder(id, transaction);

        await db.workshopParticipants.create(
          {
            workshopId: id,
            participantId,
            order: finalOrder,
          },
          { transaction }
        );
      });

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      if (error && error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error adding participant to workshop:", error);
      res.status(500).json({ error: "Unable to link participant to the workshop." });
    }
  });

  app.route("/api/workshops/:id/participants/:participantId").put(async function (req, res) {
    const { id, participantId } = req.params;
    const { order } = req.body;

    if (order === undefined || order === null) {
      return res
        .status(400)
        .json({ error: "Provide the 'order' field to update the participant position in the workshop." });
    }

    try {
      await db.sequelize.transaction(async (transaction) => {
        const link = await db.workshopParticipants.findOne({
          where: { workshopId: id, participantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this workshop.");
        }

        const { provided: orderProvided, value: parsedOrder, valid: isOrderValid } = parseOrderValue(order);

        if (!orderProvided || !isOrderValid) {
          throw createHttpError(400, "The field 'order' must be an integer.");
        }

        link.order = parsedOrder;
        await link.save({ transaction });
      });

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      if (error && error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error updating participant order in workshop:", error);
      res.status(500).json({ error: "Unable to update participant order for the workshop." });
    }
  });

  app.route("/api/workshops/:id/participants/:participantId").delete(async function (req, res) {
    const { id, participantId } = req.params;

    try {
      await db.sequelize.transaction(async (transaction) => {
        const link = await db.workshopParticipants.findOne({
          where: { workshopId: id, participantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!link) {
          throw createHttpError(404, "Participant is not linked to this workshop.");
        }

        await link.destroy({ transaction });
      });

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      if (error && error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error removing participant from workshop:", error);
      res.status(500).json({ error: "Unable to remove participant from the workshop." });
    }
  });

  app.route("/api/workshops/:id/attendees/:userId").delete(async function (req, res) {
    const { id, userId } = req.params;

    try {
      await db.sequelize.transaction(async (transaction) => {
        const workshop = await db.workshops.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!workshop) {
          throw createHttpError(404, "Workshop not found.");
        }

        const attendee = await db.users.findByPk(userId, { transaction });
        if (!attendee) {
          throw createHttpError(404, "User not found.");
        }

        const isRegistered = await workshop.hasAttendee(attendee, { transaction });
        if (!isRegistered) {
          throw createHttpError(404, "User is not registered for this workshop.");
        }

        await workshop.removeAttendee(attendee, { transaction });
        if (workshop.registeredParticipants > 0) {
          await workshop.decrement("registeredParticipants", { by: 1, transaction });
        }
      });

      const updatedWorkshop = await fetchWorkshopWithAssociations(id);
      res.json(updatedWorkshop);
    } catch (error) {
      if (error && error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Error removing attendee:", error);
      res.status(500).json({ error: "Unable to remove attendee from the workshop." });
    }
  });
};
