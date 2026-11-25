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
  catch (e) { res.status(e.status || 500).json({ ok: false, mensaje: e.message, destino: e.destino }); }
});

function rutaDestino(valor) {
  const ruta = service.resolverRutaDestinoMaestros(valor)?.replace(/\/+$/, '');
  if (!ruta || ruta.length > 500 || !/^\/ALTAS_MAESTROS(?:\/[A-Za-z0-9_ -]+)+$/i.test(ruta)) {
    throw Object.assign(new Error('Ingresá una carpeta válida dentro de /ALTAS_MAESTROS.'), { status: 400 });
  }
  return ruta;
}

router.use('/destinos', requerirAdminUsuarios, (req, res, next) => {
  if (req.session?.usuario?.superAdmin || ['ADMIN', 'SUPER_ADMIN'].includes(String(req.accesoEmpresa?.rol || '').toUpperCase())) return next();
  return res.status(403).json({ mensaje: 'Solo un administrador de esta empresa puede configurar sus destinos FTP.' });
});

router.get('/destinos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { recordset } = await pool.request().input('empresa', sql.Int, req.idEmpresa).query(
      'SELECT MARCA, RUBRO, LICENCIA, RUTA_DESTINO, ACTIVO FROM dbo.ALTAS_MAESTROS_DESTINOS WHERE ID_EMPRESA=@empresa ORDER BY MARCA,RUBRO,LICENCIA'
    );
    res.json({ datos: recordset });
  } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

router.post('/destinos/verificar', async (req, res) => {
  try {
    const ruta = rutaDestino(req.body?.ruta);
    await require('../services/ftp.service').verificarCarpeta(ruta);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 422).json({ mensaje: e.status ? e.message : 'No se pudo acceder a la carpeta FTP.' }); }
});

router.put('/destinos', async (req, res) => {
  try {
    const { marca, rubro, licencia, ruta, activo } = req.body || {};
    const normalizar = valor => String(valor ?? '').trim().toUpperCase();
    const clave = service.claveDestinoMaestro(marca, licencia, rubro);
    const [, licenciaCanonica] = clave.split('|');
    if ([marca, rubro, licenciaCanonica].some(v => normalizar(v).length > 50) || typeof activo !== 'boolean') {
      return res.status(400).json({ mensaje: 'Revisá la combinación del destino y su estado.' });
    }
    const pool = await getConnection();
    const request = pool.request().input('empresa', sql.Int, req.idEmpresa)
      .input('marca', sql.VarChar(50), normalizar(marca))
      .input('rubro', sql.VarChar(50), normalizar(rubro))
      .input('licencia', sql.VarChar(50), licenciaCanonica)
      .input('ruta', sql.VarChar(500), rutaDestino(ruta)).input('activo', sql.Bit, activo);
    await request.query(`
      MERGE dbo.ALTAS_MAESTROS_DESTINOS WITH (HOLDLOCK) AS D
      USING (SELECT @empresa ID_EMPRESA,@marca MARCA,@rubro RUBRO,@licencia LICENCIA) AS S
      ON D.ID_EMPRESA=S.ID_EMPRESA AND D.MARCA=S.MARCA AND D.RUBRO=S.RUBRO AND D.LICENCIA=S.LICENCIA
      WHEN MATCHED THEN UPDATE SET RUTA_DESTINO=@ruta, ACTIVO=@activo, FECHA_ACTUALIZACION=SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT(ID_EMPRESA,MARCA,RUBRO,LICENCIA,RUTA_DESTINO,ACTIVO)
        VALUES(@empresa,@marca,@rubro,@licencia,@ruta,@activo);
    `);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ mensaje: e.message }); }
});
router.post('/sincronizar', requerirEscrituraEmpresa, async (req, res) => {
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
