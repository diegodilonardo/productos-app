const test = require('node:test');
const assert = require('node:assert/strict');

const pedidosService = require('../src/services/pedidos.service');
const pedidosRepository = require('../src/repositories/pedidos.repository');

const accesoTotal = {
  todasMarcas: true,
  todosRubros: true,
  todasLicencias: true,
};

function crearEntornoControlado(t) {
  const originales = {};
  const reemplazar = (nombre, implementacion) => {
    originales[nombre] = pedidosRepository[nombre];
    pedidosRepository[nombre] = implementacion;
  };
  t.after(() => {
    for (const [nombre, implementacion] of Object.entries(originales)) {
      pedidosRepository[nombre] = implementacion;
    }
  });

  const sql = {
    alta: {
      ID_ALTA: 6,
      ID_EMPRESA: 2,
      CODIGO_ALTA: 'ALT-TEST-INTEGRAL',
      CODIGO_MARCA: '47',
      CODIGO_RUBRO: 'CALZADO',
      LICENCIA_ALTA: 'SIN LICENCIA',
      TIPO_PRODUCTO: 'MODULO',
      ESTADO: 'GENERADO_OK_EN_ERP',
    },
    proveedor: {
      CODIGO_PROVEEDOR: 'PB0004',
      DETALLE_PROVEEDOR: 'AMY',
    },
    producto: {
      ID_PRODUCTO: 101,
      TIPO_PRODUCTO_DETALLE: 'MODULO',
      CODIGO_ALFA: '2621470484810T',
      CODIGO_MODELO: '2621470484810',
      DETALLE_MODELO: 'ZAPATILLAS TEST',
      CODIGO_COLOR: 'NEGRO',
      DETALLE_COLOR: 'NEGRO',
      DETALLE_PRODUCTO: 'ZAPATILLAS TEST NEGRO 35-40 12P',
      CODIGO_MODULO: '233211',
      DETALLE_MODULO: '35 AL 40 X 12',
      DETALLE_EDAD: 'ADULTO',
      PARES: 12,
      CODIGO_ANO: '27',
      CODIGO_TEMPORADA: 'VE',
    },
    pedido: null,
    detalles: [],
  };

  reemplazar('obtenerAltaDisponiblePorId', async () => sql.alta);
  reemplazar('obtenerProveedoresPorAlta', async () => [sql.proveedor]);
  reemplazar('buscarPedidoDuplicadoActivo', async () => null);
  reemplazar('crearPedido', async (cabecera, generarCodigo) => {
    sql.pedido = {
      ...cabecera,
      ID_PEDIDO: 1,
      CODIGO_PEDIDO: generarCodigo({
        idPedido: 1,
        codigoProveedor: cabecera.CODIGO_PROVEEDOR,
        numeroOrden: cabecera.NUMERO_ORDEN,
        codigoAlta: cabecera.CODIGO_ALTA,
      }),
    };
    return sql.pedido;
  });
  reemplazar('obtenerPedidoPorId', async () => sql.pedido);
  reemplazar('obtenerProductosDisponibles', async () => [sql.producto]);
  reemplazar('buscarProductoEnPedido', async (_idPedido, idProducto) =>
    sql.detalles.find(item => Number(item.ID_PRODUCTO) === Number(idProducto)) || null
  );
  reemplazar('agregarProductoPedido', async detalle => {
    const guardado = { ...detalle, ID_PEDIDO_DETALLE: sql.detalles.length + 1 };
    sql.detalles.push(guardado);
    return guardado;
  });

  const ftp = {
    enviados: [],
    async enviar(nombre, ruta) {
      this.enviados.push({ nombre, ruta });
    },
  };

  const erp = {
    confirmados: new Map(),
    confirmar(codigoAlfa, codigoErp) {
      this.confirmados.set(codigoAlfa, codigoErp);
    },
  };

  return { sql, ftp, erp };
}

test('circuito integral controlado: Alta ERP -> Pedido -> FTP -> conciliación', async t => {
  const entorno = crearEntornoControlado(t);

  const pedido = await pedidosService.crearPedido({
    idAlta: 6,
    codigoProveedor: 'PB0004',
    numeroOrden: 'TEST-1000',
    moneda: 'USD',
    observaciones: 'Prueba integral automática',
  }, 2, accesoTotal, 'TEST_AUTOMATICO');

  assert.equal(pedido.ESTADO, 'BORRADOR');
  assert.match(pedido.CODIGO_PEDIDO, /^PED-000001-PB0004-TEST-1000-ALT-TEST-INTEGRAL$/);

  const detalle = await pedidosService.agregarProductoPedido(1, {
    idProducto: 101,
    cantidadPares: 120,
    precioFobPar: 2.6,
    adicional: 0.3,
  }, 2, accesoTotal);

  assert.equal(detalle.CANTIDAD_MODULOS, 10);
  assert.equal(detalle.CANTIDAD_PARES, 120);
  assert.equal(detalle.TOTAL_FOB, 312);
  assert.equal(detalle.TOTAL_PRODUCTO, 348);

  entorno.sql.pedido.ESTADO = 'VALIDADO';

  const destinos = pedidosService._internals.evaluarDestinosExportacionPedido(2, '47', {
    ACTIVA: true,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\MIDING\\47_STREET',
    RUTA_MASTER_DATA_APP: 'PEDIDOS\\MIDING\\47_STREET',
    RUTA_PREC_FOB: 'PEDIDOS\\MIDING\\47_STREET',
  });
  assert.equal(destinos.configurada, true);

  const archivos = [
    ['PEDIDO_TEST-1000_AMY.xlsx', destinos.rutas.PEDIDO_EXCEL],
    ['MASTER_DATA_APP_47_STREET_TEST-1000.xlsx', destinos.rutas.MASTER_DATA_APP],
    ['PREC_FOB_TEST-1000.DBI', destinos.rutas.PREC_FOB],
  ];
  for (const [nombre, ruta] of archivos) await entorno.ftp.enviar(nombre, ruta);

  assert.equal(entorno.ftp.enviados.length, 3);
  assert.equal(new Set(entorno.ftp.enviados.map(item => item.ruta)).size, 1);

  entorno.erp.confirmar(detalle.CODIGO_ALFA, '1449592');
  entorno.sql.alta.ESTADO = 'GENERADO_OK_EN_ERP';

  assert.equal(entorno.erp.confirmados.get('2621470484810T'), '1449592');
  assert.equal(entorno.sql.alta.ESTADO, 'GENERADO_OK_EN_ERP');
  assert.equal(entorno.sql.pedido.ESTADO, 'VALIDADO');
});

test('el circuito se detiene antes de SQL y FTP si los pares no forman módulos exactos', async t => {
  const entorno = crearEntornoControlado(t);
  await pedidosService.crearPedido({
    idAlta: 6,
    codigoProveedor: 'PB0004',
    numeroOrden: 'TEST-INVALIDO',
  }, 2, accesoTotal, 'TEST_AUTOMATICO');

  await assert.rejects(
    pedidosService.agregarProductoPedido(1, {
      idProducto: 101,
      cantidadPares: 263,
      precioFobPar: 2.6,
      adicional: 0,
    }, 2, accesoTotal),
    /no es divisible exactamente/
  );

  assert.equal(entorno.sql.detalles.length, 0);
  assert.equal(entorno.ftp.enviados.length, 0);
  assert.equal(entorno.erp.confirmados.size, 0);
});
