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
}
