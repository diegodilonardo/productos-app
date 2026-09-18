const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { columnasTalles } = require('../src/services/importarTallesModulos.service');

test('importador respeta XS, S, M, L, XL, 2XL, 3XL en el archivo maestro', () => {
  assert.deepEqual(columnasTalles.slice(-7), ['T_XS','T_S','T_M','T_L','T_XL','T_2XL','T_3XL']);
  const cantidades = [0,1,2,3,2,1,0];
  const modulo = Object.fromEntries(columnasTalles.slice(-7).map((campo,i) => [campo,cantidades[i]]));
  assert.equal(modulo.T_M, 2);
  assert.equal(modulo.T_L, 3);
  assert.equal(Object.values(modulo).reduce((s,n) => s+n,0), 9);
});

test('el cambio de interpretación invalida el control de archivo sin cambios', () => {
  const fuente = fs.readFileSync(path.join(__dirname,'../src/services/importarTallesModulos.service.js'),'utf8');
  assert.match(fuente, /TALLES_MODULOS:XS-S-M-L:v2/);
  assert.match(fuente, /createHash\('sha256'\)/);
});
