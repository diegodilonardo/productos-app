const test = require('node:test');
const assert = require('node:assert/strict');

const {
  firmaArchivoRemoto,
  mismaFirmaRemota
} = require('../src/services/ftp.service');

test('la firma remota combina tamaño y fecha de modificación', () => {
  const firma = firmaArchivoRemoto({
    size: 1234,
    modifiedAt: new Date('2026-09-02T12:10:00.000Z')
  });

  assert.deepEqual(firma, {
    tamano: 1234,
    fecha: '2026-09-02T12:10:00.000Z'
  });
});

test('un maestro sólo se considera igual con tamaño y fecha coincidentes', () => {
  const anterior = {
    tamano: 1234,
    fecha: '2026-09-02T12:10:00.000Z'
  };

  assert.equal(mismaFirmaRemota(anterior, { ...anterior }), true);
  assert.equal(mismaFirmaRemota(anterior, { ...anterior, tamano: 1235 }), false);
  assert.equal(
    mismaFirmaRemota(anterior, { ...anterior, fecha: '2026-09-02T12:20:00.000Z' }),
    false
  );
});

test('sin fecha remota se fuerza la descarga para no omitir cambios', () => {
  assert.equal(
    mismaFirmaRemota(
      { tamano: 1234, fecha: '' },
      { tamano: 1234, fecha: '' }
    ),
    false
  );
});
