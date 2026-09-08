require('dotenv').config();

const { getConnection } = require('../src/config/database');
const altasRepository = require('../src/repositories/altas.repository');
const imagenesAltaService = require('../src/services/imagenesAlta.service');

const aplicar = process.argv.includes('--apply');

async function ejecutar() {
  const pool = await getConnection();
  const altas = await pool.request().query(`
    SELECT DISTINCT A.ID_ALTA
    FROM dbo.ALTAS_PRODUCTOS A
    INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE D
      ON D.ID_EMPRESA = A.ID_EMPRESA AND D.ID_ALTA = A.ID_ALTA
    WHERE ISNULL(D.GENERADO_AUTOMATICO, 0) = 0
    ORDER BY A.ID_ALTA;
  `);
  const antes = await pool.request().query(`
    SELECT COUNT_BIG(*) AS CANTIDAD FROM dbo.ALTAS_PRODUCTOS_IMAGENES;
  `);

  if (!aplicar) {
    console.log(JSON.stringify({
      modo: 'SIMULACION',
      altasARevisar: altas.recordset.length,
      imagenesRegistradasActualmente: Number(antes.recordset[0].CANTIDAD),
      mensaje: 'Ejecute con --apply para registrar los archivos existentes.'
    }, null, 2));
    await pool.close();
    return;
  }

  const resumen = {
    modo: 'APLICAR',
    altasRevisadas: 0,
    familiasSinArchivo: 0,
    errores: [],
  };

  for (const fila of altas.recordset) {
    try {
      const alta = await altasRepository.obtenerAltaPorId(fila.ID_ALTA);
      const detalle = await altasRepository.obtenerDetalleAlta(fila.ID_ALTA);
      const faltantes = await imagenesAltaService.listarFamiliasSinImagen(
        alta,
        detalle,
        { usuario: 'MIGRACION_IMAGENES' }
      );
      resumen.altasRevisadas += 1;
      resumen.familiasSinArchivo += faltantes.length;
    } catch (error) {
      resumen.errores.push({ idAlta: Number(fila.ID_ALTA), mensaje: error.message });
    }
  }

  const despues = await pool.request().query(`
    SELECT COUNT_BIG(*) AS CANTIDAD FROM dbo.ALTAS_PRODUCTOS_IMAGENES;
  `);
  resumen.imagenesRegistradasAntes = Number(antes.recordset[0].CANTIDAD);
  resumen.imagenesRegistradasDespues = Number(despues.recordset[0].CANTIDAD);
  resumen.imagenesIncorporadas = resumen.imagenesRegistradasDespues - resumen.imagenesRegistradasAntes;
  resumen.cantidadErrores = resumen.errores.length;
  resumen.errores = resumen.errores.slice(0, 20);

  console.log(JSON.stringify(resumen, null, 2));
  await pool.close();
}

ejecutar().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
