const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('las reglas EAN se configuran por empresa, marca, rubro y licencia',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../sql/25_reglas_ean.sql'),'utf8');
  const repo=fs.readFileSync(path.join(__dirname,'../src/repositories/seguimiento.repository.js'),'utf8');
  const vista=fs.readFileSync(path.join(__dirname,'../views/altas-maestros/index.hbs'),'utf8');
  assert.match(sql,/UNIQUE \(ID_EMPRESA, MARCA, RUBRO, LICENCIA\)/);
  assert.match(repo,/REGLAS_REQUERIMIENTO_EAN/);
  assert.match(repo,/ELSE CONVERT\(BIT,1\)/);
  assert.match(vista,/id="marcaReglaEan"[\s\S]*id="rubroReglaEan"[\s\S]*id="licenciaReglaEan"/);
});

test('Seguimiento identifica y excluye visualmente los EAN no requeridos',()=>{
  const servicio=fs.readFileSync(path.join(__dirname,'../src/services/seguimiento.service.js'),'utf8');
  const cliente=fs.readFileSync(path.join(__dirname,'../public/js/seguimiento.js'),'utf8');
  assert.match(servicio,/fila\.REQUIERE_EAN === false[\s\S]*'NO_REQUERIDO'/);
  assert.match(cliente,/EAN NO REQUERIDO/);
  assert.match(cliente,/estadoEan === 'NO_REQUERIDO' \? 'disabled'/);
});
