const express = require('express');

const router = express.Router();

const altasService =
    require('../services/altas.service');

const exportacionService =
    require('../services/exportacion.service');


/* ============================================================
   CREAR ALTA
   ============================================================ */

router.post('/', async (req, res) => {
    try {
        const resultado =
            await altasService.crearAlta(req.body || {});

        res.status(201).json({
            ok: true,
            mensaje: 'Alta creada correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   LISTAR ALTAS
   ============================================================ */

router.get('/', async (req, res) => {
    try {
        const resultado =
            await altasService.listarAltas();

        res.json({
            ok: true,
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   AGREGAR DETALLE / PRODUCTOS
   ============================================================ */

router.post('/:id/detalle', async (req, res) => {
    try {
        const resultado =
            await altasService.agregarDetalle(
                req.params.id,
                req.body || {}
            );

        res.status(201).json({
            ok: true,
            mensaje:
                `${resultado.cantidad} productos agregados correctamente.`,
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   ELIMINAR DETALLE
   ============================================================ */

router.delete('/:id/detalle/:idDetalle', async (req, res) => {
    try {
        const resultado =
            await altasService.eliminarDetalle(
                req.params.id,
                req.params.idDetalle
            );

        res.json({
            ok: true,
            mensaje: 'Producto eliminado correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   VALIDAR ALTA
   ============================================================ */

router.post('/:id/validar', async (req, res) => {
    try {
        const resultado =
            await altasService.validarAlta(
                req.params.id,
                req.body || {}
            );

        res.json({
            ok: true,
            mensaje: 'Alta validada correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   ANULAR ALTA
   ============================================================ */

router.post('/:id/anular', async (req, res) => {
    try {
        const resultado =
            await altasService.anularAlta(
                req.params.id,
                req.body || {}
            );

        res.json({
            ok: true,
            mensaje: 'Alta anulada correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   PREVIEW EXPORTACION
   ============================================================ */

router.get('/:id/exportacion/preview', async (req, res) => {
    try {
        const resultado =
            await exportacionService.obtenerPreview(
                req.params.id
            );

        res.json({
            ok: true,
            mensaje: 'Preview de exportación generado correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   EXPORTAR DBI
   ============================================================ */

router.post('/:id/exportar', async (req, res) => {
    try {
        const resultado =
            await exportacionService.exportar(
                req.params.id,
                req.body || {}
            );

        res.json({
            ok: true,
            mensaje: 'Archivo DBI generado correctamente.',
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


/* ============================================================
   OBTENER ALTA POR ID
   IMPORTANTE: DEJAR ESTA RUTA AL FINAL
   ============================================================ */

router.get('/:id', async (req, res) => {
    try {
        const resultado =
            await altasService.obtenerAlta(req.params.id);

        if (!resultado) {
            return res.status(404).json({
                ok: false,
                mensaje: 'Alta no encontrada.'
            });
        }

        res.json({
            ok: true,
            resultado
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


module.exports = router;
