const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  getConnection,
  sql
} = require('../config/database');

const {
  descargarArchivos
} = require('./ftp.service');


function texto(v) {
  return String(v ?? '').trim();
}


function hashBuffer(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');
}


/* ============================================================
   EMPRESAS ACTIVAS CON ARCHIVO DE PRODUCTOS CONFIGURADO
   ============================================================ */

async function obtenerEmpresasProductos() {

  const pool =
    await getConnection();

  const resultado =
    await pool.request().query(`
      SELECT
        E.ID_EMPRESA,
        E.CODIGO_EMPRESA,
        E.RAZON_SOCIAL,
        C.FTP_RUTA_MAESTROS,
        C.FTP_ARCHIVO_PRODUCTOS

      FROM dbo.EMPRESAS E

      INNER JOIN dbo.EMPRESAS_CONFIG C
              ON C.ID_EMPRESA = E.ID_EMPRESA

      WHERE E.ACTIVA = 1
        AND C.ACTIVA = 1
        AND C.FTP_ARCHIVO_PRODUCTOS IS NOT NULL
        AND LTRIM(RTRIM(C.FTP_ARCHIVO_PRODUCTOS)) <> ''

      ORDER BY E.ID_EMPRESA;
    `);

  return resultado.recordset;
}


/* ============================================================
   PARSER
   Formato:
   CODIGO_ALFA|CODIGO|EAN|RUBRO|CODIGO_EMPRESA
   ============================================================ */

function parsear(
  buffer,
  codigoEmpresaEsperado
) {

  const contenido =
    buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '');

  const lineas =
    contenido.split(/\r?\n/);

  const porCodigo =
    new Map();

  let invalidas = 0;
  let noVacias = 0;


  for (
    let i = 0;
    i < lineas.length;
    i++
  ) {

    const lineaOriginal =
      lineas[i];

    const linea =
      lineaOriginal.trim();

    if (!linea) {
      continue;
    }

    noVacias++;


    const partes =
      linea
        .split('|')
        .map(texto);


    /*
      Ahora exigimos el código de empresa como último campo.
      Se esperan exactamente 5 columnas.
    */
    if (partes.length !== 5) {
      throw new Error(
        `Estructura inválida en línea ${i + 1}. ` +
        `Se esperaban 5 columnas y se encontraron ${partes.length}.`
      );
    }


    const codigoAlfa =
      partes[0];

    const codigo =
      partes[1];

    const codigoEan =
      partes[2];

    const rubroErp =
      partes[3];

    const codigoEmpresaArchivo =
      partes[4];


    if (!codigoAlfa) {
      invalidas++;
      continue;
    }


    if (!codigoEmpresaArchivo) {
      throw new Error(
        `CODIGO_EMPRESA vacío en línea ${i + 1}.`
      );
    }


    if (
      codigoEmpresaArchivo !==
      String(codigoEmpresaEsperado)
    ) {

      throw new Error(
        `CODIGO_EMPRESA incorrecto en línea ${i + 1}. ` +
        `Esperado: ${codigoEmpresaEsperado}. ` +
        `Archivo: ${codigoEmpresaArchivo}.`
      );
    }


    porCodigo.set(
      codigoAlfa,
      {
        CODIGO_ALFA:
          codigoAlfa,

        CODIGO:
          codigo || null,

        CODIGO_EAN:
          codigoEan || null,

        RUBRO_ERP:
          rubroErp || null
      }
    );
  }


  return {
    registros:
      [...porCodigo.values()],

    invalidas,

    duplicadas:
      Math.max(
        0,
        noVacias -
        invalidas -
        porCodigo.size
      )
  };
}


/* ============================================================
   BULK STAGING
   ============================================================ */

function crearTablaBulk(
  registros,
  idEmpresa
) {

  const tabla =
    new sql.Table(
      'dbo.PRODUCTOS_ERP_STAGING'
    );

  tabla.create = false;

  tabla.columns.add(
    'ID_EMPRESA',
    sql.Int,
    {
      nullable: false
    }
  );

  tabla.columns.add(
    'CODIGO_ALFA',
    sql.VarChar(30),
    {
      nullable: false
    }
  );

  tabla.columns.add(
    'CODIGO',
    sql.VarChar(30),
    {
      nullable: true
    }
  );

  tabla.columns.add(
    'CODIGO_EAN',
    sql.VarChar(20),
    {
      nullable: true
    }
  );

  tabla.columns.add(
    'RUBRO_ERP',
    sql.VarChar(30),
    {
      nullable: true
    }
  );


  for (
    const r
    of registros
  ) {

    tabla.rows.add(
      idEmpresa,
      r.CODIGO_ALFA,
      r.CODIGO,
      r.CODIGO_EAN,
      r.RUBRO_ERP
    );
  }


  return tabla;
}


