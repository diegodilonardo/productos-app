const { getConnection, sql } = require('../config/database');

function validarPendientes(pendientes) {
  if (pendientes.length) throw Object.assign(new Error(
    'No se puede enviar el DBI: hay altas EXPORTADAS de esta empresa pendientes de confirmar en Presea: ' +
    pendientes.map(a => `${a.CODIGO_ALTA} (ID ${a.ID_ALTA})`).join(', ') +
    '. Esperá la confirmación y sincronización de Presea antes de exportar otra alta.'
  ), { status: 409 });
}

async function ejecutar(idAlta, operacion) {
  const pool = await getConnection();
  const alta = (await pool.request().input('ID_ALTA', sql.Int, Number(idAlta)).query(
    'SELECT ID_EMPRESA FROM dbo.ALTAS_PRODUCTOS WHERE ID_ALTA=@ID_ALTA;'
  )).recordset[0];
  if (!alta) throw Object.assign(new Error(`No existe el alta ${idAlta}.`), { status: 404 });
  // Mantener un bloqueo lógico por empresa durante todo el envío, sin
  // bloquear filas: evita que dos solicitudes superen el control a la vez.
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const bloqueo = await new sql.Request(transaction)
      .input('RECURSO', sql.NVarChar(255), `ProductosApp:ExportarAlta:${alta.ID_EMPRESA}`)
      .query(`DECLARE @R int;
        EXEC @R=sys.sp_getapplock @Resource=@RECURSO, @LockMode='Exclusive',
          @LockOwner='Transaction', @LockTimeout=0;
        SELECT @R RESULTADO;`);
    if (Number(bloqueo.recordset[0].RESULTADO) < 0) throw Object.assign(new Error(
      'Ya hay un envío de DBI en curso para esta empresa. Esperá a que termine.'
    ), { status: 409 });
    const pendientes = await new sql.Request(transaction)
      .input('ID_EMPRESA', sql.Int, alta.ID_EMPRESA)
      .input('ID_ALTA', sql.Int, Number(idAlta))
      .query(`SELECT ID_ALTA,CODIGO_ALTA FROM dbo.ALTAS_PRODUCTOS
        WHERE ID_EMPRESA=@ID_EMPRESA AND ID_ALTA<>@ID_ALTA AND ESTADO='EXPORTADO'
        ORDER BY ID_ALTA;`);
    validarPendientes(pendientes.recordset);
    return await operacion();
  } finally {
    // Esta transacción sólo posee el bloqueo lógico; los cambios de la
    // exportación se registran mediante su propio repositorio.
    await transaction.rollback();
  }
}
module.exports = { ejecutar, validarPendientes };
