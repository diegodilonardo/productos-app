const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8');
}

test('cada principal permite editar la información y la propaga a su familia', () => {
  const vista = leer('views/altas/productos.hbs');
  const cliente = leer('public/js/alta-productos.js');
  const rutas = leer('src/routes/altas.routes.js');
  const servicio = leer('src/services/altas.service.js');
  const repositorio = leer('src/repositories/altas.repository.js');

  assert.match(vista, /id="modalInformacionProducto"/);
  assert.match(cliente, /data-accion="editar-informacion"/);
  assert.match(cliente, /puedeEditar && esPrincipal && idDetalle/);
  assert.match(cliente, /method:\s*'PUT'/);
  assert.match(rutas, /detalle\/:idDetalle\/informacion/);
  assert.match(servicio, /alta\.ESTADO[\s\S]*BORRADOR/);
  assert.match(servicio, /GENERADO_AUTOMATICO/);
  assert.match(repositorio, /ALTAS_PRODUCTOS_FAMILIAS_DETALLE/);
  assert.match(repositorio, /R\.ID_DETALLE_PADRE = @ID_DETALLE_PADRE/);
});