/* ============================================================
   VALIDACIÓN ESTRUCTURA
   ============================================================ */

async function asegurarEstructura(
  pool
) {

  const r =
    await pool.request().query(`
      SELECT
        OBJECT_ID('dbo.PRODUCTOS', 'U')
          AS PRODUCTOS,

        OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING', 'U')
          AS STAGING,

        OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'U')
          AS EXPORTADOS,

        OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE', 'U')
          AS DETALLES,

        OBJECT_ID('dbo.ALTAS_PRODUCTOS', 'U')
          AS ALTAS,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'ID_EMPRESA'
        )
          AS P_EMPRESA,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'TIPO_PRODUCTO'
        )
          AS P_TIPO,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'CODIGO_ALFA'
        )
          AS P_ALFA,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'CODIGO'
        )
          AS P_CODIGO,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'CODIGO_EAN'
        )
          AS P_EAN,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'ACTIVO'
        )
          AS P_ACTIVO,

        COL_LENGTH(
          'dbo.PRODUCTOS',
          'ID_PRODUCTO'
        )
          AS P_ID,

        COL_LENGTH(
          'dbo.PRODUCTOS_ERP_STAGING',
          'ID_EMPRESA'
        )
          AS S_EMPRESA,

        COLUMNPROPERTY(
          OBJECT_ID('dbo.PRODUCTOS'),
          'ID_PRODUCTO',
          'IsIdentity'
        )
          AS P_ID_IDENTITY,

        COL_LENGTH(
          'dbo.ALTAS_PRODUCTOS_EXPORTADOS',
          'COD_ALFA'
        )
          AS E_ALFA,

        COL_LENGTH(
          'dbo.ALTAS_PRODUCTOS_EXPORTADOS',
          'ID_EMPRESA'
        )
          AS E_EMPRESA,

        COL_LENGTH(
          'dbo.ALTAS_PRODUCTOS_DETALLE',
          'ID_EMPRESA'
        )
          AS D_EMPRESA,

        COL_LENGTH(
          'dbo.ALTAS_PRODUCTOS',
          'ID_EMPRESA'
        )
          AS A_EMPRESA;
    `);


  const x =
    r.recordset[0];


  if (
    !x.PRODUCTOS ||
    !x.STAGING ||
    !x.EXPORTADOS ||
    !x.DETALLES ||
    !x.ALTAS
  ) {

    throw new Error(
      'Falta alguna tabla requerida para sincronizar PRODUCTOS ERP.'
    );
  }


  if (
    !x.P_ID ||
    !x.P_EMPRESA ||
    !x.P_TIPO ||
    !x.P_ALFA ||
    !x.P_CODIGO ||
    !x.P_EAN ||
    !x.P_ACTIVO ||
    !x.S_EMPRESA
  ) {

    throw new Error(
      'dbo.PRODUCTOS / PRODUCTOS_ERP_STAGING ' +
      'no tienen la estructura multiempresa esperada.'
    );
  }


  if (
    !x.E_ALFA ||
    !x.E_EMPRESA ||
    !x.D_EMPRESA ||
    !x.A_EMPRESA
  ) {
    throw new Error(
      'ALTAS_PRODUCTOS / DETALLE / EXPORTADOS ' +
      'no tienen la estructura multiempresa esperada.'
    );
  }


  return {
    idProductoEsIdentity:
      Number(
        x.P_ID_IDENTITY || 0
      ) === 1
  };
}


/* ============================================================
   CARPETA LOCAL TEMPORAL
   ============================================================ */

function obtenerCarpetaLocal(
  idEmpresa
) {

  const raiz =
    process.env.MAESTROS_TEMP_PATH
      ? String(
          process.env.MAESTROS_TEMP_PATH
        ).trim()
      : path.join(
          process.cwd(),
          'tmp',
          'maestros'
        );


  return path.join(
    raiz,
    String(idEmpresa)
  );
}


