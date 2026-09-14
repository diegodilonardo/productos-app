const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsearArchivoProductos } = require('../src/services/productosErpSync.service');

test('el maestro de productos importa C_ESTADIO antes del código de empresa', () => {
  const resultado = parsearArchivoProductos(
    Buffer.from('ALFA01|100|7791234567890|CALZADO|9|1\r\n'),
    '1'
  );
  assert.equal(resultado.registros.length, 1);
  assert.equal(resultado.registros[0].C_ESTADIO, '9');
});

test('C_ESTADIO 9 se conserva para consulta y se excluye de Pedidos y EAN', () => {
  const maestros = fs.readFileSync(path.join(__dirname, '../src/repositories/maestros.repository.js'), 'utf8');
  const pedidos = fs.readFileSync(path.join(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  const seguimiento = fs.readFileSync(path.join(__dirname, '../src/repositories/seguimiento.repository.js'), 'utf8');
  assert.match(maestros, /AS ESTADO_PRODUCTO/);
  assert.match(pedidos, /P\.C_ESTADIO[\s\S]*<> '9'/);
  assert.match(seguimiento, /PE\.C_ESTADIO[\s\S]*<> '9'/);
});

test('la consulta permite filtrar productos inhabilitados en Presea', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/altas-maestros/index.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="filtroEstadoProductos"/);
  assert.match(cliente, /INHABILITADO/);
  assert.match(cliente, /C_ESTADIO/);
});
