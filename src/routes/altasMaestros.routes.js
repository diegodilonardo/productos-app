const express = require('express');
const service = require('../services/altasMaestros.service');
const { requerirAutenticacion, requerirEmpresa, requerirEscrituraEmpresa } = require('../middlewares/auth.middleware');
const router = express.Router();

router.use(requerirAutenticacion, requerirEmpresa);
router.get('/', async (req, res) => {
  try { res.json({ ok: true, registros: await service.listar(req.idEmpresa, req.session?.usuario?.usuario || 'SISTEMA') }); }
  catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});
router.get('/siguiente-codigo/:tipo', async (req, res) => {
  try {
    const codigo = String(req.params.tipo).toUpperCase() === 'MODELO'
      ? await service.sugerirCodigoModelo(req.idEmpresa, req.query)
      : await service.sugerirCodigo(req.idEmpresa, req.params.tipo);
    res.json({ ok: true, codigo });
  }
  catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});
router.get('/modelos/template', requerirEscrituraEmpresa, async (req, res) => {
  try {
    const archivo = await service.generarTemplateModelos(req.idEmpresa);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ALTA_MODELOS_TEMPLATE.xlsx"');
    res.send(Buffer.from(archivo));
  } catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});
router.post('/', requerirEscrituraEmpresa, async (req, res) => {
  try {
    const registro = await service.crear({ idEmpresa: req.idEmpresa, usuario: req.session?.usuario?.usuario || 'SISTEMA', cuerpo: req.body || {} });
    res.status(201).json({ ok: true, registro });
  } catch (e) {
    const duplicado = [2601, 2627].includes(Number(e.number));
    res.status(duplicado ? 409 : (e.status || 500)).json({ ok: false, mensaje: duplicado ? 'Ese código ya existe o está reservado.' : e.message });
  }
});
router.post('/modelos/vista-previa', requerirEscrituraEmpresa, express.raw({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], limit: '5mb' }), async (req, res) => {
  try { res.json({ ok: true, ...(await service.previsualizarModelos({ idEmpresa: req.idEmpresa, buffer: req.body, contexto: req.query })) }); }
  catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});
router.post('/modelos/confirmar', requerirEscrituraEmpresa, async (req, res) => {
  try {
    const registros = await service.crearModelosMasivos({ idEmpresa: req.idEmpresa, usuario: req.session?.usuario?.usuario || 'SISTEMA', filas: req.body?.filas });
    res.status(201).json({ ok: true, registros, cantidad: registros.length });
  } catch (e) {
    const duplicado = [2601, 2627].includes(Number(e.number));
    res.status(duplicado ? 409 : (e.status || 500)).json({ ok: false, mensaje: duplicado ? 'Uno de los códigos ya existe o fue reservado.' : e.message });
  }
});
router.post('/modelos/descargar-vista-previa', requerirEscrituraEmpresa, async (req, res) => {
  try {
    const archivo = service.generarExcelVistaPreviaModelos(req.body?.filas);
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MODELOS_ASIGNADOS_${fecha}.xlsx"`);
    res.send(archivo);
  } catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});
router.post('/enviar-presea', requerirEscrituraEmpresa, async (req, res) => {
  try { res.json({ ok: true, ...(await service.enviarPresea({ idEmpresa: req.idEmpresa, usuario: req.session?.usuario?.usuario })) }); }
  catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
});

module.exports = router;