/* ============================================================
   DESCARGAR ARCHIVO DE PRODUCTOS DE UNA EMPRESA
   ============================================================ */

async function descargarArchivoEmpresa(
  empresa
) {

  const carpetaLocal =
    obtenerCarpetaLocal(
      empresa.ID_EMPRESA
    );


  const resultado =
    await descargarArchivos(
      empresa.FTP_RUTA_MAESTROS,
      [
        empresa.FTP_ARCHIVO_PRODUCTOS
      ],
      carpetaLocal
    );


  if (
    !resultado.archivos ||
    resultado.archivos.length !== 1
  ) {

    throw new Error(
      `No se pudo descargar el maestro de productos ` +
      `de ${empresa.RAZON_SOCIAL}.`
    );
  }


  return resultado.archivos[0].rutaLocal;
}


/* ============================================================
   SINCRONIZAR UNA EMPRESA
   ============================================================ */

async function sincronizarEmpresa(
  empresa,
  estructura,
  pool
) {

  const archivo =
    await descargarArchivoEmpresa(
      empresa
    );


  if (
    !fs.existsSync(
      archivo
    )
  ) {

    throw new Error(
      `No existe el maestro de productos: ${archivo}`
    );
  }


  const buffer =
    fs.readFileSync(
      archivo
    );


  const hash =
    hashBuffer(
      buffer
    );


  const {
    registros,
    invalidas,
    duplicadas
  } =
    parsear(
      buffer,
      empresa.CODIGO_EMPRESA
    );


  if (
    !registros.length
  ) {

    throw new Error(
      `El maestro de productos de ${empresa.RAZON_SOCIAL} ` +
      `no contiene registros válidos.`
    );
  }


  const transaction =
    new sql.Transaction(
      pool
    );


  await transaction.begin();


  try {

    /*
      El staging es de trabajo y se procesa una empresa por vez.
    */
    await new sql.Request(
      transaction
    ).query(`
      TRUNCATE TABLE dbo.PRODUCTOS_ERP_STAGING;
    `);


    await new sql.Request(
      transaction
    ).bulk(
      crearTablaBulk(
        registros,
        empresa.ID_EMPRESA
      )
    );


    const insertarIdProducto =
      !estructura.idProductoEsIdentity;


    const columnasInsert =
      insertarIdProducto
        ? `
            ID_PRODUCTO,
            ID_EMPRESA,
            TIPO_PRODUCTO,
            CODIGO_ALFA,
            CODIGO,
            CODIGO_EAN,
            ACTIVO
          `
        : `
            ID_EMPRESA,
            TIPO_PRODUCTO,
            CODIGO_ALFA,
            CODIGO,
            CODIGO_EAN,
            ACTIVO
          `;


    const valoresInsert =
      insertarIdProducto
        ? `
            S.ID_PRODUCTO_NUEVO,
            S.ID_EMPRESA,
            S.TIPO_PRODUCTO_NUEVO,
            S.CODIGO_ALFA,
            S.CODIGO,
            S.CODIGO_EAN,
            1
          `
        : `
            S.ID_EMPRESA,
            S.TIPO_PRODUCTO_NUEVO,
            S.CODIGO_ALFA,
            S.CODIGO,
            S.CODIGO_EAN,
            1
          `;


    const merge =
      await new sql.Request(
        transaction
      )
      .input(
        'ID_EMPRESA',
        sql.Int,
        empresa.ID_EMPRESA
      )
      .query(`
        DECLARE @Cambios TABLE (
          ACCION NVARCHAR(10)
        );


        DECLARE @MaxId BIGINT =
          ISNULL(
            (
              SELECT MAX(ID_PRODUCTO)
              FROM dbo.PRODUCTOS
                   WITH (UPDLOCK, HOLDLOCK)
            ),
            0
          );


        MERGE dbo.PRODUCTOS
              WITH (HOLDLOCK)
              AS T

        USING (
          SELECT
            S.ID_EMPRESA,
            S.CODIGO_ALFA,
            S.CODIGO,
            S.CODIGO_EAN,
            S.RUBRO_ERP,

            /*
              ALTAS ya es multiempresa.
              Recuperamos el tipo del detalle exportado solamente
              dentro de la misma empresa. Para históricos que no
              provienen de PRODUCTOS_APP conservamos PAR_SUELTO
              como valor técnico inicial.
            */
            COALESCE(
              D.TIPO_PRODUCTO_DETALLE,
              'PAR_SUELTO'
            )
              AS TIPO_PRODUCTO_NUEVO,

            @MaxId +
              ROW_NUMBER() OVER (
                ORDER BY
                  S.ID_EMPRESA,
                  S.CODIGO_ALFA
              )
              AS ID_PRODUCTO_NUEVO

          FROM dbo.PRODUCTOS_ERP_STAGING S

          OUTER APPLY (
            SELECT TOP 1
              D1.TIPO_PRODUCTO_DETALLE

            FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E1

            INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE D1
                    ON D1.ID_EMPRESA = E1.ID_EMPRESA
                   AND D1.ID_ALTA = E1.ID_ALTA
                   AND D1.CODIGO_ALFA = E1.COD_ALFA

            WHERE
              E1.ID_EMPRESA = S.ID_EMPRESA
              AND E1.COD_ALFA = S.CODIGO_ALFA

            ORDER BY
              D1.ID_DETALLE DESC
          ) D

          WHERE
            S.ID_EMPRESA = @ID_EMPRESA

        ) AS S

        ON
          T.ID_EMPRESA =
            S.ID_EMPRESA

          AND

          T.CODIGO_ALFA =
            S.CODIGO_ALFA


        WHEN MATCHED
             AND (
               ISNULL(
                 CONVERT(
                   VARCHAR(30),
                   T.CODIGO
                 ),
                 ''
               )
               <>
               ISNULL(
                 S.CODIGO,
                 ''
               )

               OR

               ISNULL(
                 CONVERT(
                   VARCHAR(20),
                   T.CODIGO_EAN
                 ),
                 ''
               )
               <>
               ISNULL(
                 S.CODIGO_EAN,
                 ''
               )

               OR

               ISNULL(
                 T.ACTIVO,
                 0
               ) <> 1
             )
        THEN

          UPDATE SET
            T.CODIGO =
              S.CODIGO,

            T.CODIGO_EAN =
              S.CODIGO_EAN,

            T.ACTIVO =
              1


        WHEN NOT MATCHED BY TARGET
        THEN

          INSERT (
            ${columnasInsert}
          )

          VALUES (
            ${valoresInsert}
          )


        WHEN NOT MATCHED BY SOURCE
             AND T.ID_EMPRESA = @ID_EMPRESA
             AND ISNULL(T.ACTIVO, 0) = 1
        THEN

          UPDATE SET
            T.ACTIVO = 0


        OUTPUT
          $action
        INTO
          @Cambios;


        SELECT
          SUM(
            CASE
              WHEN ACCION = 'INSERT'
                THEN 1
              ELSE 0
            END
          )
            AS INSERTADOS,

          SUM(
            CASE
              WHEN ACCION = 'UPDATE'
                THEN 1
              ELSE 0
            END
          )
            AS ACTUALIZADOS

        FROM @Cambios;
      `);


    /*
      CONCILIACION ERP MULTIEMPRESA

      Cada empresa se concilia exclusivamente contra sus propios
      productos y sus propias altas/exportados.
    */
    const conciliacion =
      await new sql.Request(
        transaction
      )
      .input(
        'ID_EMPRESA_CONCILIACION',
        sql.Int,
        empresa.ID_EMPRESA
      )
      .query(`
        DECLARE @Confirmados TABLE (
          ID_ALTA BIGINT,
          ID_EMPRESA INT,
          COD_ALFA VARCHAR(30)
        );


        UPDATE E
           SET
               E.CODIGO_ERP =
                 CONVERT(
                   VARCHAR(30),
                   P.CODIGO
                 ),

               E.EAN_ERP =
                 CONVERT(
                   VARCHAR(20),
                   P.CODIGO_EAN
                 ),

               E.ESTADO_ERP =
                 'GENERADO_OK_EN_ERP',

               E.FECHA_CONFIRMACION_ERP =
                 COALESCE(
                   E.FECHA_CONFIRMACION_ERP,
                   SYSDATETIME()
                 )

        OUTPUT
          INSERTED.ID_ALTA,
          INSERTED.ID_EMPRESA,
          INSERTED.COD_ALFA
        INTO
          @Confirmados

        FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E

        INNER JOIN dbo.PRODUCTOS P
                ON P.ID_EMPRESA = E.ID_EMPRESA
               AND P.CODIGO_ALFA = E.COD_ALFA
               AND ISNULL(P.ACTIVO, 1) = 1

        WHERE
          E.ID_EMPRESA = @ID_EMPRESA_CONCILIACION
          AND ISNULL(
                E.ESTADO_ERP,
                'PENDIENTE_ERP'
              ) <> 'GENERADO_OK_EN_ERP';


        UPDATE A
           SET
               A.ESTADO =
                 CASE
                   WHEN
                     X.TOTAL_EXPORTADOS > 0
                     AND X.PENDIENTES = 0
                       THEN 'GENERADO_OK_EN_ERP'

                   WHEN
                     X.CONFIRMADOS > 0
                       THEN 'PARCIAL_ERP'

                   ELSE A.ESTADO
                 END

        FROM dbo.ALTAS_PRODUCTOS A

        CROSS APPLY (
          SELECT
            COUNT(*) AS TOTAL_EXPORTADOS,

            SUM(
              CASE
                WHEN E.ESTADO_ERP =
                     'GENERADO_OK_EN_ERP'
                  THEN 1
                ELSE 0
              END
            ) AS CONFIRMADOS,

            SUM(
              CASE
                WHEN ISNULL(
                       E.ESTADO_ERP,
                       'PENDIENTE_ERP'
                     ) <> 'GENERADO_OK_EN_ERP'
                  THEN 1
                ELSE 0
              END
            ) AS PENDIENTES

          FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E

          WHERE
            E.ID_EMPRESA = A.ID_EMPRESA
            AND E.ID_ALTA = A.ID_ALTA
        ) X

        WHERE
          A.ID_EMPRESA = @ID_EMPRESA_CONCILIACION
          AND A.ESTADO IN (
            'EXPORTADO',
            'PARCIAL_ERP',
            'GENERADO_OK_EN_ERP'
          )
          AND X.TOTAL_EXPORTADOS > 0;


        SELECT
          (
            SELECT COUNT(*)
            FROM @Confirmados
          ) AS CONFIRMADOS_EN_ESTA_SYNC,

          (
            SELECT COUNT(*)
            FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS
            WHERE ID_EMPRESA = @ID_EMPRESA_CONCILIACION
              AND ESTADO_ERP = 'GENERADO_OK_EN_ERP'
          ) AS CONFIRMADOS_TOTAL,

          (
            SELECT COUNT(*)
            FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS
            WHERE ID_EMPRESA = @ID_EMPRESA_CONCILIACION
              AND ISNULL(
                    ESTADO_ERP,
                    'PENDIENTE_ERP'
                  ) <> 'GENERADO_OK_EN_ERP'
          ) AS PENDIENTES_TOTAL;
      `);


    const conc =
      conciliacion.recordset[0] || {
        CONFIRMADOS_EN_ESTA_SYNC: 0,
        CONFIRMADOS_TOTAL: 0,
        PENDIENTES_TOTAL: 0
      };


    await transaction.commit();


    const cambios =
      merge.recordset[0] || {};


    return {
      idEmpresa:
        empresa.ID_EMPRESA,

      codigoEmpresa:
        String(
          empresa.CODIGO_EMPRESA
        ),

      empresa:
        empresa.RAZON_SOCIAL,

      archivo:
        empresa.FTP_ARCHIVO_PRODUCTOS,

      hash,

      registrosLeidos:
        registros.length,

      lineasInvalidas:
        invalidas,

      codigosDuplicadosEnArchivo:
        duplicadas,

      idProductoEsIdentity:
        estructura.idProductoEsIdentity,

      insertados:
        Number(
          cambios.INSERTADOS || 0
        ),

      actualizados:
        Number(
          cambios.ACTUALIZADOS || 0
        ),

      confirmadosEnEstaSync:
        Number(
          conc.CONFIRMADOS_EN_ESTA_SYNC || 0
        ),

      confirmadosTotal:
        Number(
          conc.CONFIRMADOS_TOTAL || 0
        ),

      pendientesTotal:
        Number(
          conc.PENDIENTES_TOTAL || 0
        )
    };


  } catch (error) {

    try {
      await transaction.rollback();
    } catch (_) {}

    throw error;
  }
}


