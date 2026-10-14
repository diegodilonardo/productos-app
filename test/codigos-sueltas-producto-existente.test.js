const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');

const resolver =
    altasService._internals.obtenerRubroCodigoAlfaHijoSegunPrincipal;

test('un módulo nuevo mantiene la regla F o M para sus sueltos', () => {
    assert.equal(
        resolver({ DETALLE_CLASIFICACION: 'MOD.MUJ' }, null),
        'F'
    );
    assert.equal(
        resolver({ DETALLE_CLASIFICACION: 'MOD.HOM' }, null),
        'M'
    );
});

test('un módulo existente en Presea conserva el rubro normal de sus sueltos', () => {
    const existente = {
        ID_PRODUCTO: 123,
        CODIGO_ALFA: 'EXISTENTE'
    };

    assert.equal(
        resolver({ DETALLE_CLASIFICACION: 'MOD.MUJ' }, existente),
        null
    );
    assert.equal(
        resolver({ DETALLE_CLASIFICACION: 'MOD.HOM' }, existente),
        null
    );
});
