const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('el script de recuperación de maestros exige selección explícita y vista previa', () => {
  const script = fs.readFileSync('scripts/reenviar-altas-maestros.js', 'utf8');

  assert.match(script, /Debe indicar --ids o --desde/);
  assert.match(script, /VISTA PREVIA - NO SE ENVIARA NADA/);
  assert.match(script, /opciones\.enviar/);
  assert.match(script, /opciones\.sobrescribir/);
  assert.match(script, /ftpService\.existeArchivo/);
  assert.match(script, /ALTAS_MAESTROS_HISTORIAL/);
  assert.match(script, /ESTADO IN \('ENVIADO_PRESEA','CONFIRMADO_ERP'\)/);
  assert.match(script, /RAZON_SOCIAL/);
  assert.doesNotMatch(script, /NOMBRE_EMPRESA/);
});

test('el script recupera únicamente los DBI de maestros admitidos', () => {
  const script = fs.readFileSync('scripts/reenviar-altas-maestros.js', 'utf8');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.match(script, /'COLOR', 'MODELO', 'MODULO'/);
  assert.equal(packageJson.scripts['reenviar-maestros'], 'node scripts/reenviar-altas-maestros.js');
});

