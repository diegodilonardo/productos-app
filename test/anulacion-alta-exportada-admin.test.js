const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rutaScript = path.join(__dirname, '../sql/14_anular_alta_exportada_admin.sql');

test('la anulación administrativa inicia en simulación y conserva el histórico', () => {
  const sql = fs.readFileSync(rutaScript, 'utf8');

  assert.match(sql, /DECLARE @CONFIRMAR BIT = 0/);
  assert.match(sql, /IF @CONFIRMAR = 0/);
  assert.match(sql, /ROLLBACK TRANSACTION/);
  assert.match(sql, /ESTADO = 'ANULADO'/);
  assert.match(sql, /FECHA_ANULACION = SYSDATETIME\(\)/);
  assert.match(sql, /IMPACTA_INDICADORES_ERP/);
  assert.match(sql, /VERIFICACION_POSTERIOR/);
  assert.match(sql, /ID_EMPRESA \+ ID_ALTA/);
  assert.match(sql, /no debe sumar en Productos exportados/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+dbo\./i);
});

test('la anulación se bloquea si existen Pedidos activos asociados', () => {
  const sql = fs.readFileSync(rutaScript, 'utf8');

  assert.match(sql, /FROM dbo\.PEDIDOS P/);
  assert.match(sql, /FROM dbo\.PEDIDOS_ALTAS PA/);
  assert.match(sql, /P\.ESTADO[\s\S]*<> 'ANULADO'/);
  assert.match(sql, /Anule esos Pedidos antes de continuar/);
});
