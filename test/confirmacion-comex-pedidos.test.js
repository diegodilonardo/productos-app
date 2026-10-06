const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const leer = ruta => fs.readFileSync(path.resolve(__dirname, '..', ruta), 'utf8');

test('la migracion crea una confirmacion COMEX unica, auditable y preparada para API', () => {
  const sql = leer('sql/29_confirmacion_comex_pedidos.sql');
  assert.match(sql, /CREATE TABLE dbo\.PEDIDOS_CONFIRMACIONES_COMEX/);
  assert.match(sql, /UNIQUE \(ID_EMPRESA, ID_PEDIDO\)/);
  assert.match(sql, /ORIGEN IN \('MANUAL', 'API'\)/);
  assert.match(sql, /USUARIO_CONFIRMACION VARCHAR\(100\)/);
});

test('el circuito COMEX exige escritura y se ofrece en tarjetas y detalle', () => {
  const routes = leer('src/routes/pedidos.routes.js');
  const cards = leer('public/js/pedidos-index.js');
  const detail = leer('public/js/pedido-detalle.js');
  assert.match(routes, /\/:id\/confirmar-comex', requerirAccesoPedido, requerirEscrituraEmpresa/);
  assert.match(cards, /data-confirmar-impacto/);
  assert.match(detail, /confirmarImpactoPedido/);
  assert.match(cards, /destino=nacional\?'PRESEA':'COMEX'/);
});

test('la confirmacion manual solo admite pedidos validados y es idempotente', () => {
  const repo = leer('src/repositories/pedidos.repository.js');
  assert.match(repo, /Solo se puede confirmar en COMEX un pedido VALIDADO/);
  assert.match(repo, /IF NOT EXISTS \(/);
  assert.match(repo, /'CONFIRMADO', @ORIGEN, @USUARIO_CONFIRMACION/);
});
