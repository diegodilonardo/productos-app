const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('la documentación cubre los scripts operativos del proyecto', () => {
  const documento = fs.readFileSync('docs/SCRIPTS_OPERATIVOS.md', 'utf8');
  const scripts = fs.readdirSync('scripts').filter(nombre => /\.(js|ps1)$/i.test(nombre));

  for (const nombre of scripts) {
    assert.match(documento, new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const comando of [
    'npm test',
    'npm start',
    'npm run dev',
    'npm run importar-maestros-multiempresa',
    'npm run sincronizar-productos-erp'
  ]) {
    assert.match(documento, new RegExp(comando.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(documento, /No utilizar actualmente/);
  assert.match(documento, /Modifica SQL/);
});
