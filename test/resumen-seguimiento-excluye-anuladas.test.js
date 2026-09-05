const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const seguimientoService = require('../src/services/seguimiento.service');
const seguimientoRepository = require('../src/repositories/seguimiento.repository');

const accesoTotal = {
  todasMarcas: true,
  todosRubros: true,
  todasLicencias: true
};

test('Dashboard y Seguimiento excluyen Altas anuladas de las métricas ERP', async () => {
  const listarOriginal = seguimientoRepository.listarAltasSeguimiento;
  seguimientoRepository.listarAltasSeguimiento = async () => [
    {
      ID_ALTA: 1, ESTADO: 'GENERADO_OK_EN_ERP', LICENCIA_ALTA: null,
      CANTIDAD_EXPORTADOS: 11, CANTIDAD_CONFIRMADOS_ERP: 11,
      CANTIDAD_PENDIENTES_ERP: 0, CANTIDAD_ERROR_ERP: 0
    },
    {
      ID_ALTA: 12, ESTADO: 'ANULADO', LICENCIA_ALTA: null,
      CANTIDAD_EXPORTADOS: 64, CANTIDAD_CONFIRMADOS_ERP: 0,
      CANTIDAD_PENDIENTES_ERP: 64, CANTIDAD_ERROR_ERP: 0
    }
  ];

  try {
    const resultado = await seguimientoService.obtenerResumen({ idEmpresa: 2, acceso: accesoTotal });
    assert.equal(resultado.altas.total, 1);
    assert.equal(resultado.altas.totalIncluyendoAnuladas, 2);
    assert.equal(resultado.altas.anulado, 1);
    assert.deepEqual(resultado.erp, {
      totalExportados: 11,
      pendientes: 0,
      confirmados: 11,
      errores: 0
    });
  } finally {
    seguimientoRepository.listarAltasSeguimiento = listarOriginal;
  }
});

test('la conciliación de exportaciones siempre queda limitada por empresa', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/repositories/seguimiento.repository.js'),
    'utf8'
  );

  assert.match(fuente, /E\.ID_EMPRESA = A\.ID_EMPRESA/);
  assert.match(fuente, /WHERE ID_ALTA = @ID_ALTA\s+AND ID_EMPRESA = @ID_EMPRESA/g);
});
