const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const leer = ruta => fs.readFileSync(ruta, 'utf8');

test('la reapertura exige SUPER_ADMIN, contraseña personal y motivo', () => {
  const rutas = leer('src/routes/pedidos.routes.js');
  const servicio = leer('src/services/pedidos.service.js');
  const auth = leer('src/services/auth.service.js');

  assert.match(rutas, /router\.post\('\/:id\/reabrir', requerirAccesoPedido, requerirSuperAdmin/);
  assert.match(servicio, /authService\.validarPasswordActual\(usuario, password\)/);
  assert.match(servicio, /motivo\.length < 10/);
  assert.match(auth, /bcrypt\.compare\(clave, usuarioDb\.PASSWORD_HASH\)/);
});

test('la reapertura es transaccional, bloquea confirmados y vuelve a BORRADOR', () => {
  const repositorio = leer('src/repositories/pedidos.repository.js');

  assert.match(repositorio, /new sql\.Transaction\(pool\)/);
  assert.match(repositorio, /PEDIDOS_CONFIRMACIONES_COMEX/);
  assert.match(repositorio, /PEDIDOS_CONFIRMACIONES_PRESEA/);
  assert.match(repositorio, /SET ESTADO = 'ERROR'/);
  assert.match(repositorio, /OBSOLETO POR REAPERTURA/);
  assert.match(repositorio, /SET ESTADO = 'BORRADOR'/);
  assert.match(repositorio, /INSERT dbo\.PEDIDOS_REAPERTURAS/);
});

test('la migración crea la auditoría y la UI solicita credenciales', () => {
  const migracion = leer('sql/41_reapertura_controlada_pedidos.sql');
  const vista = leer('views/pedidos/detalle.hbs');
  const cliente = leer('public/js/pedido-detalle.js');

  assert.match(migracion, /CREATE TABLE dbo\.PEDIDOS_REAPERTURAS/);
  assert.match(migracion, /EXPORTACIONES_OBSOLETAS/);
  assert.match(vista, /id="passwordReapertura"[^>]*type="password"/);
  assert.match(vista, /id="motivoReapertura"/);
  assert.match(cliente, /contextoUsuario\?\.superAdmin/);
  assert.match(cliente, /\/reabrir/);
});
