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

test('el maestro ampliado importa grupo, subgrupo y línea sin romper el formato anterior', () => {
  const ampliado = parsearArchivoProductos(
    Buffer.from('ALFA01|100|7791234567890|CALZADO|9|3000|Z1|ZZ|O1\r\n'),
    '3000'
  ).registros[0];
  assert.equal(ampliado.CODIGO_GRUPO, 'Z1');
  assert.equal(ampliado.CODIGO_SUBGRUPO, 'ZZ');
  assert.equal(ampliado.CODIGO_LINEA, 'O1');

  const historico = parsearArchivoProductos(
    Buffer.from('ALFA02|101||CALZADO||3000\r\n'),
    '3000'
  ).registros[0];
  assert.equal(historico.CODIGO_GRUPO, null);
  assert.equal(historico.CODIGO_SUBGRUPO, null);
  assert.equal(historico.CODIGO_LINEA, null);
});

test('el maestro de productos rechaza cantidades intermedias de columnas', () => {
  assert.throws(
    () => parsearArchivoProductos(Buffer.from('ALFA01|100||CALZADO||3000|Z1\r\n'), '3000'),
    /6 o 9 columnas/
  );
});

test('C_ESTADIO 9 se excluye de Pedidos y permanece visible como histórico en EAN', () => {
  const maestros = fs.readFileSync(path.join(__dirname, '../src/repositories/maestros.repository.js'), 'utf8');
  const pedidos = fs.readFileSync(path.join(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  const seguimiento = fs.readFileSync(path.join(__dirname, '../src/repositories/seguimiento.repository.js'), 'utf8');
  assert.match(maestros, /AS ESTADO_PRODUCTO/);
  assert.match(pedidos, /P\.C_ESTADIO[\s\S]*<> '9'/);
  assert.match(seguimiento, /PE\.C_ESTADIO/);
  assert.match(seguimiento, /INHABILITADO_PRESEA/);
  assert.doesNotMatch(seguimiento, /PE\.C_ESTADIO[\s\S]{0,120}<> '9'/);
});

test('la consulta permite filtrar productos inhabilitados en Presea', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/altas-maestros/index.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="filtroEstadoProductos"/);
  assert.match(cliente, /INHABILITADO/);
  assert.match(cliente, /C_ESTADIO/);
});
