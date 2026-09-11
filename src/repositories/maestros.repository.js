const {
  getConnection,
  sql
} = require('../config/database');


async function obtenerMaestroSimple({
  tabla,
  columnas,
  orden,
  idEmpresa
}) {

  const pool =
    await getConnection();

  const resultado =
    await pool
      .request()
      .input(
        'ID_EMPRESA',
        sql.Int,
        idEmpresa
      )
      .query(`
        SELECT
          ${columnas.join(', ')}
        FROM dbo.${tabla}
        WHERE ACTIVO = 1
          AND ID_EMPRESA = @ID_EMPRESA
        ORDER BY ${orden};
      `);

  return resultado.recordset;
}


/* ============================================================
   PROVEEDORES
   ============================================================ */

async function buscarProveedores({
  rubro = null,
  idEmpresa,
  codigoMarca = null
} = {}) {

  /*
    MAESTRO_PROVEEDORES es un maestro global.

    Se conservan idEmpresa y codigoMarca en la firma por compatibilidad
    con services/routes existentes, pero NO intervienen en la selección.

    Regla de elegibilidad:
    - proveedor activo

    El rubro se conserva en la firma por compatibilidad, pero no limita
    el selector: un proveedor puede trabajar con más de un rubro aunque
    el maestro tenga uno solo informado.
  */

  void rubro;
  void idEmpresa;
  void codigoMarca;

  const pool = await getConnection();

  const resultado =
    await pool.request().query(`
      SELECT
        P.CODIGO,
        P.PRESEA,
        P.RUBRO,
        P.NVA_RAZON_SOCIAL
      FROM dbo.MAESTRO_PROVEEDORES P
      WHERE P.ACTIVO = 1
      ORDER BY
        P.NVA_RAZON_SOCIAL,
        P.CODIGO;
    `);

  return resultado.recordset;
}


/* ============================================================
   MODELOS
   ============================================================ */

async function buscarModelos({
  marca,
  rubro,
  texto,
  licencia,
  idEmpresa,
  sinLimite = false
}) {

  const pool =
    await getConnection();

  const request =
    pool.request()
      .input(
        'ID_EMPRESA',
        sql.Int,
        idEmpresa
      );

  let where = `
    WHERE ACTIVO = 1
      AND ID_EMPRESA = @ID_EMPRESA
  `;

  if (marca) {

    request.input(
      'MARCA',
      sql.VarChar(30),
      marca
    );

    where += `
      AND MARCA_MODELO = @MARCA
    `;
  }

  if (rubro) {

    request.input(
      'RUBRO',
      sql.VarChar(20),
      rubro
    );

    where += `
      AND RUBRO_MODELO = @RUBRO
    `;
  }

  if (licencia) {

    if (licencia === '__SIN_LICENCIA__') {

      where += `
        AND
        (
          LICENCIA IS NULL
          OR LTRIM(RTRIM(LICENCIA)) = ''
        )
      `;

    } else {

      request.input(
        'LICENCIA',
        sql.VarChar(100),
        licencia
      );

      where += `
        AND LTRIM(RTRIM(LICENCIA)) = @LICENCIA
      `;
    }
  }

  if (texto) {

    request.input(
      'TEXTO',
      sql.VarChar(100),
      `%${texto}%`
    );

    where += `
      AND
      (
        CODIGO_MODELO LIKE @TEXTO
        OR DETALLE_MODELO LIKE @TEXTO
        OR LICENCIA LIKE @TEXTO
      )
    `;
  }

  const resultado =
    await request.query(`
      SELECT ${sinLimite ? '' : 'TOP 200'}
        M.CODIGO_MODELO,
        M.RUBRO_MODELO,
        M.DETALLE_MODELO,
        COALESCE(
          NULLIF(LTRIM(RTRIM(M.C_PROVEEDO)), ''),
          AM.C_PROVEEDO
        ) AS C_PROVEEDO,
        M.LICENCIA,
        M.MARCA_MODELO
      FROM dbo.MAESTRO_MODELOS AS M
      OUTER APPLY (
        SELECT TOP 1
          NULLIF(LTRIM(RTRIM(A.C_PROVEEDO)), '') AS C_PROVEEDO
        FROM dbo.ALTAS_MAESTROS AS A
        WHERE A.ID_EMPRESA = M.ID_EMPRESA
          AND A.TIPO = 'MODELO'
          AND A.CODIGO = M.CODIGO_MODELO
          AND A.ESTADO <> 'ANULADO'
          AND NULLIF(LTRIM(RTRIM(A.C_PROVEEDO)), '') IS NOT NULL
        ORDER BY
          CASE A.ESTADO
            WHEN 'CONFIRMADO_ERP' THEN 0
            WHEN 'ENVIADO_PRESEA' THEN 1
            ELSE 2
          END,
          A.ID_ALTA_MAESTRO DESC
      ) AS AM
      ${where}
      ORDER BY
        DETALLE_MODELO,
        CODIGO_MODELO;
    `);

  return resultado.recordset;
}


/* ============================================================
   LICENCIAS DE MODELOS
   ============================================================ */

