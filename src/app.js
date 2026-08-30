const express = require("express");
const path = require("path");
const session = require("express-session");

const maestrosRoutes = require("./routes/maestros.routes");
const altasRoutes = require("./routes/altas.routes");
const seguimientoRoutes = require("./routes/seguimiento.routes");
const imagenesRoutes = require("./routes/imagenes.routes");
const webRoutes = require("./routes/web.routes");
const pedidosRoutes = require("./routes/pedidos.routes");
const pedidosWebRoutes = require('./routes/pedidos.web.routes');
const authRoutes = require("./routes/auth.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const perfilRoutes = require("./routes/perfil.routes");

const { configurarHandlebars } = require("./config/handlebars");

const app = express();

/* ============================================================
   SESIONES / AUTENTICACION
   ============================================================ */

const SESSION_SECRET =
  process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error(
    'Falta SESSION_SECRET en .env.'
  );
}

app.use(
  session({
    name: 'productos.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);


/* ============================================================
   HANDLEBARS
   ============================================================ */

configurarHandlebars(app);

/* ============================================================
   ARCHIVOS ESTÁTICOS
   ============================================================ */

app.use(express.static(path.join(process.cwd(), "public")));

/* ============================================================
   JSON

   Se amplía el límite para permitir carga de imágenes
   codificadas en Base64 desde el frontend.
   ============================================================ */

app.use(
  express.json({
    limit: "12mb",
  }),
);

/* ============================================================
   AUTENTICACION
   ============================================================ */

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/perfil", perfilRoutes);

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

app.use("/api/seguimiento", seguimientoRoutes);

/* ============================================================
   MAESTROS
   ============================================================ */

app.use("/api/maestros", maestrosRoutes);

/* ============================================================
   ALTAS PRODUCTOS
   ============================================================ */

app.use("/api/altas", altasRoutes);

/* ============================================================
   IMÁGENES PRODUCTOS
   ============================================================ */

app.use("/api/imagenes", imagenesRoutes);

/* ============================================================
   RUTAS WEB
   IMPORTANTE:
   Deben ir ANTES del 404.
   ============================================================ */
app.use('/', pedidosWebRoutes);
app.use("/", webRoutes);

/* ============================================================
   404
   ============================================================ */

app.use('/api/pedidos', pedidosRoutes);

app.use((req, res) => {
  /*
   * Si el usuario pidió una API inexistente,
   * respondemos JSON.
   */
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      mensaje: "Ruta no encontrada.",
    });
  }

  /*
   * Para rutas web inexistentes dejamos
   * una respuesta simple por ahora.
   */
  return res.status(404).send("Página no encontrada.");
});

module.exports = app;
