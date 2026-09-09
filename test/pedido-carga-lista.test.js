const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('la vista lista permite preparar varios productos sin quitar la carga por modal', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/pedidos/detalle.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/pedido-detalle.js'), 'utf8');

  assert.match(vista, /id="btnCargarModoLista"/);
  assert.match(vista, /Cantidad pares/);
  assert.match(vista, /FOB\/par/);
  assert.match(js, /const cargaListaPedido=new Map\(\)/);
  assert.match(js, /data-lista-campo="cantidadPares"/);
  assert.match(js, /data-lista-campo="precioFobPar"/);
  assert.match(js, /data-lista-campo="adicional"/);
  assert.match(js, /data-lista-campo="observaciones"/);
  assert.match(js, /cantidad%paresModulo!==0/);
  assert.match(js, /async function cargarProductosModoLista/);
  assert.match(js, /data-cargar=/, 'se conserva el acceso a la carga individual por modal');
});
