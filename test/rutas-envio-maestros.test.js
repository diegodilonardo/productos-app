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

test('la matriz configurada bloquea combinaciones sin ruta activa', () => {
  const destinos = [
    { MARCA:'ATOMIK', LICENCIA:'SIN_LICENCIA', RUBRO:'CALZADO', RUTA_DESTINO:'/ALTAS_MAESTROS/VICBOR/ATOMIK/CALZADO' },
    { MARCA:'ATOMIK', LICENCIA:'SAN_LORENZO', RUBRO:'CALZADO', RUTA_DESTINO:'/ALTAS_MAESTROS/VICBOR/ATOMIK/LICENCIAS/SAN_LORENZO/CALZADO' },
  ];
  const grupos = agruparArchivosMaestros([
    { TIPO:'MODELO', MARCA:'ATOMIK', RUBRO:'CALZADO', LICENCIA:'SL' },
    { TIPO:'MODULO', MARCA:'ATOMIK', RUBRO:'CALZADO' },
  ], '/ALTAS_MAESTROS/VICBOR', destinos);
  assert.deepEqual(grupos.map(g => g.ruta), [
    '/ALTAS_MAESTROS/VICBOR/ATOMIK/CALZADO',
    '/ALTAS_MAESTROS/VICBOR/ATOMIK/LICENCIAS/SAN_LORENZO/CALZADO',
  ]);
  assert.throws(() => agruparArchivosMaestros([
    { TIPO:'MODELO', MARCA:'ATOMIK', RUBRO:'POP', LICENCIA:'SIN LICENCIA' }
  ], '/ALTAS_MAESTROS/VICBOR', destinos), /Exportación bloqueada/);
});

test('una marca con espacios coincide con su segmento configurado para FTP', () => {
  const destinos = [
    { MARCA:'47 STREET', LICENCIA:'SIN_LICENCIA', RUBRO:'CALZADO', RUTA_DESTINO:'/ALTAS_MAESTROS/MIDING/47_STREET/CALZADO' },
  ];
  const grupos = agruparArchivosMaestros([
    { TIPO:'MODELO', MARCA:'47 STREET', RUBRO:'CALZADO', LICENCIA:'SIN LICENCIA' },
    { TIPO:'MODULO', MARCA:'47 STREET', RUBRO:'CALZADO' },
  ], '/ALTAS_MAESTROS/MIDING', destinos);

  assert.equal(grupos.length, 2);
  assert.ok(grupos.every(grupo => grupo.ruta === '/ALTAS_MAESTROS/MIDING/47_STREET/CALZADO'));
});
