const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validarPendientes } = require('../src/services/controlExportacionAlta.service');

test('exportación bloqueada identifica altas enviadas pendientes de Presea', () => {
  assert.throws(() => validarPendientes([{ ID_ALTA:38, CODIGO_ALTA:'ALT-38' }]), e => e.status === 409 && /ALT-38 \(ID 38\)/.test(e.message));
  assert.doesNotThrow(() => validarPendientes([]));
});

test('el control se limita a la empresa y protege envíos simultáneos antes del FTP', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../src/services/controlExportacionAlta.service.js'), 'utf8');
  assert.match(fuente, /WHERE ID_EMPRESA=@ID_EMPRESA AND ID_ALTA<>@ID_ALTA AND ESTADO='EXPORTADO'/);
  assert.match(fuente, /sp_getapplock/);
  assert.match(fuente, /LockTimeout=0/);
  assert.ok(fuente.indexOf('validarPendientes(pendientes.recordset)') < fuente.indexOf('return await operacion()'));
  assert.match(fuente, /finally[\s\S]*transaction.rollback/);
});
