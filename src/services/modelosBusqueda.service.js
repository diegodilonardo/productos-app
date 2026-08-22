const {
  getConnection,
  sql
} = require('../config/database');


function limpiarTexto(valor) {
  return String(valor ?? '').trim();
}


async function buscarModelosPorAlta(
  idAlta,
  textoBusqueda = '',
  limite = 60
) {
  const id = Number(idAlta);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_ALTA inválido.');
  }

  const buscar =
    limpiarTexto(textoBusqueda);

  const top =
    Math.max(
      1,
      Math.min(
        Number(limite) || 60,
        100
      )
    );

  const pool =
    await getConnection();

  const resultado =
    await pool
      .request()
      .input(
        'ID_ALTA',
        sql.BigInt,
        id
      )
      .input(
        'BUSCAR',
        sql.NVarChar(100),
        buscar
      )
      .input(
        'LIMITE',
        sql.Int,
        top
      )
      .query(`
        SELECT TOP (@LIMITE)
          M.CODIGO_MODELO,
          M.RUBRO_MODELO,
          M.DETALLE_MODELO,
          M.LICENCIA,
          M.MARCA_MODELO

        FROM dbo.MAESTRO_MODELOS AS M

        INNER JOIN dbo.ALTAS_PRODUCTOS AS A
          ON A.ID_ALTA = @ID_ALTA

        WHERE
          M.ACTIVO = 1

          AND UPPER(LTRIM(RTRIM(ISNULL(M.MARCA_MODELO, ''))))
              =
              UPPER(LTRIM(RTRIM(ISNULL(A.DETALLE_MARCA, ''))))

          AND UPPER(LTRIM(RTRIM(ISNULL(M.RUBRO_MODELO, ''))))
              =
              UPPER(LTRIM(RTRIM(ISNULL(A.DETALLE_RUBRO, ''))))

          AND
          (
            @BUSCAR = ''
            OR M.CODIGO_MODELO LIKE '%' + @BUSCAR + '%'
            OR M.DETALLE_MODELO LIKE '%' + @BUSCAR + '%'
            OR ISNULL(M.LICENCIA, '') LIKE '%' + @BUSCAR + '%'
          )

        ORDER BY
          M.DETALLE_MODELO ASC,
          M.CODIGO_MODELO ASC;
      `);

  return {
    criterio: buscar,
    cantidad: resultado.recordset.length,
    datos: resultado.recordset
  };
}


module.exports = {
  buscarModelosPorAlta
};
