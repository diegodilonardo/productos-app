const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('las imágenes nuevas se organizan por empresa, marca, rubro y licencia', () => {
  const rutas = fs.readFileSync(path.resolve(__dirname, '../src/routes/imagenes.routes.js'), 'utf8');
  assert.match(rutas, /alta\.RAZON_SOCIAL \|\| alta\.CODIGO_EMPRESA/);
  assert.match(rutas, /alta\.DETALLE_MARCA \|\| alta\.CODIGO_MARCA/);
  assert.match(rutas, /alta\.DETALLE_RUBRO \|\| alta\.CODIGO_RUBRO/);
  assert.match(rutas, /producto\?\.LICENCIA/);
  assert.match(rutas, /buscarImagenContextual/);
});

test('Alta y Pedido envían el Alta de origen al consultar imágenes', () => {
  const alta = fs.readFileSync(path.resolve(__dirname, '../public/js/alta-productos.js'), 'utf8');
  const pedidos = fs.readFileSync(path.resolve(__dirname, '../src/services/pedidos.service.js'), 'utf8');
  assert.match(alta, /idAlta:\s*p\.idAlta/);
  assert.match(pedidos, /idAlta: texto\(producto\.ID_ALTA\)/);
  assert.match(pedidos, /idAlta: texto\(item\.ID_ALTA \|\| pedido\.ID_ALTA\)/);
});

test('la descarga ZIP busca primero en la carpeta organizada y conserva el respaldo plano', () => {
  const servicio = fs.readFileSync(path.resolve(__dirname, '../src/services/imagenesAlta.service.js'), 'utf8');
  assert.match(servicio, /buscarImagen\(clave, carpetaOrganizada\(alta, producto\)\) \|\|/);
  assert.match(servicio, /buscarImagen\(clave\)/);
});
