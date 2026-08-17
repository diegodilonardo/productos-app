const express = require("express");
const path = require("path");

const maestrosRoutes = require("./routes/maestros.routes");
const altasRoutes = require("./routes/altas.routes");
const seguimientoRoutes = require("./routes/seguimiento.routes");
const webRoutes = require("./routes/web.routes");

const {
  configurarHandlebars
} = require("./config/handlebars");


const app = express();


/* ============================================================
   HANDLEBARS
   ============================================================ */

configurarHandlebars(app);


/* ============================================================
   ARCHIVOS ESTÁTICOS
   ============================================================ */

app.use(
  express.static(
    path.join(
      process.cwd(),
      "public"
    )
  )
);


/* ============================================================
   JSON
   ============================================================ */

app.use(express.json());


/* ============================================================
   STATUS
   ============================================================ */

app.get(
  "/api/status",

  (req, res) => {
    res.json({
      ok: true,
      aplicacion: "PRODUCTOS_APP",
      fecha: new Date(),
    });
  },
);


/* ============================================================
   SEGUIMIENTOS
   ============================================================ */

app.use(
  "/api/seguimiento",
  seguimientoRoutes
);


/* ============================================================
   MAESTROS
   ============================================================ */

app.use(
  "/api/maestros",
  maestrosRoutes
);


/* ============================================================
   ALTAS PRODUCTOS
   ============================================================ */

app.use(
  "/api/altas",
  altasRoutes
);


/* ============================================================
   RUTAS WEB
   IMPORTANTE:
   Deben ir ANTES del 404.
   ============================================================ */

app.use(
  "/",
  webRoutes
);


/* ============================================================
   404
   ============================================================ */

app.use(
  (req, res) => {

    /*
     * Si el usuario pidió una API inexistente,
     * respondemos JSON.
     */
    if (
      req.originalUrl.startsWith("/api/")
    ) {
      return res
        .status(404)
        .json({
          ok: false,
          mensaje: "Ruta no encontrada.",
        });
    }

    /*
     * Para rutas web inexistentes dejamos
     * una respuesta simple por ahora.
     */
    return res
      .status(404)
      .send(
        "Página no encontrada."
      );
  }
);


module.exports = app;
