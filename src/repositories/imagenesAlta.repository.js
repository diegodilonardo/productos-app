const { getConnection, sql } = require('../config/database');

async function listarImagenesAlta(idEmpresa, idAlta) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .input('ID_ALTA', sql.Int, idAlta)
    .query(`
      SELECT
        ID_IMAGEN, ID_EMPRESA, ID_ALTA, CODIGO_MODELO, CODIGO_COLOR,
        NOMBRE_ARCHIVO, NOMBRE_ORIGINAL, EXTENSION, RUTA_RELATIVA,
        USUARIO_CREACION, FECHA_CREACION, USUARIO_ACTUALIZACION, FECHA_ACTUALIZACION
      FROM dbo.ALTAS_PRODUCTOS_IMAGENES
      WHERE ID_EMPRESA = @ID_EMPRESA AND ID_ALTA = @ID_ALTA;
    `);
  return resultado.recordset;
}

async function guardarImagenFamilia(datos) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('ID_EMPRESA', sql.Int, datos.idEmpresa)
    .input('ID_ALTA', sql.Int, datos.idAlta)
    .input('CODIGO_MODELO', sql.VarChar(30), datos.codigoModelo)
    .input('CODIGO_COLOR', sql.VarChar(30), datos.codigoColor)
    .input('NOMBRE_ARCHIVO', sql.VarChar(260), datos.nombreArchivo)
    .input('NOMBRE_ORIGINAL', sql.VarChar(260), datos.nombreOriginal || null)
    .input('EXTENSION', sql.VarChar(10), datos.extension)
    .input('RUTA_RELATIVA', sql.VarChar(1000), datos.rutaRelativa)
    .input('USUARIO', sql.VarChar(100), datos.usuario || 'SISTEMA')
    .query(`
      MERGE dbo.ALTAS_PRODUCTOS_IMAGENES WITH (HOLDLOCK) AS destino
      USING (SELECT @ID_EMPRESA AS ID_EMPRESA, @ID_ALTA AS ID_ALTA,
                    @CODIGO_MODELO AS CODIGO_MODELO, @CODIGO_COLOR AS CODIGO_COLOR) AS origen
      ON destino.ID_EMPRESA = origen.ID_EMPRESA
        AND destino.ID_ALTA = origen.ID_ALTA
        AND destino.CODIGO_MODELO = origen.CODIGO_MODELO
        AND destino.CODIGO_COLOR = origen.CODIGO_COLOR
      WHEN MATCHED THEN UPDATE SET
        NOMBRE_ARCHIVO = @NOMBRE_ARCHIVO,
        NOMBRE_ORIGINAL = COALESCE(@NOMBRE_ORIGINAL, destino.NOMBRE_ORIGINAL),
        EXTENSION = @EXTENSION,
        RUTA_RELATIVA = @RUTA_RELATIVA,
        USUARIO_ACTUALIZACION = @USUARIO,
        FECHA_ACTUALIZACION = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (ID_EMPRESA, ID_ALTA, CODIGO_MODELO, CODIGO_COLOR, NOMBRE_ARCHIVO,
         NOMBRE_ORIGINAL, EXTENSION, RUTA_RELATIVA, USUARIO_CREACION)
      VALUES
        (@ID_EMPRESA, @ID_ALTA, @CODIGO_MODELO, @CODIGO_COLOR, @NOMBRE_ARCHIVO,
         @NOMBRE_ORIGINAL, @EXTENSION, @RUTA_RELATIVA, @USUARIO)
      OUTPUT INSERTED.*;
    `);
  return resultado.recordset[0];
}

module.exports = { listarImagenesAlta, guardarImagenFamilia };
