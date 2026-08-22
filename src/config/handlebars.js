const path = require("path");
const { engine } = require("express-handlebars");

function configurarHandlebars(app) {
  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      defaultLayout: "main",
      layoutsDir: path.join(process.cwd(), "views", "layouts"),
      partialsDir: path.join(process.cwd(), "views", "partials"),
      helpers: {
        eq: (a, b) => a === b,

        json: (valor) => JSON.stringify(valor),

        anioActual: () => new Date().getFullYear(),
      },
    }),
  );

  app.set("view engine", "hbs");

  app.set("views", path.join(process.cwd(), "views"));
}

module.exports = {
  configurarHandlebars,
};
