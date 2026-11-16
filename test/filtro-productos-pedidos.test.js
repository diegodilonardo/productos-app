const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

test('el listado de Pedidos incorpora sus productos al texto de búsqueda', () => {
  const repositorio = fs.readFileSync(
    path.join(raiz, 'src', 'repositories', 'pedidos.repository.js'),
    'utf8'
  );
  const frontend = fs.readFileSync(
    path.join(raiz, 'public', 'js', 'pedidos-index.js'),
    'utf8'
  );

  assert.match(repositorio, /AS PRODUCTOS_BUSQUEDA/);
  for (const campo of [
    'CODIGO_ALFA', 'CODIGO_ERP', 'CODIGO_EAN',
    'CODIGO_MODELO', 'DETALLE_MODELO',
    'CODIGO_COLOR', 'DETALLE_COLOR',
    'CODIGO_TALLE', 'DETALLE_TALLE'
  ]) {
    assert.match(repositorio, new RegExp(`DB\\.${campo}`));
  }
  assert.match(frontend, /p\.PRODUCTOS_BUSQUEDA/);
});

test('el buscador comunica que permite localizar productos', () => {
  const vista = fs.readFileSync(
    path.join(raiz, 'views', 'pedidos', 'index.hbs'),
    'utf8'
  );

  assert.match(vista, /Buscar pedido, producto, modelo, color, proveedor u orden/);
});
