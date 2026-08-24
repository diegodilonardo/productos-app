const express = require('express');
const pedidosService = require('../services/pedidos.service');

const router = express.Router();

/* ============================================================
   LISTAR PEDIDOS
   ============================================================ */
router.get('/', async (req, res) => {
  try {
    const resultado = await pedidosService.listarPedidos();

    res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   ALTAS DISPONIBLES PARA PEDIDOS
   ============================================================ */
router.get('/altas-disponibles', async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerAltasDisponibles();

    res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   PROVEEDORES PRESENTES EN UN ALTA
   ============================================================ */
router.get('/altas/:idAlta/proveedores', async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerProveedoresPorAlta(
      req.params.idAlta
    );

    res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   PRODUCTOS DISPONIBLES DEL ALTA + PROVEEDOR

   GET /api/pedidos/altas/12/productos?codigoProveedor=80005
   ============================================================ */
router.get('/altas/:idAlta/productos', async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerProductosDisponibles(
      req.params.idAlta,
      req.query.codigoProveedor
    );

    res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   CREAR PEDIDO

   BODY:
   {
     idAlta,
     codigoProveedor,
     numeroOrden,
     moneda,
     observaciones,
     usuarioCreacion
   }
   ============================================================ */
router.post('/', async (req, res) => {
  try {
    const resultado = await pedidosService.crearPedido(
      req.body || {}
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Pedido creado correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   LISTAR DETALLE DEL PEDIDO
   IMPORTANTE: mantener antes de GET /:id
   ============================================================ */
router.get('/:id/detalle', async (req, res) => {
  try {
    const resultado = await pedidosService.listarDetallePedido(
      req.params.id
    );

    res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   AGREGAR PRODUCTO AL PEDIDO

   BODY:
   {
     idProducto,
     cantidadPares,
     precioFobPar,
     adicional,
     observaciones
   }
   ============================================================ */
router.post('/:id/detalle', async (req, res) => {
  try {
    const resultado = await pedidosService.agregarProductoPedido(
      req.params.id,
      req.body || {}
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Producto agregado al pedido correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   MODIFICAR PRODUCTO DEL PEDIDO

   Solo permitido mientras el pedido está en BORRADOR.

   BODY:
   {
     cantidadPares,
     precioFobPar,
     adicional,
     observaciones
   }
   ============================================================ */
router.put('/:id/detalle/:idDetalle', async (req, res) => {
  try {
    const resultado = await pedidosService.actualizarProductoPedido(
      req.params.id,
      req.params.idDetalle,
      req.body || {}
    );

    res.json({
      ok: true,
      mensaje: 'Producto del pedido actualizado correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   ELIMINAR PRODUCTO DEL PEDIDO

   Solo permitido mientras el pedido está en BORRADOR.
   ============================================================ */
router.delete('/:id/detalle/:idDetalle', async (req, res) => {
  try {
    const resultado = await pedidosService.eliminarProductoPedido(
      req.params.id,
      req.params.idDetalle
    );

    res.json({
      ok: true,
      mensaje: 'Producto eliminado del pedido correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

/* ============================================================
   VALIDAR PEDIDO

   BODY:
   {
     usuarioValidacion
   }

   BORRADOR -> VALIDADO
   ============================================================ */
router.post('/:id/validar', async (req, res) => {
  try {
    const resultado = await pedidosService.validarPedido(
      req.params.id,
      req.body || {}
    );

    res.json({
      ok: true,
      mensaje: 'Pedido validado correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});


/* ============================================================
   ANULAR PEDIDO

   BODY:
   {
     motivoAnulacion,
     usuarioAnulacion
   }

   También acepta los alias: motivo / usuario.

   BORRADOR -> ANULADO
   VALIDADO -> ANULADO
   SINCRONIZADO -> NO PERMITIDO
   ============================================================ */
router.post('/:id/anular', async (req, res) => {
  try {
    const resultado = await pedidosService.anularPedido(
      req.params.id,
      req.body || {}
    );

    res.json({
      ok: true,
      mensaje: 'Pedido anulado correctamente.',
      resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});



/* ============================================================
   EXPORTAR PEDIDO VALIDADO A EXCEL

   GET /api/pedidos/:id/exportacion/pedido-excel
   ============================================================ */
router.get('/:id/exportacion/pedido-excel', async (req, res) => {
  try {
    const resultado = await pedidosService.exportarPedidoExcel(
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
      'X-Cantidad-Registros',
      String(resultado.cantidadRegistros)
    );

    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});


/* ============================================================
   EXPORTAR MASTER_DATA_APP DEL PEDIDO VALIDADO

   GET /api/pedidos/:id/exportacion/master-data-app
   ============================================================ */
router.get('/:id/exportacion/master-data-app', async (req, res) => {
  try {
    const resultado = await pedidosService.exportarMasterDataAppExcel(
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
      'X-Cantidad-Registros',
      String(resultado.cantidadRegistros)
    );

    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});


/* ============================================================
   EXPORTAR PREC_FOB.DBI DEL PEDIDO VALIDADO

   GET /api/pedidos/:id/exportacion/prec-fob
   ============================================================ */
router.get('/:id/exportacion/prec-fob', async (req, res) => {
  try {
    const resultado = await pedidosService.exportarPrecFobDBI(
      req.params.id
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resultado.nombreArchivo}"`
    );
    res.setHeader(
      'X-Cantidad-Registros',
      String(resultado.cantidadRegistros)
    );

    return res.send(resultado.buffer);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});


/* ============================================================
   HISTORIAL DE EXPORTACIONES DEL PEDIDO

   GET /api/pedidos/:id/exportaciones
   ============================================================ */
router.get('/:id/exportaciones', async (req, res) => {
  try {
    const resultado = await pedidosService.listarExportacionesPedido(
      req.params.id
    );

    return res.json({
      ok: true,
      cantidad: resultado.length,
      datos: resultado,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});


/* ============================================================
   OBTENER PEDIDO POR ID
   IMPORTANTE: dejar esta ruta al final.
   ============================================================ */
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pedidosService.obtenerPedidoPorId(
      req.params.id
    );

    if (!resultado) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Pedido no encontrado.',
      });
    }

    return res.json({
      ok: true,
      resultado,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

module.exports = router;
