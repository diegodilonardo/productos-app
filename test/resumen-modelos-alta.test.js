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

test('nuevo pedido permite sugerir Altas por temporada, año y rubro', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/nuevo.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedido-nuevo.js'), 'utf8');

  assert.match(vista, /id="filtroTemporadaAlta"/);
  assert.match(vista, /id="filtroAnoAlta"/);
  assert.match(vista, /id="filtroRubroAlta"/);
  assert.match(vista, /id="limpiarFiltrosAltas"/);
  assert.match(cliente, /function obtenerAltasFiltradas/);
  assert.match(cliente, /function renderizarAltasFiltradas/);
  assert.match(cliente, /idsAltasSeleccionadas\.has/);
});
