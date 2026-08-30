const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');
const pedidosService = require('../src/services/pedidos.service');
const exportacionRepository = require('../src/repositories/exportacion.repository');

const { validarEdadSexoClasificacion } = altasService._internals;
const {
  calcularCantidadesPedido,
  evaluarDestinosExportacionPedido,
  estadoAltaHabilitadoParaPedido,
  ESTADOS_ALTAS_HABILITADOS_PEDIDOS,
} = pedidosService._internals;
const { JOIN_MAESTRO_MODULO_POR_EMPRESA } = exportacionRepository._internals;

function validarClasificacion(edad, sexo, clasificacion) {
  return validarEdadSexoClasificacion({
    tipoProducto: 'MODULO',
    edad: { DETALLE_EDAD: edad },
    sexo: { SEXO: sexo },
    clasificacion: { DETALLE_CLASIFICACION: clasificacion },
  });
}

test('ADULTO respeta la clasificación correspondiente al sexo', () => {
  assert.doesNotThrow(() => validarClasificacion('ADULTO', 'MAS', 'MOD.HOM'));
  assert.doesNotThrow(() => validarClasificacion('ADULTO', 'HOM', 'MOD.HOM'));
  assert.doesNotThrow(() => validarClasificacion('ADULTO', 'FEM', 'MOD.MUJ'));
  assert.doesNotThrow(() => validarClasificacion('ADULTO', 'UNI', 'MOD.UNI'));
  assert.throws(
    () => validarClasificacion('ADULTO', 'FEM', 'MOD.HOM'),
    /Clasificación incompatible/
  );
});

test('BABY, JUNIOR, KIDS, TEEN y YOUTH aplican su clasificación', () => {
  const casos = [
    ['BABY', 'UNI', 'MOD.BB'],
    ['JUNIOR', 'FEM', 'MOD.JUN'],
    ['KIDS', 'MAS', 'MOD.KID'],
    ['TEEN', 'UNI', 'MOD.TEEN'],
    ['YOUTH', 'FEM', 'MOD.YOUTH'],
  ];

  for (const [edad, sexo, clasificacion] of casos) {
    assert.doesNotThrow(() => validarClasificacion(edad, sexo, clasificacion));
  }
});

test('una combinación Edad/Sexo desconocida queda bloqueada', () => {
  assert.throws(
    () => validarClasificacion('ADULTO', 'SIN DEFINIR', 'MOD.UNI'),
    /No existe una regla de clasificación/
  );
});

test('PAR_SUELTO no aplica la regla Edad/Sexo de módulos', () => {
  assert.doesNotThrow(() => validarEdadSexoClasificacion({
    tipoProducto: 'PAR_SUELTO',
    edad: {},
    sexo: {},
    clasificacion: {},
  }));
});

test('cantidad válida de módulo calcula módulos exactos', () => {
  assert.deepEqual(
    calcularCantidadesPedido('MODULO', 120, 12),
    { paresModulo: 12, cantidadModulos: 10 }
  );
});

test('cantidad no divisible por el módulo queda bloqueada', () => {
  assert.throws(
    () => calcularCantidadesPedido('MODULO', 263, 12),
    /no es divisible exactamente/
  );
});

test('PAR_SUELTO no calcula módulos', () => {
  assert.deepEqual(
    calcularCantidadesPedido('PAR_SUELTO', 7, null),
    { paresModulo: null, cantidadModulos: null }
  );
});

test('un tipo de producto desconocido queda bloqueado', () => {
  assert.throws(
    () => calcularCantidadesPedido('OTRO', 12, 12),
    /Tipo de producto no habilitado/
  );
});

test('una configuración activa y completa habilita los tres destinos', () => {
  const resultado = evaluarDestinosExportacionPedido(2, '10', {
    ACTIVA: true,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\MIDING\\MONTAGNE',
    RUTA_MASTER_DATA_APP: 'PEDIDOS\\MIDING\\MONTAGNE',
    RUTA_PREC_FOB: 'PEDIDOS\\MIDING\\MONTAGNE',
  });

  assert.equal(resultado.configurada, true);
  assert.deepEqual(resultado.faltantes, []);
  assert.equal(resultado.idEmpresa, 2);
  assert.equal(resultado.codigoMarca, '10');
});

