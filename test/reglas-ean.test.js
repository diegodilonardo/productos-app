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
  assert.match(repo,/COALESCE\(RE\.REQUIERE_EAN, CONVERT\(BIT,1\)\)/);
  assert.match(vista,/id="marcaReglaEan"[\s\S]*id="rubroReglaEan"[\s\S]*id="licenciaReglaEan"/);
});

test('la configuración general por empresa admite que GYD no gestione EAN',()=>{
  const repo=fs.readFileSync(path.join(__dirname,'../src/repositories/seguimiento.repository.js'),'utf8');
  const vista=fs.readFileSync(path.join(__dirname,'../views/altas-maestros/index.hbs'),'utf8');
  const migracion=fs.readFileSync(path.join(__dirname,'../sql/26_configuracion_ean_gyd.sql'),'utf8');
  assert.match(repo,/R\.MARCA='\*' AND R\.RUBRO='\*'/);
  assert.match(repo,/ORDER BY CASE WHEN R\.MARCA='\*'/);
  assert.match(vista,/id="requiereEanEmpresa"/);
  assert.match(migracion,/REQUIERE_EAN=0/);
});

test('GTIN se envía por las carpetas FTP de las empresas que gestionan EAN',()=>{
  const servicio=fs.readFileSync(path.join(__dirname,'../src/services/seguimiento.service.js'),'utf8');
  assert.match(servicio,/1: '\/EAN\/VICBOR'/);
  assert.match(servicio,/2: '\/EAN\/MIDING'/);
  assert.match(servicio,/4: '\/EAN\/BAGUNZA'/);
  assert.match(servicio,/ftpService\.existeArchivo/);
  assert.match(servicio,/ftpService\.subirArchivo/);
  assert.doesNotMatch(servicio,/3: '\/EAN\/GYD'/);
});

test('Seguimiento identifica y excluye visualmente los EAN no requeridos',()=>{
  const servicio=fs.readFileSync(path.join(__dirname,'../src/services/seguimiento.service.js'),'utf8');
  const cliente=fs.readFileSync(path.join(__dirname,'../public/js/seguimiento.js'),'utf8');
  assert.match(servicio,/fila\.REQUIERE_EAN === false[\s\S]*'NO_REQUERIDO'/);
  assert.match(cliente,/EAN NO REQUERIDO/);
  assert.match(cliente,/estadoEan === 'NO_REQUERIDO' \? 'disabled'/);
});

test('Maestros presenta el control EAN como una sección independiente',()=>{
  const vista=fs.readFileSync(path.join(__dirname,'../views/altas-maestros/index.hbs'),'utf8');
  const cliente=fs.readFileSync(path.join(__dirname,'../public/js/altas-maestros.js'),'utf8');
  assert.match(vista,/id="tabReglasEan"[\s\S]*>Control de EAN<\/button>/);
  assert.match(vista,/id="panelReglasEan" class="d-none"/);
  assert.match(cliente,/panel === 'ean'/);
  assert.match(cliente,/panelReglasEan/);
});

test('el listado de solicitudes de maestros muestra marca y rubro',()=>{
  const vista=fs.readFileSync(path.join(__dirname,'../views/altas-maestros/index.hbs'),'utf8');
  const cliente=fs.readFileSync(path.join(__dirname,'../public/js/altas-maestros.js'),'utf8');
  assert.match(vista,/Descripción<\/th><th[\s\S]*>Marca<\/th><th>Rubro<\/th><th>Usuario/);
  assert.match(cliente,/x\.MARCA \|\| '-'/);
  assert.match(cliente,/x\.RUBRO \|\| '-'/);
});
