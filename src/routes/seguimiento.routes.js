const express = require('express');

const seguimientoService =
    require('../services/seguimiento.service');

const {
    requerirAutenticacion,
    requerirEmpresa,
    requerirAccesoAlta,
} = require('../middlewares/auth.middleware');

const router = express.Router();


/*
 * Todo Seguimiento requiere sesión.
 */
router.use(requerirAutenticacion);


/* ============================================================
   GET /api/seguimiento/resumen
   ============================================================ */
router.get(
    '/resumen',
    requerirEmpresa,
    async (req, res) => {
        try {
            const resultado =
                await seguimientoService.obtenerResumen({
                    idEmpresa: req.idEmpresa,
                    acceso: req.accesoEmpresa,
                });

            return res.json({
                ok: true,
                resultado,
            });
        } catch (error) {
            return res
                .status(error.status || 500)
                .json({
                    ok: false,
                    mensaje: error.message,
                });
        }
    }
);


/* ============================================================
   GET /api/seguimiento/altas
   ============================================================ */
router.get(
    '/altas',
    requerirEmpresa,
    async (req, res) => {
        try {
            const resultado =
                await seguimientoService.listarAltas(
                    req.query.estado,
                    {
                        idEmpresa: req.idEmpresa,
                        acceso: req.accesoEmpresa,
                    }
                );

            return res.json({
                ok: true,
                cantidad: resultado.length,
                resultado,
            });
        } catch (error) {
            return res
                .status(error.status || 400)
                .json({
                    ok: false,
                    mensaje: error.message,
                });
        }
    }
);


/* ============================================================
   GET /api/seguimiento/altas/:id
   ============================================================ */
router.get(
    '/altas/:id',
    requerirAccesoAlta,
    async (req, res) => {
        try {
            const resultado =
                await seguimientoService.obtenerAlta(
                    req.params.id,
                    {
                        idEmpresa: req.idEmpresa,
                        acceso: req.accesoEmpresa,
                    }
                );

            return res.json({
                ok: true,
                resultado,
            });
        } catch (error) {
            const status =
                error.status ||
                (error.message === 'Alta no encontrada.'
                    ? 404
                    : 400);

            return res.status(status).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


module.exports = router;
