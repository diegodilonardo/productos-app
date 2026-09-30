const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(
  path.join(__dirname, '../scripts/backup-productos-app.ps1'),
  'utf8'
);
const instalador = fs.readFileSync(
  path.join(__dirname, '../scripts/instalar-tareas-backup-sql.ps1'),
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
  assert.match(script, /192\.168\.106\.79\\sistemas_otros\\Bckp_APP_PRODUCTOS/);
  assert.match(script, /Copy-Item -LiteralPath \$rutaBackup/);
  assert.match(script, /\$archivoExterno\.Length -ne \$archivo\.Length/);
  assert.match(script, /DiasRetencionExterna = 30/);
});

test('el instalador programa un backup completo y tres diferenciales sin guardar contraseñas', () => {
  assert.match(instalador, /Backup SQL FULL/);
  assert.match(instalador, /Backup SQL DIFF 08/);
  assert.match(instalador, /Backup SQL DIFF 14/);
  assert.match(instalador, /Backup SQL DIFF 20/);
  assert.match(instalador, /Get-Credential/);
  assert.doesNotMatch(instalador, /ConvertTo-SecureString[^\r\n]*-AsPlainText/);
  assert.match(instalador, /Register-ScheduledTask/);
});
