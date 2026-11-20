const express = require('express');
const service = require('../services/altasMaestros.service');
const { getConnection, sql } = require('../config/database');
const { ejecutarMaestrosEmpresaAhora } = require('../jobs/importarMaestros.job');
const { requerirAutenticacion, requerirEmpresa, requerirEscrituraEmpresa, requerirAdminUsuarios } = require('../middlewares/auth.middleware');
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
router.delete('/:id', requerirEscrituraEmpresa, async (req, res) => {
  try {
    const registro = await service.eliminarPendiente({
      idEmpresa: req.idEmpresa,
      idAltaMaestro: req.params.id,
      usuario: req.session?.usuario?.usuario || 'SISTEMA'
    });
    res.json({ ok: true, registro });
  } catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message }); }
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
router.post('/sincronizar', requerirAdminUsuarios, async (req, res) => {
  try {
    const pool = await getConnection();
    const empresa = await pool.request()
      .input('ID_EMPRESA', sql.Int, req.idEmpresa)
      .query(`
        SELECT TOP 1 CODIGO_EMPRESA, RAZON_SOCIAL
        FROM dbo.EMPRESAS
        WHERE ID_EMPRESA=@ID_EMPRESA;
      `);
    const registro = empresa.recordset[0];
    if (!registro) return res.status(404).json({ ok: false, mensaje: 'No se encontró la empresa activa.' });
    const resultado = await ejecutarMaestrosEmpresaAhora(registro.CODIGO_EMPRESA);
    if (resultado?.omitida) {
      return res.status(409).json({ ok: false, mensaje: 'Ya hay una actualización de maestros en curso. Esperá a que finalice.' });
    }
    if (!resultado?.ok) {
      return res.status(500).json({ ok: false, mensaje: 'La actualización de maestros no pudo completarse. Revisá el log del servidor.' });
    }
    return res.json({
      ok: true,
      empresa: registro.RAZON_SOCIAL,
      duracionMs: resultado.ms,
      mensaje: 'Los maestros se descargaron de Presea y se actualizaron correctamente.'
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, mensaje: e.message });
  }
});
router.get('/reglas-ean', async (req,res) => {
  try { const resultado=await service.listarReglasEan(req.idEmpresa); res.json({ok:true,datos:resultado.reglas,configuracion:resultado.configuracion}); }
  catch(e){ res.status(e.status||500).json({ok:false,mensaje:e.message}); }
});
router.put('/reglas-ean/configuracion', requerirAdminUsuarios, async (req,res) => {
  try { res.json({ok:true,configuracion:await service.guardarConfiguracionEanEmpresa({idEmpresa:req.idEmpresa,usuario:req.session?.usuario?.usuario,cuerpo:req.body||{}})}); }
  catch(e){ res.status(e.status||500).json({ok:false,mensaje:e.message}); }
});
router.post('/reglas-ean', requerirAdminUsuarios, async (req,res) => {
  try { res.json({ok:true,registro:await service.guardarReglaEan({idEmpresa:req.idEmpresa,usuario:req.session?.usuario?.usuario,cuerpo:req.body||{}})}); }
  catch(e){ res.status(e.status||500).json({ok:false,mensaje:e.message}); }
});
router.delete('/reglas-ean/:id', requerirAdminUsuarios, async (req,res) => {
  try { res.json({ok:true,registro:await service.eliminarReglaEan({idEmpresa:req.idEmpresa,idRegla:req.params.id,usuario:req.session?.usuario?.usuario})}); }
  catch(e){ res.status(e.status||500).json({ok:false,mensaje:e.message}); }
});

module.exports = router;
