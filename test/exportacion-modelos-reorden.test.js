const test = require('node:test');
const assert = require('node:assert/strict');
const { armarRegistrosMODELOS } = require('../src/services/exportacion.service');

test('MODELOS incluye el módulo existente cuando un reorden sólo reemite sus relacionados', () => {
  const alta = {
    TIPO_PRODUCTO: 'MODULO',
    DETALLE_MARCA: 'MONTAGNE',
    DETALLE_RUBRO: 'CALZADO',
    DETALLE_TEMPORADA: 'VE',
    CODIGO_ANO: '23'
  };
  const moduloExistente = {
    ESTADO_VALIDACION: 'EXISTE_ERP',
    TIPO_PRODUCTO_DETALLE: 'MODULO',
    CODIGO_MODELO: 'MT3187',
    DETALLE_MODELO: 'MODELO HISTORICO',
    CODIGO_COLOR: '24',
    DETALLE_COLOR: 'NEGRO',
    CODIGO_MODULO: 'R1',
    DETALLE_MODULO: '36 AL 41 X 12',
    DETALLE_SUBGRUPO: 'ZAPATILLAS',
    DETALLE_GRUPO: 'CALZADO',
    LICENCIA: 'SIN LICENCIA',
    CODIGO_PROVEEDOR: 'PB0001'
  };
  const primeraNueva = {
    ...moduloExistente,
    ESTADO_VALIDACION: 'VALIDO',
    TIPO_PRODUCTO_DETALLE: 'PRIMERA',
    CODIGO_MODULO: '',
    DETALLE_MODULO: ''
  };

  const registros = armarRegistrosMODELOS(alta, [moduloExistente, primeraNueva]);

  assert.equal(registros.length, 1);
  assert.equal(registros[0].COD_MODELO, 'MT3187');
  assert.equal(registros[0].COD_CURVA, 'R1');
  assert.equal(registros[0].CO_PROV, 'PB0001');
});
