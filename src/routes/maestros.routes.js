const express = require("express");

const router = express.Router();

const maestrosService = require("../services/maestros.service");

/* ============================================================
   FUNCION AUXILIAR
   ============================================================ */

function crearRutaSimple(metodoService) {
  return async (req, res) => {
    try {
      const datos = await metodoService();

      res.json({
        ok: true,
        cantidad: datos.length,
        datos,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,

        mensaje: error.message,
      });
    }
  };
}

/* ============================================================
   MAESTROS
   ============================================================ */

router.get("/anos", crearRutaSimple(maestrosService.obtenerAnos));

router.get("/marcas", crearRutaSimple(maestrosService.obtenerMarcas));

router.get("/rubros", crearRutaSimple(maestrosService.obtenerRubros));

router.get("/temporadas", crearRutaSimple(maestrosService.obtenerTemporadas));

router.get("/colores", crearRutaSimple(maestrosService.obtenerColores));

router.get("/grupos", crearRutaSimple(maestrosService.obtenerGrupos));

router.get("/subgrupos", crearRutaSimple(maestrosService.obtenerSubgrupos));

router.get("/lineas", crearRutaSimple(maestrosService.obtenerLineas));

router.get("/deportes", crearRutaSimple(maestrosService.obtenerDeportes));

router.get("/edades", crearRutaSimple(maestrosService.obtenerEdades));

router.get("/sexo", crearRutaSimple(maestrosService.obtenerSexo));

router.get(
  "/clasificaciones",
  crearRutaSimple(maestrosService.obtenerClasificaciones),
);

router.get("/paises", crearRutaSimple(maestrosService.obtenerPaises));

router.get("/origenes", crearRutaSimple(maestrosService.obtenerOrigenes));

router.get(
  "/proveedores",

  async (req, res) => {
    try {
      const rubro =
        req.query.rubro
          ? String(req.query.rubro).trim()
          : null;

      const datos =
        await maestrosService.obtenerProveedores({
          rubro,
        });

      res.json({
        ok: true,
        cantidad: datos.length,
        filtros: {
          rubro,
        },
        datos,
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        mensaje: error.message,
      });
    }
  },
);

router.get("/talles", crearRutaSimple(maestrosService.obtenerTalles));

router.get(
  "/talles-modulos",
  crearRutaSimple(maestrosService.obtenerTallesModulos),
);

/* ============================================================
   LICENCIAS DE MODELOS
   ============================================================ */

router.get(
  "/licencias-modelos",

  async (req, res) => {
    try {
      const marca = req.query.marca ? String(req.query.marca).trim() : null;

      const rubro = req.query.rubro ? String(req.query.rubro).trim() : null;

      const datos = await maestrosService.obtenerLicenciasModelos({
        marca,
        rubro,
      });

      res.json({
        ok: true,

        cantidad: datos.length,

        filtros: {
          marca,
          rubro,
        },

        datos,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,

        mensaje: error.message,
      });
    }
  },
);

/* ============================================================
   MODELOS
   ============================================================ */

router.get(
  "/modelos",

  async (req, res) => {
    try {
      const marca = req.query.marca ? String(req.query.marca).trim() : null;

      const rubro = req.query.rubro ? String(req.query.rubro).trim() : null;

      const texto = req.query.texto ? String(req.query.texto).trim() : null;

      const licencia = req.query.licencia
        ? String(req.query.licencia).trim()
        : null;

      const datos = await maestrosService.buscarModelos({
        marca,
        rubro,
        texto,
        licencia,
      });

      res.json({
        ok: true,

        cantidad: datos.length,

        filtros: {
          marca,
          rubro,
          texto,
          licencia,
        },

        datos,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,

        mensaje: error.message,
      });
    }
  },
);

module.exports = router;
