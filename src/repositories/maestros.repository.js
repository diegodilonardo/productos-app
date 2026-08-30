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
    - rubro del proveedor = rubro del Alta, cuando se informa rubro
  */

  const pool =
    await getConnection();

  const request =
    pool.request()
      .input(
        'RUBRO',
        sql.VarChar(100),
        rubro
      );

  const resultado =
    await request.query(`
      SELECT
        P.CODIGO,
        P.PRESEA,
        P.RUBRO,
        P.NVA_RAZON_SOCIAL
      FROM dbo.MAESTRO_PROVEEDORES P
      WHERE
        P.ACTIVO = 1
        AND
        (
          @RUBRO IS NULL
          OR UPPER(
               LTRIM(
                 RTRIM(
                   ISNULL(P.RUBRO, '')
                 )
               )
             ) =
             UPPER(
               LTRIM(
                 RTRIM(@RUBRO)
               )
             )
        )
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
      SELECT TOP 200
        CODIGO_MODELO,
        RUBRO_MODELO,
        DETALLE_MODELO,
        LICENCIA,
        MARCA_MODELO
      FROM dbo.MAESTRO_MODELOS
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


module.exports = {
  obtenerMaestroSimple,
  buscarProveedores,
  buscarModelos,
  buscarLicenciasModelos,
  obtenerTallesModulos
};
