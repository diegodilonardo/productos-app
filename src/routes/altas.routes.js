const express = require('express');

const router = express.Router();

const altasService =
    require('../services/altas.service');

const exportacionService =
    require('../services/exportacion.service');

const modelosBusquedaService =
    require('../services/modelosBusqueda.service');

const borradorExcelService =
    require('../services/borradorExcel.service');

const {
    requerirAutenticacion,
    requerirEmpresa,
    requerirEscrituraEmpresa,
    requerirAccesoAlta
} =
    require('../middlewares/auth.middleware');


router.use(
    requerirAutenticacion
);


/* ============================================================
   CREAR ALTA
   ============================================================ */

router.post('/', requerirEmpresa, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado =
            await altasService.crearAlta(
                {
                    ...(req.body || {}),
                    idEmpresa: req.idEmpresa,
                    usuario: req.usuario.usuario
                },
                req.usuario
            );

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

router.get('/', requerirEmpresa, async (req, res) => {
    try {
        const resultado =
            await altasService.listarAltas(req.idEmpresa);

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

router.post('/:id/detalle', requerirAccesoAlta, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado =
            await altasService.agregarDetalle(
                req.params.id,
                {
                    ...(req.body || {}),
                    usuario: req.usuario.usuario
                },
                req.usuario
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

router.delete('/:id/detalle/:idDetalle', requerirAccesoAlta, requerirEscrituraEmpresa, async (req, res) => {
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

router.post('/:id/validar', requerirAccesoAlta, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado =
            await altasService.validarAlta(
                req.params.id,
                {
                    ...(req.body || {}),
                    usuario: req.usuario.usuario
                }
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

router.post('/:id/anular', requerirAccesoAlta, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado =
            await altasService.anularAlta(
                req.params.id,
                {
                    ...(req.body || {}),
                    usuario: req.usuario.usuario
                }
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

router.get('/:id/exportacion/preview', requerirAccesoAlta, async (req, res) => {
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
   EXPORTAR PREVIEW A EXCEL
   ============================================================ */

router.get('/:id/exportacion/preview-excel', requerirAccesoAlta, async (req, res) => {
    try {
        const resultado =
            await exportacionService.exportarPreviewExcel(
                req.params.id
            );

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${resultado.nombreArchivo}"`
        );

        res.setHeader(
            'Content-Length',
            resultado.buffer.length
        );

        res.end(
            resultado.buffer
        );

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

router.post('/:id/exportar', requerirAccesoAlta, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado =
            await exportacionService.exportar(
                req.params.id,
                {
                    ...(req.body || {}),
                    usuario: req.usuario.usuario
                }
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
   EXCEL BORRADOR DE MODULOS
   SOLO ESTADO BORRADOR
   ============================================================ */

router.get('/:id/borrador-excel', requerirAccesoAlta, async (req, res) => {
    try {

        const protocolo =
            req.get('x-forwarded-proto') ||
            req.protocol;

        const host =
            req.get('host');

        const baseUrl =
            `${protocolo}://${host}`;


        const resultado =
            await borradorExcelService
                .generarBorradorExcel(
                    req.params.id,
                    baseUrl
                );


        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${resultado.nombreArchivo}"`
        );

        res.setHeader(
            'Content-Length',
            resultado.buffer.length
        );


        res.end(
            resultado.buffer
        );

    } catch (error) {

        res.status(
            400
        ).json({
            ok:
                false,

            mensaje:
                error.message
        });
    }
});


/* ============================================================
   BUSCAR MODELOS DEL ALTA
   ============================================================ */

router.get('/:id/modelos', requerirAccesoAlta, async (req, res) => {
    try {
        const resultado =
            await modelosBusquedaService.buscarModelosPorAlta(
                req.params.id,
                req.query.buscar || '',
                req.query.limite || 60
            );

        res.json({
            ok: true,
            cantidad: resultado.cantidad,
            criterio: resultado.criterio,
            datos: resultado.datos
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

router.get('/:id', requerirAccesoAlta, async (req, res) => {
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
