const express = require("express"),
  db = require("../../sequelize"),
  app = express();

module.exports = (app) => {
  app.route("/api/sigecos/:id").put(async function (req, res) {
    const { id } = req.params;
    const { field, value } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ error: "Se requieren los campos 'field' y 'value'." });
    }

    try {
      const updateData = {};
      updateData[field] = value.toUpperCase();

      const [numberOfAffectedRows] = await db.sigecos.update(updateData, {
        where: { id: id },
      });

      if (numberOfAffectedRows > 0) {
        const updatedSigeco = await db.sigecos.findByPk(id);
        res.json({ status: true, message: "Registro actualizado correctamente.", sigeco: updatedSigeco });
      } else {
        res.status(404).json({ status: false, message: "Registro no encontrado o ningún dato fue modificado." });
      }
    } catch (error) {
      console.error("Error al actualizar el registro de sigecos:", error);
      if (error.name === 'SequelizeDatabaseError' || error.name === 'SequelizeValidationError') { 
        return res.status(400).json({ status: false, error: `Error en la base de datos: es posible que el campo '${field}' no exista, el valor '${value}' sea incorrecto para el tipo de dato, o falle alguna validación.` });
      }
      res.status(500).json({ status: false, error: "Error interno del servidor al actualizar el registro." });
    }
  });

  app.route("/api/sigecos/search/:word").get(async function (req, res) { // Changed :name to :word
    const { word } = req.params; // Changed name to word
    const { Op, Sequelize } = require("sequelize"); // Importar Op y Sequelize

    if (!word) { // Changed name to word
      return res.status(400).json({ error: "El término de búsqueda (word) es requerido." });
    }

    try {
      const searchTerm = `%${word.toUpperCase()}%`; // Convertir el término de búsqueda a mayúsculas
      const results = await db.sigecos.findAll({
        where: {
          [Op.or]: [
            Sequelize.where(Sequelize.fn('UPPER', Sequelize.col('name')), {
              [Op.like]: searchTerm
            }),
            Sequelize.where(Sequelize.fn('UPPER', Sequelize.col('lastname')), {
              [Op.like]: searchTerm
            })
          ]
        },
        attributes: [
          'id',
          [Sequelize.fn('CONCAT', Sequelize.col('name'), ' ', Sequelize.col('lastname')), 'fullname']
        ] // Modificado para devolver id y fullname
      });

      if (results.length > 0) {
        res.json(results);
      } else {
        res.json([]); // Devolver un array vacío si no hay coincidencias
      }
    } catch (error) {
      console.error("Error al buscar en sigecos:", error);
      res.status(500).json({ error: "Error interno del servidor al realizar la búsqueda." });
    }
  });
}
