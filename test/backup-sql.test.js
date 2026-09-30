const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(
  path.join(__dirname, '../scripts/backup-productos-app.ps1'),
  'utf8'
);

test('el backup SQL admite completos y diferenciales sin compresión de Express', () => {
  assert.match(script, /ValidateSet\('FULL', 'DIFF'\)/);
  assert.match(script, /BACKUP DATABASE/);
  assert.match(script, /DIFFERENTIAL/);
  assert.doesNotMatch(script, /\bCOMPRESSION\b/);
});

test('el backup SQL verifica el archivo, registra errores y usa la conexión local confiable', () => {
  assert.match(script, /RESTORE VERIFYONLY/);
  assert.match(script, /WITH CHECKSUM/);
  assert.match(script, /-C/);
  assert.doesNotMatch(script, /-r\s+1/);
  assert.match(script, /\$LASTEXITCODE/);
  assert.match(script, /DiasRetencion/);
});
