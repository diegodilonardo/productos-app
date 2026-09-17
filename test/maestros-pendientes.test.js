const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const repository = require('../src/repositories/altasMaestros.repository');
const originalConexion = db.getConnection;
let faltantes = [];
let consulta;
db.getConnection = async () => ({ request: () => ({ input() { return this; }, async query(sql) { consulta = sql; return { recordset: faltantes }; } }) });
const servicio = require('../src/services/maestrosPendientes.service');
db.getConnection = originalConexion;

test('bloquea DBI de altas hasta que modelos, colores y módulos existan activos por empresa', async () => {
  faltantes = [{ TIPO: 'COLOR', CODIGO: '0A' }, { TIPO: 'MODULO', CODIGO: 'A0' }];
  await assert.rejects(servicio.comprobarAlta(23), error => error.status === 409 && /COLOR 0A, MODULO A0/.test(error.message));
  assert.match(consulta, /dbo\.ALTAS_PRODUCTOS_DETALLE/);
  for (const alias of ['M', 'C', 'T']) {
    assert.ok(consulta.includes(`${alias}.ID_EMPRESA=A.ID_EMPRESA`));
    assert.ok(consulta.includes(`${alias}.ACTIVO=1`));
  }
  faltantes = [];
  await servicio.comprobarAlta(23);
});

test('permite pendientes de la empresa sin duplicar maestros activos y conserva distribución del módulo', async () => {
  const listar = repository.listar;
  repository.listar = async id => {
    assert.equal(id, 1);
    return [
      { TIPO:'COLOR', CODIGO:'0A', NOMBRE:'ORQUIDEA', ESTADO:'ENVIADO_PRESEA' },
      { TIPO:'COLOR', CODIGO:'0B', NOMBRE:'NUEVO', ESTADO:'PENDIENTE_ENVIO' },
      { TIPO:'COLOR', CODIGO:'0C', NOMBRE:'ANULADO', ESTADO:'ANULADO' }
    ];
  };
  try {
    const colores = await servicio.combinar([{ CODIGO_COLOR:'0A', DETALLE_COLOR:'ORQUIDEA' }], 1, 'COLOR');
    assert.equal(colores.length, 2);
    assert.equal(colores[0].PENDIENTE_MAESTRO, undefined);
    assert.equal(colores[1].PENDIENTE_MAESTRO, true);
    assert.equal(await servicio.buscar(1, 'COLOR', '0C'), null);
  } finally { repository.listar = listar; }
  const modulo = servicio.transformar({ TIPO:'MODULO', CODIGO:'A0', NOMBRE:'35 AL 40', DATOS_JSON:JSON.stringify({ pares:12, distribucion:{ T35:2, T36:3 } }) });
  assert.equal(modulo.T35, 2);
  assert.equal(modulo.PARES, 12);
  assert.equal(modulo.PENDIENTE_MAESTRO, true);
});
