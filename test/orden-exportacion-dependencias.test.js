const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const servicio = require('../src/services/exportacion.service');

test('los DBI se envían por fases respetando las dependencias de Presea', () => {
  const definiciones = [
    { clave: 'PRODUCTOS' },
    { clave: 'RELACION' },
    { clave: 'MODELOS' },
    { clave: 'PRIMERAS_SEGUNDAS' },
    { clave: 'RELFORMU' },
  ];

  assert.deepEqual(
    servicio.agruparDefinicionesPorDependencia(definiciones).map((fase) => fase.map((item) => item.clave)),
    [['MODELOS'], ['PRODUCTOS'], ['PRIMERAS_SEGUNDAS', 'RELFORMU', 'RELACION']],
  );
});

test('la exportación espera el consumo de cada fase antes de enviar la siguiente', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/services/exportacion.service.js'),
    'utf8',
  );

  assert.match(fuente, /const fasesEnvio = agruparDefinicionesPorDependencia\(definiciones\)/);
  assert.match(fuente, /await esperarArchivosConsumidosFTP\(rutaFTP, fase\)/);
  assert.match(fuente, /No se enviaron los archivos dependientes para evitar productos incompletos/);
});