test('una configuración inactiva queda bloqueada aunque tenga rutas', () => {
  const resultado = evaluarDestinosExportacionPedido(2, '41', {
    ACTIVA: false,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\MIDING\\KEVINGSTON',
    RUTA_MASTER_DATA_APP: 'PEDIDOS\\MIDING\\KEVINGSTON',
    RUTA_PREC_FOB: 'PEDIDOS\\MIDING\\KEVINGSTON',
  });

  assert.equal(resultado.configurada, false);
  assert.equal(resultado.activa, false);
});

test('una configuración activa con una ruta faltante queda bloqueada', () => {
  const resultado = evaluarDestinosExportacionPedido(2, '47', {
    ACTIVA: true,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\MIDING\\47_STREET',
    RUTA_MASTER_DATA_APP: '',
    RUTA_PREC_FOB: 'PEDIDOS\\MIDING\\47_STREET',
  });

  assert.equal(resultado.configurada, false);
  assert.deepEqual(resultado.faltantes, ['MASTER_DATA_APP']);
});

test('una marca sin configuración no recibe destinos por defecto', () => {
  const resultado = evaluarDestinosExportacionPedido(99, 'SIN_CONFIG', null);

  assert.equal(resultado.configurada, false);
  assert.deepEqual(resultado.rutas, {
    PEDIDO_EXCEL: '',
    MASTER_DATA_APP: '',
    PREC_FOB: '',
  });
  assert.deepEqual(resultado.faltantes, [
    'PEDIDO_EXCEL',
    'MASTER_DATA_APP',
    'PREC_FOB',
  ]);
});

test('cada marca conserva únicamente sus propias rutas', () => {
  const atomik = evaluarDestinosExportacionPedido(1, '1', {
    ACTIVA: true,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\VICBOR',
    RUTA_MASTER_DATA_APP: 'PEDIDOS\\VICBOR',
    RUTA_PREC_FOB: 'PEDIDOS\\VICBOR',
  });
  const montagne = evaluarDestinosExportacionPedido(2, '10', {
    ACTIVA: true,
    RUTA_PEDIDO_EXCEL: 'PEDIDOS\\MIDING\\MONTAGNE',
    RUTA_MASTER_DATA_APP: 'PEDIDOS\\MIDING\\MONTAGNE',
    RUTA_PREC_FOB: 'PEDIDOS\\MIDING\\MONTAGNE',
  });

  assert.notEqual(atomik.rutas.PEDIDO_EXCEL, montagne.rutas.PEDIDO_EXCEL);
  assert.equal(atomik.rutas.PEDIDO_EXCEL, 'PEDIDOS\\VICBOR');
  assert.equal(montagne.rutas.PEDIDO_EXCEL, 'PEDIDOS\\MIDING\\MONTAGNE');
});

test('solo los estados ERP cerrados habilitan un Alta para Pedidos', () => {
  assert.deepEqual(ESTADOS_ALTAS_HABILITADOS_PEDIDOS, [
    'GENERADO_OK_EN_ERP',
    'SIN_NOVEDADES_ERP',
  ]);
  assert.equal(estadoAltaHabilitadoParaPedido('GENERADO_OK_EN_ERP'), true);
  assert.equal(estadoAltaHabilitadoParaPedido('SIN_NOVEDADES_ERP'), true);
  assert.equal(estadoAltaHabilitadoParaPedido('EXPORTADO'), false);
  assert.equal(estadoAltaHabilitadoParaPedido('PARCIAL_ERP'), false);
  assert.equal(estadoAltaHabilitadoParaPedido('BORRADOR'), false);
  assert.equal(estadoAltaHabilitadoParaPedido('ANULADO'), false);
});

test('la regla de estado normaliza espacios y mayúsculas', () => {
  assert.equal(estadoAltaHabilitadoParaPedido(' generado_ok_en_erp '), true);
  assert.equal(estadoAltaHabilitadoParaPedido(' sin_novedades_erp '), true);
});

test('el maestro de módulos se une por empresa y código', () => {
  assert.equal(
    JOIN_MAESTRO_MODULO_POR_EMPRESA,
    'M.ID_EMPRESA = P.ID_EMPRESA AND M.CODIGO_MODULO = P.CODIGO_MODULO'
  );
});
