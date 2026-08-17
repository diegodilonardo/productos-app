const express = require('express');

const seguimientoService =
    require('../services/seguimiento.service');

const router = express.Router();


/*
 * GET /api/seguimiento/resumen
 *
 * Resumen general de altas y conciliación ERP.
 */
router.get(
    '/resumen',
    async (req, res) => {

        try {

            const resultado =
                await seguimientoService
                    .obtenerResumen();

            res.json({
                ok: true,
                resultado,
            });

        } catch (error) {

            res.status(500).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


/*
 * GET /api/seguimiento/altas
 * GET /api/seguimiento/altas?estado=EXPORTADO
 */
router.get(
    '/altas',
    async (req, res) => {

        try {

            const resultado =
                await seguimientoService
                    .listarAltas(
                        req.query.estado
                    );

            res.json({
                ok: true,
                cantidad: resultado.length,
                resultado,
            });

        } catch (error) {

            res.status(400).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


/*
 * GET /api/seguimiento/altas/:id
 *
 * Devuelve:
 * - cabecera del alta
 * - progreso ERP
 * - todos los COD_ALFA exportados
 * - CODIGO_ERP / EAN_ERP / estado de cada producto
 */
router.get(
    '/altas/:id',
    async (req, res) => {

        try {

            const resultado =
                await seguimientoService
                    .obtenerAlta(
                        req.params.id
                    );

            res.json({
                ok: true,
                resultado,
            });

        } catch (error) {

            const status =
                error.message === 'Alta no encontrada.'
                    ? 404
                    : 400;

            res.status(status).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


module.exports = router;
