const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('grupo, subgrupo, linea y deportes comparten el catalogo entre las cuatro empresas', () => {
  const fuente = fs.readFileSync('src/repositories/maestros.repository.js', 'utf8');
  for (const tabla of ['MAESTRO_GRUPOS','MAESTRO_SUBGRUPOS','MAESTRO_LINEA','MAESTRO_DEPORTES']) {
    assert.match(fuente, new RegExp(`'${tabla}'`));
  }
  assert.match(fuente, /CODIGO_EMPRESA\)\) IN \('0','70000','9000','15000'\)/);
  assert.match(fuente, /ROW_NUMBER\(\) OVER/);
  assert.match(fuente, /CASE WHEN E_ALCANCE\.ID_EMPRESA = @ID_EMPRESA THEN 0 ELSE 1 END/);
});

test('el Alta valida codigos comerciales existentes en cualquier empresa compartida', () => {
  const fuente = fs.readFileSync('src/repositories/altas.repository.js', 'utf8');
  assert.match(fuente, /function alcanceMaestroComercialCompartido/);
  assert.match(fuente, /CODIGO_EMPRESA\)\) IN \('0','70000','9000','15000'\)/);
  for (const tabla of ['MAESTRO_GRUPOS M','MAESTRO_SUBGRUPOS M','MAESTRO_LINEA M','MAESTRO_DEPORTES M']) {
    assert.ok(fuente.includes(tabla));
  }
  assert.ok((fuente.match(/alcanceMaestroComercialCompartido\('M'\)/g) || []).length >= 4);
});

test('los demas maestros conservan el filtro por empresa exacta', () => {
  const fuente = fs.readFileSync('src/repositories/maestros.repository.js', 'utf8');
  assert.match(fuente, /compartido \? `[\s\S]*` : `[\s\S]*AND ID_EMPRESA = @ID_EMPRESA/);
});
