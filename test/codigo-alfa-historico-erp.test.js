const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { codigoAlfaERPComparable } = require('../src/repositories/altas.repository');

test('la conciliación ERP compara como equivalentes el cero de relleno y el espacio histórico', () => {
  const expresion = codigoAlfaERPComparable('P.CODIGO_ALFA');
  assert.match(expresion, /SUBSTRING\(.+, 10, 1\) = ' '/s);
  assert.match(expresion, /LEFT\(.+, 4\) \+ '0'/s);
  assert.match(expresion, /SUBSTRING\(.+, 5, 5\)/s);
  assert.match(expresion, /SUBSTRING\(.+, 11, 5\)/s);

  const fuente = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'altas.repository.js'),
    'utf8'
  );
  assert.match(fuente, /codigoAlfaERPComparable\('CODIGO_ALFA'\)/);
  assert.match(fuente, /codigoAlfaERPComparable\('P0\.CODIGO_ALFA'\)/);
  assert.match(fuente, /codigoAlfaERPComparable\('P\.CODIGO_ALFA'\)/);
});

test('al reintentar una exportación se reconcilia y se cierra un Alta sin novedades', () => {
  const exportacion = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'exportacion.service.js'),
    'utf8'
  );
  const repository = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'repositories', 'altas.repository.js'),
    'utf8'
  );
  assert.match(exportacion, /prepararExportacion\(idAlta, \{[\s\S]*reconciliarERP: true/);
  assert.match(exportacion, /marcarAltaValidadaSinNovedadesERP/);
  assert.match(exportacion, /cerrada como SIN_NOVEDADES_ERP/);
  assert.match(repository, /AND ESTADO = 'VALIDADO'/);
});
