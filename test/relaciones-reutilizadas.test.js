const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('RELACION incluye primeras reutilizadas de otra alta sin duplicarlas', async () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../src/repositories/exportacion.repository.js'), 'utf8');
  const inicio = fuente.indexOf('async function completarRelacionesReutilizadas');
  const fin = fuente.indexOf('\n\n/*', inicio);
  let consulta;
  const existente = { COD_ALFA_MODULO:'MOD', COD_ALFA_INSUMO:'28' };
  const nuevo = { COD_ALFA_MODULO:'MOD', COD_ALFA_INSUMO:'29' };
  const contexto = { sql:{ Int:'Int' }, JOIN_MAESTRO_MODULO_POR_EMPRESA:'M.ID_EMPRESA=P.ID_EMPRESA', getConnection:async () => ({request:() => ({ input() { return this; }, query:async texto => { consulta=texto;return {recordset:[existente,nuevo]}; } })}) };
  vm.createContext(contexto);
  vm.runInContext(fuente.slice(inicio, fin), contexto);
  const registros = await contexto.completarRelacionesReutilizadas(38, [existente]);
  assert.equal(registros.length, 2);
  assert.equal(registros[1], nuevo);
  for (const restriccion of ['D.ID_EMPRESA=P.ID_EMPRESA','AH.CODIGO_MARCA=A.CODIGO_MARCA','AH.CODIGO_RUBRO=A.CODIGO_RUBRO','AH.CODIGO_ANO=A.CODIGO_ANO','AH.CODIGO_TEMPORADA=A.CODIGO_TEMPORADA',"D.CODIGO_CLASIFICACION='1'",'T.CANTIDAD>0']) assert.ok(consulta.includes(restriccion));
  assert.ok(consulta.includes('M.T_3XL'));
  assert.ok(!consulta.includes('M.T3XL'));
});
