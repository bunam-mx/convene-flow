const express = require('express');
const db = require("../../sequelize");

module.exports = app => {
    // GET all thematic lines
    app.get('/api/thematiclines', async (req, res) => {
        try {
            const thematicLines = await db.thematicLines.findAll({
                attributes: ['id', 'thematicLine']
            });
            res.json(thematicLines);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al obtener las líneas temáticas', error: error.message });
        }
    });

    // GET a specific thematic line by ID
    app.get('/api/thematiclines/:id', async (req, res) => {
        try {
            const thematicLine = await db.thematicLines.findByPk(req.params.id, {
                attributes: ['id', 'thematicLine']
            });
            if (!thematicLine) {
                return res.status(404).json({ message: 'Línea temática no encontrada' });
            }
            res.json(thematicLine);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al obtener la línea temática', error: error.message });
        }
    });

    // POST a new thematic line
    app.post('/api/thematiclines', async (req, res) => {
        const { thematicLine } = req.body;
        if (!thematicLine) {
            return res.status(400).json({ message: 'El campo thematicLine es obligatorio' });
        }
        try {
            const newThematicLine = await db.thematicLines.create({ thematicLine });
            res.status(201).json(newThematicLine);
        } catch (error) {
            console.error(error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'La línea temática ya existe', error: error.message });
            }
            res.status(500).json({ message: 'Error al crear la línea temática', error: error.message });
        }
    });

    // PUT (update) an existing thematic line
    app.put('/api/thematiclines/:id', async (req, res) => {
        const { thematicLine } = req.body;
        const id = req.params.id;

        if (!thematicLine) {
            return res.status(400).json({ message: 'El campo thematicLine es obligatorio' });
        }

        try {
            const lineToUpdate = await db.thematicLines.findByPk(id);
            if (!lineToUpdate) {
                return res.status(404).json({ message: 'Línea temática no encontrada' });
            }

            await lineToUpdate.update({ thematicLine });
            res.json(lineToUpdate);
        } catch (error) {
            console.error(error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'La línea temática ya existe', error: error.message });
            }
            res.status(500).json({ message: 'Error al actualizar la línea temática', error: error.message });
        }
    });

    // DELETE a thematic line
    app.delete('/api/thematiclines/:id', async (req, res) => {
        const id = req.params.id;
        try {
            const lineToDelete = await db.thematicLines.findByPk(id);
            if (!lineToDelete) {
                return res.status(404).json({ message: 'Línea temática no encontrada' });
            }

            await lineToDelete.destroy();
            res.status(204).send(); // No content
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al eliminar la línea temática', error: error.message });
        }
    });
};
