const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pedidosService = require('../src/services/pedidos.service');
const pedidosRepository = require('../src/repositories/pedidos.repository');

const accesoTotal = {
  todasMarcas: true,
  todosRubros: true,
  todasLicencias: true
};

test('el resumen distingue pares de modulo y unidades de pares sueltos', async () => {
  const obtenerAltaOriginal = pedidosRepository.obtenerAltaDisponiblePorId;
  const obtenerResumenOriginal = pedidosRepository.obtenerResumenModelosAlta;

  pedidosRepository.obtenerAltaDisponiblePorId = async () => ({
    ID_ALTA: 16,
    ID_EMPRESA: 1,
    CODIGO_MARCA: '1',
    CODIGO_RUBRO: '1',
    LICENCIA_ALTA: 'SIN LICENCIA',
    TIPO_PRODUCTO: 'MODULO',
    ESTADO: 'GENERADO_OK_EN_ERP'
  });
  pedidosRepository.obtenerResumenModelosAlta = async () => [
    {
      CODIGO_MODELO: '100', DETALLE_MODELO: 'MODELO UNO',
      CODIGO_COLOR: '10', DETALLE_COLOR: 'NEGRO',
      TIPO_PRODUCTO_DETALLE: 'MODULO', DETALLE_MODULO: '36-40', PARES: 12
    },
    {
      CODIGO_MODELO: '200', DETALLE_MODELO: 'MODELO DOS',
      CODIGO_COLOR: '20', DETALLE_COLOR: 'AZUL',
      TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_TALLE: '40', PARES: null
    }
  ];

  try {
    const resultado = await pedidosService.obtenerResumenModelosAlta(16, 1, accesoTotal);
    assert.equal(resultado[0].CURVA_TALLE, '36-40');
    assert.equal(resultado[0].CANTIDAD_REFERENCIA, 12);
    assert.equal(resultado[0].UNIDAD_REFERENCIA, 'PARES');
    assert.equal(resultado[1].CURVA_TALLE, '40');
    assert.equal(resultado[1].CANTIDAD_REFERENCIA, 1);
    assert.equal(resultado[1].UNIDAD_REFERENCIA, 'UNIDAD');
  } finally {
    pedidosRepository.obtenerAltaDisponiblePorId = obtenerAltaOriginal;
    pedidosRepository.obtenerResumenModelosAlta = obtenerResumenOriginal;
  }
});

test('nuevo pedido expone el boton y el resumen visual de modelos', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/nuevo.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedido-nuevo.js'), 'utf8');

  assert.match(vista, /id="modalModelosAlta"/);
  assert.match(vista, />Modelo</);
  assert.match(vista, />Color</);
  assert.match(vista, />Curva \/ Talle</);
  assert.match(vista, />Pares \/ Unidades</);
  assert.match(cliente, /data-ver-modelos-alta/);
  assert.match(cliente, /\/resumen-modelos/);
});

test('el resumen del nuevo pedido lista todos los productos de las Altas seleccionadas', async () => {
  const obtenerAltaOriginal = pedidosRepository.obtenerAltaDisponiblePorId;
  const obtenerProductosOriginal = pedidosRepository.obtenerResumenProductosAltas;
  pedidosRepository.obtenerAltaDisponiblePorId = async id => ({
    ID_ALTA: Number(id), ID_EMPRESA: 1, CODIGO_MARCA: '1', CODIGO_RUBRO: '1',
    LICENCIA_ALTA: 'SIN LICENCIA', TIPO_PRODUCTO: 'MODULO', ESTADO: 'GENERADO_OK_EN_ERP'
  });
  pedidosRepository.obtenerResumenProductosAltas = async ids => ids.map(id => ({
    ID_ALTA: id, CODIGO_ALTA: `ALT-${id}`, DETALLE_PRODUCTO: `PRODUCTO ${id}`,
    TIPO_PRODUCTO_DETALLE: 'MODULO', DETALLE_MODULO: '35 AL 40', PARES: 12
  }));
  try {
    const resultado = await pedidosService.obtenerResumenProductosAltas([10, 11], 1, accesoTotal);
    assert.deepEqual(resultado.map(x => x.ID_ALTA), [10, 11]);
    assert.equal(resultado[0].TALLE_CURVA, '35 AL 40');
    assert.equal(resultado[0].CANTIDAD_REFERENCIA, 12);
  } finally {
    pedidosRepository.obtenerAltaDisponiblePorId = obtenerAltaOriginal;
    pedidosRepository.obtenerResumenProductosAltas = obtenerProductosOriginal;
  }

  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/nuevo.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedido-nuevo.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(__dirname, '../src/routes/pedidos.routes.js'), 'utf8');
  const repository = fs.readFileSync(path.join(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  assert.match(vista, /id="modalProductosSeleccionados"/);
  assert.match(vista, /id="verProductosSeleccionados"/);
  assert.match(vista, /id="tablaProductosSeleccionados"/);
  assert.match(cliente, /function cargarResumenProductosAltas/);
  assert.match(cliente, /function mostrarProductosSeleccionados/);
  assert.match(cliente, /\/api\/pedidos\/altas\/resumen-productos/);
  assert.match(cliente, /DETALLE_PROVEEDOR/);
  assert.match(rutas, /\/altas\/resumen-productos/);
  assert.match(repository, /P\.ID_PRODUCTO[\s\S]*INNER JOIN dbo\.PRODUCTOS P[\s\S]*P\.CODIGO_ALFA=D\.CODIGO_ALFA/);
  assert.doesNotMatch(repository, /D\.ID_PRODUCTO, D\.CODIGO_ALFA/);
});

test('nuevo pedido permite filtrar Altas por temporada, año, rubro y proveedor', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/nuevo.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedido-nuevo.js'), 'utf8');

  assert.match(vista, /id="filtroTemporadaAlta"/);
  assert.match(vista, /id="filtroAnoAlta"/);
  assert.match(vista, /id="filtroRubroAlta"/);
  assert.match(vista, /id="filtroProveedorAlta"/);
  assert.match(vista, /value="ARS">Pesos \(ARS\)/);
  assert.match(vista, /id="limpiarFiltrosAltas"/);
  assert.match(cliente, /function obtenerAltasFiltradas/);
  assert.match(cliente, /function renderizarAltasFiltradas/);
  assert.match(cliente, /function aplicarFiltrosAltas/);
  assert.match(cliente, /idsAltasSeleccionadas = new Set\([\s\S]*idsVisibles\.has/);
  assert.match(cliente, /idsAltasSeleccionadas\.has/);
  assert.match(cliente, /function proveedoresDelAlta/);
  assert.match(cliente, /proveedoresDelAlta\(alta\)\.some/);
});
