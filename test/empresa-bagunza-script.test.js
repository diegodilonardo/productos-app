const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const altasService = require('../src/services/altas.service');

const script = fs.readFileSync(
  path.resolve(__dirname, '../sql/12_incorporar_bagunza.sql'),
  'utf8'
);

test('el alta de BAGUNZA conserva empresa, marca y rutas confirmadas', () => {
  assert.match(script, /@CODIGO_EMPRESA VARCHAR\(20\) = '15000'/);
  assert.match(script, /@RAZON_SOCIAL VARCHAR\(150\) = 'BAGUNZA'/);
  assert.match(script, /'160',\s*'BAGUNZA'/);
  assert.match(script, /'\/PRODUCTOS\/MAESTRO_BAGUNZA'/);
  assert.match(script, /'ALTAS_PRODUCTOS\\BAGUNZA'/);
  assert.match(script, /'PEDIDOS\\BAGUNZA'/);
});

test('el alta de BAGUNZA habilita todos los rubros conocidos', () => {
  for (const codigo of ['0', '1', '2', '3', '4', '5', '8', '9']) {
    assert.match(script, new RegExp(`\\('${codigo}',`));
  }
});

test('el script es transaccional e idempotente', () => {
  assert.match(script, /SET XACT_ABORT ON/);
  assert.match(script, /BEGIN TRANSACTION/);
  assert.match(script, /COMMIT TRANSACTION/);
  assert.match(script, /ROLLBACK TRANSACTION/);
  assert.match(script, /WHERE NOT EXISTS/g);
});

test('el navbar utiliza el logo JPG confirmado de BAGUNZA', () => {
  const navbar = fs.readFileSync(
    path.resolve(__dirname, '../public/js/navbar-session.js'),
    'utf8'
  );

  const logo = path.resolve(
    __dirname,
    '../public/img/marcas/160.jpg'
  );

  assert.equal(fs.existsSync(logo), true);
  assert.match(navbar, /return '\/img\/marcas\/160\.jpg'/);
});

test('BAGUNZA utiliza únicamente las reglas presentes en su maestro RUBRO_FACT', () => {
  const determinar = altasService._internals.determinarRubroFact;

  assert.equal(
    determinar('BAGUNZA', 'CALZADO', null, 'MODULO'),
    'MOD_CALZ_BGZ'
  );
  assert.equal(
    determinar('BAGUNZA', 'CALZADO', null, 'PAR_SUELTO'),
    'CALZ_BGZ'
  );
  assert.equal(
    determinar('BAGUNZA', 'ACCESORIOS', null, 'PAR_SUELTO'),
    'ACC_BGZ'
  );
  assert.equal(
    determinar('BAGUNZA', 'POP', null, 'PAR_SUELTO'),
    'POP_BGZ'
  );

  assert.throws(
    () => determinar('BAGUNZA', 'ACCESORIOS', null, 'MODULO'),
    /No existe regla/
  );
  assert.throws(
    () => determinar('BAGUNZA', 'POP', null, 'MODULO'),
    /No existe regla/
  );
  assert.throws(
    () => determinar('BAGUNZA', 'INDUMENTARIA', null, 'PAR_SUELTO'),
    /No existe regla/
  );
});