async function buscarLicenciasModelos({
  marca,
  rubro,
  idEmpresa
}) {

  const pool =
    await getConnection();

  const request =
    pool.request()
      .input(
        'ID_EMPRESA',
        sql.Int,
        idEmpresa
      );

  let where = `
    WHERE ACTIVO = 1
      AND ID_EMPRESA = @ID_EMPRESA
  `;

  if (marca) {

    request.input(
      'MARCA',
      sql.VarChar(30),
      marca
    );

    where += `
      AND MARCA_MODELO = @MARCA
    `;
  }

  if (rubro) {

    request.input(
      'RUBRO',
      sql.VarChar(20),
      rubro
    );

    where += `
      AND RUBRO_MODELO = @RUBRO
    `;
  }

  const resultado =
    await request.query(`
      SELECT
        CODIGO_LICENCIA,
        DETALLE_LICENCIA
      FROM
      (
        SELECT DISTINCT
          LTRIM(RTRIM(LICENCIA))
            AS CODIGO_LICENCIA,
          LTRIM(RTRIM(LICENCIA))
            AS DETALLE_LICENCIA
        FROM dbo.MAESTRO_MODELOS
        ${where}
        AND NULLIF(
          LTRIM(RTRIM(LICENCIA)),
          ''
        ) IS NOT NULL

        UNION ALL

        SELECT
          '__SIN_LICENCIA__'
            AS CODIGO_LICENCIA,
          'Sin licencia'
            AS DETALLE_LICENCIA
        WHERE EXISTS
        (
          SELECT 1
          FROM dbo.MAESTRO_MODELOS
          ${where}
          AND
          (
            LICENCIA IS NULL
            OR LTRIM(RTRIM(LICENCIA)) = ''
          )
        )
      ) AS L
      ORDER BY
        CASE
          WHEN CODIGO_LICENCIA =
               '__SIN_LICENCIA__'
          THEN 0
          ELSE 1
        END,
        DETALLE_LICENCIA;
    `);

  return resultado.recordset;
}


/* ============================================================
   TALLES MODULOS
   ============================================================ */

async function obtenerTallesModulos(idEmpresa) {

  const pool =
    await getConnection();

  const resultado =
    await pool
      .request()
      .input(
        'ID_EMPRESA',
        sql.Int,
        idEmpresa
      )
      .query(`
        SELECT *
        FROM dbo.MAESTRO_TALLES_MODULOS
        WHERE
          ACTIVO = 1
          AND ES_CONSISTENTE = 1
          AND ID_EMPRESA = @ID_EMPRESA
        ORDER BY CODIGO_MODULO;
      `);

  return resultado.recordset;
}

async function obtenerTallesModulosConsulta(idEmpresa) {
  const pool = await getConnection();
  const resultado = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    SELECT *
    FROM dbo.MAESTRO_TALLES_MODULOS
    WHERE ID_EMPRESA = @ID_EMPRESA AND ACTIVO = 1
    ORDER BY CODIGO_MODULO;
  `);
  return resultado.recordset;
}

async function consultarProductos(idEmpresa) {
  const pool = await getConnection();
  const resultado = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    WITH DETALLE_PRODUCTO AS
    (
      SELECT D.*,
        ROW_NUMBER() OVER (
          PARTITION BY D.ID_EMPRESA, D.CODIGO_ALFA
          ORDER BY D.ID_DETALLE DESC
        ) AS ORDEN_PRODUCTO
      FROM dbo.ALTAS_PRODUCTOS_DETALLE D
      WHERE D.ID_EMPRESA = @ID_EMPRESA
    )
    SELECT
      P.CODIGO_ALFA,
      CONVERT(VARCHAR(30), P.CODIGO_ERP) AS CODIGO_ERP,
      COALESCE(CONVERT(VARCHAR(20), P.CODIGO_EAN), CONVERT(VARCHAR(20), P.EAN)) AS CODIGO_EAN,
      COALESCE(D.TIPO_PRODUCTO_DETALLE, A.TIPO_PRODUCTO, P.TIPO_PRODUCTO) AS TIPO_PRODUCTO,
      P.TIPO_PRODUCTO AS TIPO_PRODUCTO_DETALLE,
      D.GENERADO_AUTOMATICO,
      P.FECHA_CARGA,
      P.FECHA_ACTUALIZACION,
      P.FECHA_ULTIMA_SYNC,
      D.DETALLE_PRODUCTO,
      D.CODIGO_MODELO,
      D.DETALLE_MODELO,
      D.CODIGO_COLOR,
      D.DETALLE_COLOR,
      COALESCE(NULLIF(D.DETALLE_MODULO, ''), NULLIF(D.DETALLE_TALLE, '')) AS TALLE_MODULO,
      D.LICENCIA,
      A.CODIGO_MARCA,
      A.DETALLE_MARCA,
      COALESCE(A.CODIGO_RUBRO, P.RUBRO) AS CODIGO_RUBRO,
      COALESCE(A.DETALLE_RUBRO, P.RUBRO) AS DETALLE_RUBRO,
      A.ID_ALTA,
      A.CODIGO_ALTA,
      A.CODIGO_ANO,
      A.CODIGO_TEMPORADA,
      A.ESTADO AS ESTADO_ALTA
    FROM dbo.PRODUCTOS P
    LEFT JOIN DETALLE_PRODUCTO D
      ON D.ID_EMPRESA = P.ID_EMPRESA
     AND D.CODIGO_ALFA = P.CODIGO_ALFA
     AND D.ORDEN_PRODUCTO = 1
    LEFT JOIN dbo.ALTAS_PRODUCTOS A
      ON A.ID_EMPRESA = D.ID_EMPRESA
     AND A.ID_ALTA = D.ID_ALTA
    WHERE P.ID_EMPRESA = @ID_EMPRESA
      AND ISNULL(P.ACTIVO, 1) = 1
    ORDER BY D.DETALLE_MODELO, D.DETALLE_COLOR, P.CODIGO_ALFA;
  `);
  return resultado.recordset;
}


module.exports = {
  obtenerMaestroSimple,
  buscarProveedores,
  buscarModelos,
  buscarLicenciasModelos,
  obtenerTallesModulos,
  obtenerTallesModulosConsulta,
  consultarProductos
};
