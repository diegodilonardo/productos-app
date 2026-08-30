const express = require("express");

const router =
  express.Router();

const maestrosService =
  require("../services/maestros.service");

const {
  requerirAutenticacion,
  requerirEmpresa
} =
  require("../middlewares/auth.middleware");


router.use(
  requerirAutenticacion
);


function responderError(
  res,
  error
) {

  return res
    .status(error.status || 400)
    .json({
      ok: false,
      mensaje: error.message
    });
}


function crearRutaSimple(
  metodoService
) {

  return [
    requerirEmpresa,

    async (req, res) => {

      try {

        const datos =
          await metodoService({
            idEmpresa:
              req.idEmpresa,

            acceso:
              req.accesoEmpresa
          });

        res.json({
          ok: true,
          idEmpresa:
            req.idEmpresa,
          cantidad:
            datos.length,
          datos
        });

      } catch (error) {

        console.error(error);

        responderError(
          res,
          error
        );
      }
    }
  ];
}


/* ============================================================
   MAESTROS
   ============================================================ */

router.get(
  "/anos",
  ...crearRutaSimple(
    maestrosService.obtenerAnos
  )
);

router.get(
  "/marcas",
  ...crearRutaSimple(
    maestrosService.obtenerMarcas
  )
);

router.get(
  "/rubros",
  ...crearRutaSimple(
    maestrosService.obtenerRubros
  )
);

router.get(
  "/temporadas",
  ...crearRutaSimple(
    maestrosService.obtenerTemporadas
  )
);

router.get(
  "/colores",
  ...crearRutaSimple(
    maestrosService.obtenerColores
  )
);

router.get(
  "/grupos",
  ...crearRutaSimple(
    maestrosService.obtenerGrupos
  )
);

router.get(
  "/subgrupos",
  ...crearRutaSimple(
    maestrosService.obtenerSubgrupos
  )
);

router.get(
  "/lineas",
  ...crearRutaSimple(
    maestrosService.obtenerLineas
  )
);

router.get(
  "/deportes",
  ...crearRutaSimple(
    maestrosService.obtenerDeportes
  )
);

router.get(
  "/edades",
  ...crearRutaSimple(
    maestrosService.obtenerEdades
  )
);

router.get(
  "/sexo",
  ...crearRutaSimple(
    maestrosService.obtenerSexo
  )
);

router.get(
  "/clasificaciones",
  ...crearRutaSimple(
    maestrosService.obtenerClasificaciones
  )
);

router.get(
  "/paises",
  ...crearRutaSimple(
    maestrosService.obtenerPaises
  )
);

router.get(
  "/origenes",
  ...crearRutaSimple(
    maestrosService.obtenerOrigenes
  )
);

router.get(
  "/talles",
  ...crearRutaSimple(
    maestrosService.obtenerTalles
  )
);

router.get(
  "/talles-modulos",
  ...crearRutaSimple(
    maestrosService.obtenerTallesModulos
  )
);


/* ============================================================
   PROVEEDORES
   ============================================================ */

router.get(
  "/proveedores",
  requerirEmpresa,
  async (req, res) => {

    try {

      const rubro =
        req.query.rubro
          ? String(req.query.rubro).trim()
          : null;

      const marca =
        req.query.marca
          ? String(req.query.marca).trim()
          : null;

      const datos =
        await maestrosService.obtenerProveedores({
          idEmpresa:
            req.idEmpresa,

          acceso:
            req.accesoEmpresa,

          rubro,
          marca
        });

      res.json({
        ok: true,
        idEmpresa:
          req.idEmpresa,
        cantidad:
          datos.length,
        filtros: {
          rubro,
          marca
        },
        datos
      });

    } catch (error) {

      console.error(error);

      responderError(
        res,
        error
      );
    }
  }
);


/* ============================================================
   LICENCIAS DE MODELOS
   ============================================================ */

router.get(
  "/licencias-modelos",
  requerirEmpresa,
  async (req, res) => {

    try {

      const marca =
        req.query.marca
          ? String(req.query.marca).trim()
          : null;

      const rubro =
        req.query.rubro
          ? String(req.query.rubro).trim()
          : null;

      const datos =
        await maestrosService.obtenerLicenciasModelos({
          idEmpresa:
            req.idEmpresa,

          acceso:
            req.accesoEmpresa,

          marca,
          rubro
        });

      res.json({
        ok: true,
        idEmpresa:
          req.idEmpresa,
        cantidad:
          datos.length,
        filtros: {
          marca,
          rubro
        },
        datos
      });

    } catch (error) {

      console.error(error);

      responderError(
        res,
        error
      );
    }
  }
);


/* ============================================================
   MODELOS
   ============================================================ */

router.get(
  "/modelos",
  requerirEmpresa,
  async (req, res) => {

    try {

      const marca =
        req.query.marca
          ? String(req.query.marca).trim()
          : null;

      const rubro =
        req.query.rubro
          ? String(req.query.rubro).trim()
          : null;

      const texto =
        req.query.texto
          ? String(req.query.texto).trim()
          : null;

      const licencia =
        req.query.licencia
          ? String(req.query.licencia).trim()
          : null;

      const datos =
        await maestrosService.buscarModelos({
          idEmpresa:
            req.idEmpresa,

          acceso:
            req.accesoEmpresa,

          marca,
          rubro,
          texto,
          licencia
        });

      res.json({
        ok: true,
        idEmpresa:
          req.idEmpresa,
        cantidad:
          datos.length,
        filtros: {
          marca,
          rubro,
          texto,
          licencia
        },
        datos
      });

    } catch (error) {

      console.error(error);

      responderError(
        res,
        error
      );
    }
  }
);


module.exports =
  router;
