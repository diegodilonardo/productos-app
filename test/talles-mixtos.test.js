const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { armarRegistrosRELACION } = require('../src/services/exportacion.service');

test('la interfaz de Altas ofrece talles mixtos únicamente bajo permiso', () => {
  const vista = fs.readFileSync('views/altas/productos.hbs', 'utf8');
  const js = fs.readFileSync('public/js/alta-productos.js', 'utf8');
  assert.match(vista, /id="tallesMixtos"/);
  assert.match(vista, /id="tablaTallesMixtos"/);
  assert.match(js, /puedeUsarTallesMixtos/);
  assert.match(js, /Pares asignados:/);
});

test('el backend exige permiso y utiliza el color MIX para el principal', () => {
  const servicio = fs.readFileSync('src/services/altas.service.js', 'utf8');
  assert.match(servicio, /No tiene permiso para generar módulos con talles mixtos/);
  assert.match(servicio, /buscarColorMix/);
  assert.match(servicio, /_MOD_MIX_/);
  assert.match(servicio, /distribucionTallesMixtos/);
});

test('RELACION utiliza la cantidad personalizada de la distribución mixta', () => {
  const [registro] = armarRegistrosRELACION([{
    CANTIDAD_RELACION: 3,
    COD_ALFA_MODULO: 'MOD-MIX',
    COD_ALFA_INSUMO: 'INSUMO-33-NEGRO',
    DETALLE_PRODUCTO_MODULO: 'MODULO MIX',
    DETALLE_PRODUCTO_INSUMO: 'PRIMERA 33 NEGRO',
  }]);
  assert.equal(registro.CANTIDAD, 3);
  assert.equal(registro.CA_ARTICUL, 'MOD-MIX');
  assert.equal(registro.CA_INSUMO, 'INSUMO-33-NEGRO');
});

test('la migración conserva cantidades positivas por relación familiar', () => {
  const migracion = fs.readFileSync('sql/33_distribucion_talles_mixtos.sql', 'utf8');
  assert.match(migracion, /ADD CANTIDAD INT NULL/);
  assert.match(migracion, /CK_ALTAS_FAMILIAS_CANTIDAD_POSITIVA/);
});
