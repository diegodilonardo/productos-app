const express = require('express');
const archiver = require('archiver');

const seguimientoService =
    require('../services/seguimiento.service');

const {
    requerirAutenticacion,
    requerirEmpresa,
    requerirEscrituraEmpresa,
    requerirAccesoAlta,
} = require('../middlewares/auth.middleware');

const router = express.Router();

function usuarioAuditoria(req) {
    const contexto = req.usuario || req.session?.usuario || {};
    return String(
        contexto.usuario ?? contexto.USUARIO ?? contexto.nombreUsuario ??
        contexto.NOMBRE_USUARIO ?? 'SISTEMA'
    ).trim() || 'SISTEMA';
}


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


router.get(
    '/ean',
    requerirEmpresa,
    async (req, res) => {
        try {
            const resultado = await seguimientoService.listarSeguimientoEan({
                idEmpresa: req.idEmpresa,
                acceso: req.accesoEmpresa,
            });
            return res.json({ ok: true, resultado });
        } catch (error) {
            return res.status(error.status || 400).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


router.get(
    '/ean/pendientes.xlsx',
    requerirEmpresa,
    async (req, res) => {
        try {
            const archivo = await seguimientoService.exportarPendientesEan({
                idEmpresa: req.idEmpresa,
                acceso: req.accesoEmpresa,
            });
            const fecha = new Date().toISOString().slice(0, 10);
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="PENDIENTES_GS1_${fecha}.xlsx"`
            );
            return res.send(Buffer.from(archivo));
        } catch (error) {
            return res.status(error.status || 400).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


router.post(
    '/ean/imagenes.zip',
    requerirEmpresa,
    async (req, res) => {
        try {
            const resultado = await seguimientoService.prepararImagenesEan(
                req.body?.clavesProducto,
                { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa }
            );
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="IMAGENES_GS1_400X400.zip"');
            if (resultado.omitidos.length) {
                res.setHeader('X-Imagenes-Omitidas', String(resultado.omitidos.length));
            }
            const zip = archiver('zip', { zlib: { level: 9 } });
            zip.on('error', error => res.destroy(error));
            zip.pipe(res);
            resultado.imagenes.forEach(imagen => zip.append(imagen.buffer, { name: imagen.nombre }));
            if (resultado.omitidos.length) {
                zip.append(
                    `Productos sin imagen disponible:\r\n${resultado.omitidos.join('\r\n')}`,
                    { name: 'imagenes_no_encontradas.txt' }
                );
            }
            await zip.finalize();
        } catch (error) {
            if (!res.headersSent) {
                return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
            }
            return res.destroy(error);
        }
    }
);


router.post(
    '/ean/etiquetas',
    requerirEmpresa,
    async (req, res) => {
        try {
            const resultado = await seguimientoService.prepararEtiquetasEan(
                req.body?.clavesProducto,
                { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa }
            );
            return res.render('seguimiento/etiquetas', {
                layout: false,
                title: 'Impresión de etiquetas',
                ...resultado,
            });
        } catch (error) {
            return res.status(error.status || 400).json({
                ok: false,
                mensaje: error.message,
            });
        }
    }
);


router.post(
    '/ean/urls-temporales',
    requerirEmpresa,
    requerirEscrituraEmpresa,
    async (req, res) => {
        try {
            const base64 = String(req.body?.archivoBase64 || '');
            if (!base64 || base64.length > 14_000_000) {
                throw new Error('Seleccione un archivo Excel válido de hasta 10 MB.');
            }
            const resultado = await seguimientoService.asociarUrlsTemporalesEan(
                Buffer.from(base64, 'base64'),
                req.body?.clavesProducto,
                {
                    idEmpresa: req.idEmpresa,
                    acceso: req.accesoEmpresa,
                    usuario: usuarioAuditoria(req),
                }
            );
            return res.json({ ok: true, resultado });
        } catch (error) {
            return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
        }
    }
);


router.post(
    '/ean/archivo-gs1.xlsx',
    requerirEmpresa,
    async (req, res) => {
        try {
            const archivo = await seguimientoService.generarArchivoGs1(
                req.body?.asociaciones,
                { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa }
            );
            const fecha = new Date().toISOString().slice(0, 10);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="ALTA_GS1_${fecha}.xlsx"`);
            return res.send(Buffer.from(archivo));
        } catch (error) {
            return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
        }
    }
);

router.post('/ean/importar-codigos', requerirEmpresa, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const base64 = String(req.body?.archivoBase64 || '');
        if (!base64 || base64.length > 14_000_000) throw new Error('Seleccione un Excel de hasta 10 MB.');
        const resultado = await seguimientoService.importarCodigosEanGs1(
            Buffer.from(base64, 'base64'), req.body?.nombreArchivo,
            req.body?.clavesProducto,
            { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa, usuario: usuarioAuditoria(req) }
        );
        return res.json({ ok: true, resultado });
    } catch (error) { return res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

router.post('/ean/exportar-gtin.dbi', requerirEmpresa, async (req, res) => {
    try {
        const archivo = await seguimientoService.exportarGtinDbi(
            req.body?.clavesProducto,
            { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa }
        );
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="GTIN.DBI"');
        return res.send(archivo);
    } catch (error) { return res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

router.post('/ean/enviar-gtin-presea', requerirEmpresa, requerirEscrituraEmpresa, async (req, res) => {
    try {
        const resultado = await seguimientoService.enviarGtinDbiAPresea(
            req.body?.clavesProducto,
            { idEmpresa: req.idEmpresa, acceso: req.accesoEmpresa, usuario: usuarioAuditoria(req) }
        );
        return res.json({ ok: true, resultado });
    } catch (error) { return res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});


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
