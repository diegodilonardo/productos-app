const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('la confirmacion en Presea posee trazabilidad independiente para pedidos nacionales', () => {
  const sql = fs.readFileSync('sql/30_confirmacion_presea_pedidos_nacionales.sql','utf8');
  assert.match(sql, /CREATE TABLE dbo\.PEDIDOS_CONFIRMACIONES_PRESEA/);
  assert.match(sql, /UNIQUE \(ID_EMPRESA, ID_PEDIDO\)/);
  assert.match(sql, /USUARIO_CONFIRMACION VARCHAR\(100\)/);
});

test('PB9999 muestra y utiliza confirmar en Presea en lugar de COMEX', () => {
  const listado = fs.readFileSync('public/js/pedidos-index.js','utf8');
  const detalle = fs.readFileSync('public/js/pedido-detalle.js','utf8');
  const rutas = fs.readFileSync('src/routes/pedidos.routes.js','utf8');
  assert.match(listado, /esPedidoNacional\(p\)\?'Presea':'COMEX'/);
  assert.match(listado, /ESTADO_PRESEA/);
  assert.match(detalle, /confirmar-presea/);
  assert.match(detalle, /PRESEA/);
  assert.match(rutas, /\/:id\/confirmar-presea'/);
});

test('el backend restringe Presea a nacionales y COMEX a importados', () => {
  const servicio = fs.readFileSync('src/services/pedidos.service.js','utf8');
  const repositorio = fs.readFileSync('src/repositories/pedidos.repository.js','utf8');
  assert.match(servicio, /Los pedidos nacionales deben confirmarse en Presea/);
  assert.match(repositorio, /confirmación en Presea corresponde únicamente a proveedores nacionales/);
  assert.match(repositorio, /Solo se puede confirmar en Presea un pedido VALIDADO/);
});
