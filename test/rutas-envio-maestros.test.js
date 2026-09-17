const test = require('node:test');
const assert = require('node:assert/strict');
const { agruparArchivosMaestros } = require('../src/services/altasMaestros.service');

test('modelos se separan por marca, licencia y rubro en todas las empresas', () => {
  for (const [empresa, marca] of [['BAGUNZA','BAGUNZA'],['VICBOR','ATOMIK'],['GYD','WAKE'],['GYD','MARCEL'],['GYD','MASSIMO'],['MIDING','47 STREET'],['MIDING','MONTAGNE']]) {
    const ruta = `/ALTAS_MAESTROS/${empresa}`;
    const grupos = agruparArchivosMaestros([
      { TIPO:'MODELO', MARCA:marca, RUBRO:'CALZADO', LICENCIA:'SIN LICENCIA' },
      { TIPO:'MODELO', MARCA:marca, RUBRO:'INDUMENTARIA', LICENCIA:'' },
      { TIPO:'COLOR' }, { TIPO:'MODULO', MARCA:marca, RUBRO:'CALZADO' }
    ], ruta);
    assert.deepEqual(grupos.map(g => g.ruta), [ruta, `${ruta}/${marca.replaceAll(' ','_')}/CALZADO`, `${ruta}/${marca.replaceAll(' ','_')}/CALZADO`, `${ruta}/${marca.replaceAll(' ','_')}/INDUMENTARIA`]);
  }
});

test('módulos se separan por marca y rubro sin heredar licencias de modelos', () => {
  const grupos = agruparArchivosMaestros([
    { TIPO:'MODULO', MARCA:'ATOMIK', RUBRO:'CALZADO', LICENCIA:'SL' },
    { TIPO:'MODULO', MARCA:'ATOMIK', RUBRO:'INDUMENTARIA' }
  ], '/ALTAS_MAESTROS/VICBOR');
  assert.deepEqual(grupos.map(g => g.ruta), ['/ALTAS_MAESTROS/VICBOR/ATOMIK/CALZADO', '/ALTAS_MAESTROS/VICBOR/ATOMIK/INDUMENTARIA']);
  assert.throws(() => agruparArchivosMaestros([{ TIPO:'MODULO', RUBRO:'CALZADO' }], '/ALTAS_MAESTROS/VICBOR'), /marca/);
});

test('licencias se normalizan y los modelos del mismo destino comparten archivo', () => {
  const grupos = agruparArchivosMaestros(['SL','SAN LORENZO','VS','TA'].map(LICENCIA => ({ TIPO:'MODELO', MARCA:'ATOMIK', RUBRO:'CALZADO', LICENCIA })), '/ALTAS_MAESTROS/VICBOR');
  assert.equal(grupos.length, 3);
  assert.equal(grupos.find(g => g.ruta.includes('SAN_LORENZO')).filas.length, 2);
  assert.ok(grupos.some(g => g.ruta.includes('/LICENCIAS/VELEZ_SARSFIELD/')));
  assert.ok(grupos.some(g => g.ruta.includes('/LICENCIAS/TALLERES/')));
  assert.throws(() => agruparArchivosMaestros([{TIPO:'MODELO',MARCA:'../WAKE',RUBRO:'CALZADO'}], '/ALTAS_MAESTROS/GYD'), /segura/);
});
