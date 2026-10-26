const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repository = require('../src/repositories/altas.repository');
const altasService = require('../src/services/altas.service');

const resolver = altasService._internals.resolverRubroFact;

test('RUBRO_FACT prioriza la configuración SQL sobre las reglas históricas del código', async () => {
  const original = repository.buscarConfiguracionRubroFact;
  repository.buscarConfiguracionRubroFact = async datos => ({
    ...datos,
    RUBRO_FACTURACION: 'MOD_CALZ_NUEVO',
  });

  try {
    assert.equal(
      await resolver(2, 'VANTEK', 'CALZADO', null, 'MODULO'),
      'MOD_CALZ_NUEVO'
    );
  } finally {
    repository.buscarConfiguracionRubroFact = original;
  }
});

test('RUBRO_FACT conserva compatibilidad si todavía no existe una fila configurable', async () => {
  const original = repository.buscarConfiguracionRubroFact;
  repository.buscarConfiguracionRubroFact = async () => null;

  try {
    assert.equal(
      await resolver(2, 'VANTEK', 'CALZADO', null, 'PAR_SUELTO'),
      'CALZ_VTK'
    );
  } finally {
    repository.buscarConfiguracionRubroFact = original;
  }
});

test('la migración permite mantener RUBRO_FACT sin publicar nuevamente', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'sql', '38_reglas_rubro_fact_configurables.sql'),
    'utf8'
  );

  assert.match(sql, /CREATE TABLE dbo\.REGLAS_RUBRO_FACT/);
  assert.match(sql, /UNIQUE \(ID_EMPRESA, MARCA_EMPRESA, CODIGO_RUBRO, TIPO_PRODUCTO\)/);
  assert.match(sql, /'VANTEK',\s+'CALZADO',\s+'MODULO',\s+'MOD_CALZ_VTK'/);
  assert.match(sql, /Plantilla para crear o actualizar una regla/);

  const procedimiento = fs.readFileSync(
    path.join(__dirname, '..', 'sql', '39_configurar_regla_rubro_fact.sql'),
    'utf8'
  );
  assert.match(procedimiento, /CREATE OR ALTER PROCEDURE dbo\.CONFIGURAR_REGLA_RUBRO_FACT/);
  assert.match(procedimiento, /El RUBRO_FACT no existe activo en el maestro de Presea/);
});
