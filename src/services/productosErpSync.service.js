const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConnection, sql } = require('../config/database');

function texto(v) {
  return String(v ?? '').trim();
}

function resolverArchivo() {
  if (process.env.PRODUCTOS_ERP_FILE) {
    return path.resolve(process.env.PRODUCTOS_ERP_FILE);
  }

  if (!process.env.MAESTROS_PATH) {
    throw new Error('Falta PRODUCTOS_ERP_FILE o MAESTROS_PATH en .env.');
  }

  return path.join(process.env.MAESTROS_PATH, 'TBL_MAESTRO_PRODS_ATOMIK.TXT');
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parsear(buffer) {
  const contenido = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lineas = contenido.split(/\r?\n/);
  const porCodigo = new Map();
  let invalidas = 0;
  let noVacias = 0;

  for (const lineaOriginal of lineas) {
    const linea = lineaOriginal.trim();
    if (!linea) continue;
    noVacias++;

    const partes = linea.split('|');
    if (partes.length < 4) {
      invalidas++;
      continue;
    }

    const codigoAlfa = texto(partes[0]);
    const codigo = texto(partes[1]);
    const codigoEan = texto(partes[2]);
    const rubroErp = texto(partes.slice(3).join('|'));

    if (!codigoAlfa) {
      invalidas++;
      continue;
    }

    porCodigo.set(codigoAlfa, {
      CODIGO_ALFA: codigoAlfa,
      CODIGO: codigo || null,
      CODIGO_EAN: codigoEan || null,
      RUBRO_ERP: rubroErp || null,
    });
  }

  return {
    registros: [...porCodigo.values()],
    invalidas,
    duplicadas: Math.max(0, noVacias - invalidas - porCodigo.size),
  };
}

function crearTablaBulk(registros) {
  const tabla = new sql.Table('dbo.PRODUCTOS_ERP_STAGING');
  tabla.create = false;
  tabla.columns.add('CODIGO_ALFA', sql.VarChar(30), { nullable: false });
  tabla.columns.add('CODIGO', sql.VarChar(30), { nullable: true });
  tabla.columns.add('CODIGO_EAN', sql.VarChar(20), { nullable: true });
  tabla.columns.add('RUBRO_ERP', sql.VarChar(30), { nullable: true });

  for (const r of registros) {
    tabla.rows.add(r.CODIGO_ALFA, r.CODIGO, r.CODIGO_EAN, r.RUBRO_ERP);
  }

  return tabla;
}

async function asegurarEstructura(pool) {
  const r = await pool.request().query(`
    SELECT
      OBJECT_ID('dbo.PRODUCTOS', 'U') AS PRODUCTOS,
      OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING', 'U') AS STAGING,
      OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'U') AS EXPORTADOS,
      OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE', 'U') AS DETALLES,
      OBJECT_ID('dbo.ALTAS_PRODUCTOS', 'U') AS ALTAS,
      COL_LENGTH('dbo.PRODUCTOS', 'TIPO_PRODUCTO') AS P_TIPO,
      COL_LENGTH('dbo.PRODUCTOS', 'CODIGO_ALFA') AS P_ALFA,
      COL_LENGTH('dbo.PRODUCTOS', 'CODIGO') AS P_CODIGO,
      COL_LENGTH('dbo.PRODUCTOS', 'CODIGO_EAN') AS P_EAN,
      COL_LENGTH('dbo.PRODUCTOS', 'ACTIVO') AS P_ACTIVO,
      COL_LENGTH('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'COD_ALFA') AS E_ALFA;
  `);

  const x = r.recordset[0];
  if (!x.PRODUCTOS || !x.STAGING || !x.EXPORTADOS || !x.DETALLES || !x.ALTAS) {
    throw new Error('Falta alguna tabla requerida para sincronizar PRODUCTOS ERP.');
  }

  if (!x.P_TIPO || !x.P_ALFA || !x.P_CODIGO || !x.P_EAN || !x.P_ACTIVO) {
    throw new Error('dbo.PRODUCTOS no tiene la estructura esperada: TIPO_PRODUCTO, CODIGO_ALFA, CODIGO, CODIGO_EAN, ACTIVO.');
  }

  if (!x.E_ALFA) {
    throw new Error('ALTAS_PRODUCTOS_EXPORTADOS no contiene COD_ALFA.');
  }
}

async function sincronizarProductosErp(opciones = {}) {
  const archivo = path.resolve(opciones.archivo || resolverArchivo());
  if (!fs.existsSync(archivo)) {
    throw new Error(`No existe el maestro de productos: ${archivo}`);
  }

  const buffer = fs.readFileSync(archivo);
  const hash = hashBuffer(buffer);
  const { registros, invalidas, duplicadas } = parsear(buffer);

  if (!registros.length) {
    throw new Error('El maestro de productos no contiene registros válidos.');
  }

  const pool = await getConnection();
  await asegurarEstructura(pool);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction).query('TRUNCATE TABLE dbo.PRODUCTOS_ERP_STAGING;');
    await new sql.Request(transaction).bulk(crearTablaBulk(registros));

    const merge = await new sql.Request(transaction).query(`
      DECLARE @Cambios TABLE (ACCION NVARCHAR(10));

      /*
        El maestro consolidado no trae TIPO_PRODUCTO.
        - Si el CODIGO_ALFA ya existe, conservamos su tipo.
        - Si fue generado por PRODUCTOS_APP, lo recuperamos del detalle exportado.
        - Para históricos desconocidos usamos PAR_SUELTO solamente como valor técnico
          para satisfacer el NOT NULL. La existencia ERP se controla globalmente por
          CODIGO_ALFA y ya no depende de este campo.
      */
      MERGE dbo.PRODUCTOS AS T
      USING (
        SELECT
          S.CODIGO_ALFA,
          S.CODIGO,
          S.CODIGO_EAN,
          S.RUBRO_ERP,
          COALESCE(D.TIPO_PRODUCTO_DETALLE, 'PAR_SUELTO') AS TIPO_PRODUCTO_NUEVO
        FROM dbo.PRODUCTOS_ERP_STAGING S
        OUTER APPLY (
          SELECT TOP 1 D1.TIPO_PRODUCTO_DETALLE
          FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E1
          INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE D1
                  ON D1.ID_ALTA = E1.ID_ALTA
                 AND D1.CODIGO_ALFA = E1.COD_ALFA
          WHERE E1.COD_ALFA = S.CODIGO_ALFA
          ORDER BY D1.ID_DETALLE DESC
        ) D
      ) AS S
      ON T.CODIGO_ALFA = S.CODIGO_ALFA

      WHEN MATCHED AND (
           ISNULL(CONVERT(VARCHAR(30), T.CODIGO), '') <> ISNULL(S.CODIGO, '') OR
           ISNULL(CONVERT(VARCHAR(20), T.CODIGO_EAN), '') <> ISNULL(S.CODIGO_EAN, '') OR
           ISNULL(T.ACTIVO, 0) <> 1
      ) THEN
        UPDATE SET
          T.CODIGO = S.CODIGO,
          T.CODIGO_EAN = S.CODIGO_EAN,
          T.ACTIVO = 1

      WHEN NOT MATCHED BY TARGET THEN
        INSERT (
          TIPO_PRODUCTO,
          CODIGO_ALFA,
          CODIGO,
          CODIGO_EAN,
          ACTIVO
        )
        VALUES (
          S.TIPO_PRODUCTO_NUEVO,
          S.CODIGO_ALFA,
          S.CODIGO,
          S.CODIGO_EAN,
          1
        )

      WHEN NOT MATCHED BY SOURCE AND ISNULL(T.ACTIVO, 0) = 1 THEN
        UPDATE SET T.ACTIVO = 0

      OUTPUT $action INTO @Cambios;

      SELECT
        SUM(CASE WHEN ACCION = 'INSERT' THEN 1 ELSE 0 END) AS INSERTADOS,
        SUM(CASE WHEN ACCION = 'UPDATE' THEN 1 ELSE 0 END) AS ACTUALIZADOS
      FROM @Cambios;
    `);

    const conciliacion = await new sql.Request(transaction).query(`
      DECLARE @Confirmados TABLE (ID_ALTA BIGINT, COD_ALFA VARCHAR(30));

      UPDATE E
         SET E.CODIGO_ERP = CONVERT(VARCHAR(30), P.CODIGO),
             E.EAN_ERP = CONVERT(VARCHAR(20), P.CODIGO_EAN),
             E.ESTADO_ERP = 'GENERADO_OK_EN_ERP',
             E.FECHA_CONFIRMACION_ERP = COALESCE(E.FECHA_CONFIRMACION_ERP, SYSDATETIME())
      OUTPUT INSERTED.ID_ALTA, INSERTED.COD_ALFA INTO @Confirmados
      FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E
      INNER JOIN dbo.PRODUCTOS P
              ON P.CODIGO_ALFA = E.COD_ALFA
             AND ISNULL(P.ACTIVO, 1) = 1
      WHERE ISNULL(E.ESTADO_ERP, 'PENDIENTE_ERP') <> 'GENERADO_OK_EN_ERP';

      UPDATE A
         SET A.ESTADO =
             CASE
               WHEN X.TOTAL_EXPORTADOS > 0 AND X.PENDIENTES = 0
                 THEN 'GENERADO_OK_EN_ERP'
               WHEN X.CONFIRMADOS > 0
                 THEN 'PARCIAL_ERP'
               ELSE A.ESTADO
             END
      FROM dbo.ALTAS_PRODUCTOS A
      CROSS APPLY (
        SELECT
          COUNT(*) AS TOTAL_EXPORTADOS,
          SUM(CASE WHEN E.ESTADO_ERP = 'GENERADO_OK_EN_ERP' THEN 1 ELSE 0 END) AS CONFIRMADOS,
          SUM(CASE WHEN ISNULL(E.ESTADO_ERP, 'PENDIENTE_ERP') <> 'GENERADO_OK_EN_ERP' THEN 1 ELSE 0 END) AS PENDIENTES
        FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E
        WHERE E.ID_ALTA = A.ID_ALTA
      ) X
      WHERE A.ESTADO IN ('EXPORTADO', 'PARCIAL_ERP', 'GENERADO_OK_EN_ERP')
        AND X.TOTAL_EXPORTADOS > 0;

      SELECT
        (SELECT COUNT(*) FROM @Confirmados) AS CONFIRMADOS_EN_ESTA_SYNC,
        (SELECT COUNT(*) FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS WHERE ESTADO_ERP = 'GENERADO_OK_EN_ERP') AS CONFIRMADOS_TOTAL,
        (SELECT COUNT(*) FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS WHERE ISNULL(ESTADO_ERP, 'PENDIENTE_ERP') <> 'GENERADO_OK_EN_ERP') AS PENDIENTES_TOTAL;
    `);

    await transaction.commit();

    const cambios = merge.recordset[0] || {};
    const conc = conciliacion.recordset[0] || {};

    return {
      ok: true,
      archivo,
      hash,
      registrosLeidos: registros.length,
      lineasInvalidas: invalidas,
      codigosDuplicadosEnArchivo: duplicadas,
      insertados: Number(cambios.INSERTADOS || 0),
      actualizados: Number(cambios.ACTUALIZADOS || 0),
      confirmadosEnEstaSync: Number(conc.CONFIRMADOS_EN_ESTA_SYNC || 0),
      confirmadosTotal: Number(conc.CONFIRMADOS_TOTAL || 0),
      pendientesTotal: Number(conc.PENDIENTES_TOTAL || 0),
    };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

module.exports = {
  sincronizarProductosErp,
  resolverArchivo,
};
