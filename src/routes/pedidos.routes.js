const express = require('express');
const pedidosService = require('../services/pedidos.service');

const {
  requerirAutenticacion,
  requerirEmpresa,
  requerirEscrituraEmpresa,
  requerirAccesoAlta,
  requerirAccesoPedido
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requerirAutenticacion);

function usuarioAuditoria(req) {
  const contexto = req.usuario || req.session?.usuario || {};

  return String(
    contexto.usuario ??
    contexto.USUARIO ??
    contexto.nombreUsuario ??
    contexto.NOMBRE_USUARIO ??
    'SISTEMA'
  ).trim() || 'SISTEMA';
}

router.get('/', requerirEmpresa, async (req, res) => {
  try {
    const datos = await pedidosService.listarPedidos(req.idEmpresa, req.accesoEmpresa);
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/altas-disponibles', requerirEmpresa, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerAltasDisponibles(req.idEmpresa, req.accesoEmpresa);
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/altas/proveedores', requerirEmpresa, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerProveedoresPorAltas(
      req.body?.idsAltas, req.idEmpresa, req.accesoEmpresa
    );
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/altas/productos', requerirEmpresa, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerProductosDisponiblesPorAltas(
      req.body?.idsAltas, req.body?.codigoProveedor,
      req.idEmpresa, req.accesoEmpresa
    );
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/altas/:idAlta/proveedores', requerirAccesoAlta, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerProveedoresPorAlta(
      req.params.idAlta,
      req.idEmpresa,
      req.accesoEmpresa
    );
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/altas/:idAlta/resumen-modelos', requerirAccesoAlta, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerResumenModelosAlta(
      req.params.idAlta,
      req.idEmpresa,
      req.accesoEmpresa
    );
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/altas/:idAlta/productos', requerirAccesoAlta, async (req, res) => {
  try {
    const datos = await pedidosService.obtenerProductosDisponibles(
      req.params.idAlta,
      req.query.codigoProveedor,
      req.idEmpresa,
      req.accesoEmpresa
    );
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/', requerirEmpresa, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.crearPedido(
      req.body || {},
      req.idEmpresa,
      req.accesoEmpresa,
      usuarioAuditoria(req)
    );
    return res.status(201).json({ ok: true, mensaje: 'Pedido creado correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/detalle', requerirAccesoPedido, async (req, res) => {
  try {
    const datos = await pedidosService.listarDetallePedido(req.params.id, req.idEmpresa);
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/:id/detalle', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.agregarProductoPedido(
      req.params.id, req.body || {}, req.idEmpresa, req.accesoEmpresa
    );
    return res.status(201).json({ ok: true, mensaje: 'Producto agregado al pedido correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.put('/:id/detalle/:idDetalle', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.actualizarProductoPedido(
      req.params.id, req.params.idDetalle, req.body || {}, req.idEmpresa
    );
    return res.json({ ok: true, mensaje: 'Producto del pedido actualizado correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.delete('/:id/detalle/:idDetalle', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.eliminarProductoPedido(
      req.params.id, req.params.idDetalle, req.idEmpresa
    );
    return res.json({ ok: true, mensaje: 'Producto eliminado del pedido correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/:id/validar', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.validarPedido(
      req.params.id, req.body || {}, req.idEmpresa, usuarioAuditoria(req)
    );
    return res.json({ ok: true, mensaje: 'Pedido validado correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/:id/anular', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.anularPedido(
      req.params.id, req.body || {}, req.idEmpresa, usuarioAuditoria(req)
    );
    return res.json({ ok: true, mensaje: 'Pedido anulado correctamente.', resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/exportacion/pedido-excel', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.exportarPedidoExcel(
      req.params.id, req.idEmpresa, usuarioAuditoria(req)
    );
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${resultado.nombreArchivo}"`);
    res.setHeader('X-Cantidad-Registros',String(resultado.cantidadRegistros));
    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/exportacion/master-data-app', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.exportarMasterDataAppExcel(
      req.params.id, req.idEmpresa, usuarioAuditoria(req)
    );
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${resultado.nombreArchivo}"`);
    res.setHeader('X-Cantidad-Registros',String(resultado.cantidadRegistros));
    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/exportacion/prec-fob', requerirAccesoPedido, requerirEscrituraEmpresa, async (req, res) => {
  try {
    const resultado = await pedidosService.exportarPrecFobDBI(
      req.params.id, req.idEmpresa, usuarioAuditoria(req)
    );
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition',`attachment; filename="${resultado.nombreArchivo}"`);
    res.setHeader('X-Cantidad-Registros',String(resultado.cantidadRegistros));
    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/exportaciones', requerirAccesoPedido, async (req, res) => {
  try {
    const datos = await pedidosService.listarExportacionesPedido(req.params.id, req.idEmpresa);
    return res.json({ ok: true, cantidad: datos.length, datos });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id/destinos-exportacion', requerirAccesoPedido, async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerDestinosExportacionPedido(
      req.params.id,
      req.idEmpresa
    );
    return res.json({ ok: true, resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.get('/:id', requerirAccesoPedido, async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerPedidoPorId(req.params.id, req.idEmpresa);
    if (!resultado) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });
    return res.json({ ok: true, resultado });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

module.exports = router;
