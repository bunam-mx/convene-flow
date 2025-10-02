const express = require("express"),
  db = require("../../sequelize");

module.exports = (app) => {
  app.get("/api/places", async (req, res) => {
    try {
      const places = await db.places.findAll({
        attributes: ["id", "placeName"],
        order: [["placeName", "ASC"]],
      });
      res.json(places);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ error: "Unable to fetch places." });
    }
  });

  app.get("/api/places/:id", async (req, res) => {
    try {
      const place = await db.places.findByPk(req.params.id, {
        attributes: ["id", "placeName"],
      });

      if (!place) {
        return res.status(404).json({ error: "Place not found." });
      }

      res.json(place);
    } catch (error) {
      console.error("Error fetching place:", error);
      res.status(500).json({ error: "Unable to fetch place." });
    }
  });

  app.post("/api/places", async (req, res) => {
    const { placeName } = req.body;

    if (!placeName) {
      return res.status(400).json({ error: "The field 'placeName' is required." });
    }

    try {
      const newPlace = await db.places.create({ placeName });
      res.status(201).json({ id: newPlace.id, placeName: newPlace.placeName });
    } catch (error) {
      console.error("Error creating place:", error);
      res.status(500).json({ error: "Unable to create place." });
    }
  });

  app.put("/api/places/:id", async (req, res) => {
    const { placeName } = req.body;

    if (!placeName) {
      return res.status(400).json({ error: "The field 'placeName' is required." });
    }

    try {
      const place = await db.places.findByPk(req.params.id);

      if (!place) {
        return res.status(404).json({ error: "Place not found." });
      }

      place.placeName = placeName;
      await place.save();

      res.json({ id: place.id, placeName: place.placeName });
    } catch (error) {
      console.error("Error updating place:", error);
      res.status(500).json({ error: "Unable to update place." });
    }
  });

  app.delete("/api/places/:id", async (req, res) => {
    try {
      const place = await db.places.findByPk(req.params.id);

      if (!place) {
        return res.status(404).json({ error: "Place not found." });
      }

      await place.destroy();
      res.json({ message: "Place deleted successfully.", placeId: place.id });
    } catch (error) {
      console.error("Error deleting place:", error);
      res.status(500).json({ error: "Unable to delete place." });
    }
  });
};