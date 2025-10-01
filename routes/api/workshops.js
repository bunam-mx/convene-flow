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

const fetchWorkshopWithAssociations = async (id) => {
  return db.workshops.findByPk(id, {
    include: includeAttendeesConfig,
  });
};

const fetchWorkshopWithoutAttendees = async (id) => {
  return db.workshops.findByPk(id);
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
const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

module.exports = (app) => {
  app.route("/api/workshops/").get(async function (req, res) {
    try {
      const workshops = await db.workshops.findAll({
        include: includeAttendeesConfig,
      });
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

  app.route("/api/workshops/").post(async function (req, res) {
    const {
      title,
      purpose,
      keyPoints,
      participantDeliverable,
      participantCapacity,
    } = req.body;

    if (req.body.attendeeIds !== undefined) {
      return res.status(400).json({
        error: "Attendees must register individually. Do not include 'attendeeIds' when creating a workshop.",
      });
    }

    if (!title || !purpose || !keyPoints || !participantDeliverable) {
      return res.status(400).json({
        error: "Fields 'title', 'purpose', 'keyPoints', and 'participantDeliverable' are required.",
      });
    }

    try {
      const { provided: capacityProvided, value: parsedCapacity } = parseCapacity(participantCapacity);

      if (capacityProvided && !isValidCapacity(parsedCapacity)) {
        return res.status(400).json({
          error: "The field 'participantCapacity' must be a non-negative integer.",
        });
      }

      const newWorkshop = await db.workshops.create({
        title,
        purpose,
        keyPoints,
        participantDeliverable,
        participantCapacity: capacityProvided ? parsedCapacity : 0,
        registeredParticipants: 0,
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
      participantCapacity,
      attendeeIds,
    } = req.body;

    if (
      !title &&
      !purpose &&
      !keyPoints &&
      !participantDeliverable &&
      attendeeIds === undefined &&
      participantCapacity === undefined
    ) {
      return res.status(400).json({
        error: "Provide at least one field to update: 'title', 'purpose', 'keyPoints', 'participantDeliverable', 'participantCapacity', or 'attendeeIds'.",
      });
    }

    try {
      const workshop = await db.workshops.findByPk(id);
      if (!workshop) {
        return res.status(404).json({ error: "Workshop not found." });
      }

      const { provided: capacityProvided, value: parsedCapacity } = parseCapacity(participantCapacity);

      if (capacityProvided && !isValidCapacity(parsedCapacity)) {
        return res.status(400).json({
          error: "The field 'participantCapacity' must be a non-negative integer.",
        });
      }

      if (title !== undefined) workshop.title = title;
      if (purpose !== undefined) workshop.purpose = purpose;
      if (keyPoints !== undefined) workshop.keyPoints = keyPoints;
      if (participantDeliverable !== undefined) workshop.participantDeliverable = participantDeliverable;

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