/* ============================================================
   SINCRONIZACIÓN MULTIEMPRESA
   ============================================================ */

async function sincronizarProductosErp(codigoEmpresa = null) {

  const pool =
    await getConnection();


  const estructura =
    await asegurarEstructura(
      pool
    );


  const empresasActivas =
    await obtenerEmpresasProductos();

  const codigoEmpresaNormalizado =
    codigoEmpresa == null
      ? ''
      : texto(codigoEmpresa);

  const empresas =
    codigoEmpresaNormalizado
      ? empresasActivas.filter(
          empresa =>
            texto(empresa.CODIGO_EMPRESA) === codigoEmpresaNormalizado
        )
      : empresasActivas;


  if (
    !empresas.length
  ) {

    throw new Error(
      codigoEmpresaNormalizado
        ? `No existe una empresa activa con archivo ERP configurado ` +
          `para el código ${codigoEmpresaNormalizado}.`
        : 'No existen empresas activas con archivo ERP de productos configurado.'
    );
  }


  const resultados = [];


  for (
    const empresa
    of empresas
  ) {

    console.log(
      `[PRODUCTOS ERP] Sincronizando ` +
      `${empresa.RAZON_SOCIAL} ` +
      `(${empresa.CODIGO_EMPRESA})...`
    );


    try {

      const resultado =
        await sincronizarEmpresa(
          empresa,
          estructura,
          pool
        );


      resultados.push({
        ok: true,
        ...resultado
      });


    } catch (error) {

      resultados.push({
        ok: false,

        idEmpresa:
          empresa.ID_EMPRESA,

        codigoEmpresa:
          String(
            empresa.CODIGO_EMPRESA
          ),

        empresa:
          empresa.RAZON_SOCIAL,

        archivo:
          empresa.FTP_ARCHIVO_PRODUCTOS,

        error:
          error.message
      });


      console.error(
        `[PRODUCTOS ERP] ${empresa.RAZON_SOCIAL} falló:`,
        error.message
      );
    }
  }


  const errores =
    resultados.filter(
      x => !x.ok
    );


  if (
    errores.length > 0
  ) {

    const detalle =
      errores
        .map(
          e =>
            `${e.empresa}: ${e.error}`
        )
        .join(' | ');


    throw new Error(
      `Falló la sincronización de ` +
      `${errores.length} empresa(s). ${detalle}`
    );
  }


  const total = campo =>
    resultados.reduce(
      (acum, r) =>
        acum +
        Number(
          r[campo] || 0
        ),
      0
    );


  return {
    ok: true,

    empresas:
      resultados,

    registrosLeidos:
      total(
        'registrosLeidos'
      ),

    lineasInvalidas:
      total(
        'lineasInvalidas'
      ),

    codigosDuplicadosEnArchivo:
      total(
        'codigosDuplicadosEnArchivo'
      ),

    insertados:
      total(
        'insertados'
      ),

    actualizados:
      total(
        'actualizados'
      ),

    confirmadosEnEstaSync:
      total(
        'confirmadosEnEstaSync'
      ),

    confirmadosTotal:
      total(
        'confirmadosTotal'
      ),

    pendientesTotal:
      total(
        'pendientesTotal'
      )
  };
}


/*
  Se mantiene resolverArchivo exportado solamente por compatibilidad
  con código que pudiera importarlo. El nuevo flujo no lo utiliza.
*/
function resolverArchivo() {

  if (
    process.env.PRODUCTOS_ERP_FILE
  ) {

    return path.resolve(
      process.env.PRODUCTOS_ERP_FILE
    );
  }


  if (
    !process.env.MAESTROS_PATH
  ) {

    throw new Error(
      'Falta PRODUCTOS_ERP_FILE o MAESTROS_PATH en .env.'
    );
  }


  return path.join(
    process.env.MAESTROS_PATH,
    'TBL_MAESTRO_PRODS_ATOMIK.TXT'
  );
}


module.exports = {
  sincronizarProductosErp,
  resolverArchivo
};
