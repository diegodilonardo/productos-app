const {
  getConnection,
  sql
} = require('../config/database');


async function buscarUsuarioPorNombre(usuario) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input(
      'USUARIO',
      sql.VarChar(100),
      String(usuario || '').trim()
    )
    .query(`
      SELECT TOP 1
        ID_USUARIO,
        USUARIO,
        NOMBRE,
        EMAIL,
        PASSWORD_HASH,
        ACTIVO,
        DEBE_CAMBIAR_PASSWORD,
        PASSWORD_CAMBIADA_EN,
        SESION_VERSION,
        FECHA_ULTIMO_LOGIN
      FROM dbo.USUARIOS
      WHERE UPPER(LTRIM(RTRIM(USUARIO))) =
            UPPER(LTRIM(RTRIM(@USUARIO)));
    `);

  return resultado.recordset[0] || null;
}


async function actualizarUltimoLogin(idUsuario) {

  const pool = await getConnection();

  await pool
    .request()
    .input(
      'ID_USUARIO',
      sql.Int,
      idUsuario
    )
    .query(`
      UPDATE dbo.USUARIOS
      SET FECHA_ULTIMO_LOGIN = SYSDATETIME()
      WHERE ID_USUARIO = @ID_USUARIO;
    `);
}


async function obtenerRolesGlobales(idUsuario) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input(
      'ID_USUARIO',
      sql.Int,
      idUsuario
    )
    .query(`
      SELECT
        R.CODIGO_ROL,
        R.DETALLE_ROL
      FROM dbo.USUARIOS_ROLES_GLOBALES UG
      INNER JOIN dbo.ROLES R
              ON R.ID_ROL = UG.ID_ROL
      WHERE UG.ID_USUARIO = @ID_USUARIO
        AND UG.ACTIVO = 1
        AND R.ACTIVO = 1
      ORDER BY R.CODIGO_ROL;
    `);

  return resultado.recordset;
}


async function obtenerAccesosEmpresa(idUsuario) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input(
      'ID_USUARIO',
      sql.Int,
      idUsuario
    )
    .query(`
      SELECT
        UA.ID_ACCESO,
        UA.ID_EMPRESA,
        E.CODIGO_EMPRESA,
        E.RAZON_SOCIAL,
        R.CODIGO_ROL,
        R.DETALLE_ROL,
        UA.TODAS_MARCAS,
        UA.TODOS_RUBROS,
        UA.TODAS_LICENCIAS
      FROM dbo.USUARIOS_ACCESOS UA
      INNER JOIN dbo.EMPRESAS E
              ON E.ID_EMPRESA = UA.ID_EMPRESA
      INNER JOIN dbo.ROLES R
              ON R.ID_ROL = UA.ID_ROL
      WHERE UA.ID_USUARIO = @ID_USUARIO
        AND UA.ACTIVO = 1
        AND E.ACTIVA = 1
        AND R.ACTIVO = 1
      ORDER BY E.RAZON_SOCIAL, R.CODIGO_ROL;
    `);

  return resultado.recordset;
}


async function obtenerMarcasAcceso(idAcceso) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input(
      'ID_ACCESO',
      sql.Int,
      idAcceso
    )
    .query(`
      SELECT
        EM.ID_EMPRESA_MARCA,
        EM.CODIGO_MARCA,
        MM.DETALLE_MARCA
      FROM dbo.USUARIOS_MARCAS UM
      INNER JOIN dbo.EMPRESAS_MARCAS EM
              ON EM.ID_EMPRESA_MARCA = UM.ID_EMPRESA_MARCA
      LEFT JOIN dbo.MAESTRO_MARCAS MM
             ON MM.ID_EMPRESA = EM.ID_EMPRESA
            AND MM.CODIGO_MARCA = EM.CODIGO_MARCA
            AND MM.ACTIVO = 1
      WHERE UM.ID_ACCESO = @ID_ACCESO
        AND UM.ACTIVO = 1
        AND EM.ACTIVA = 1
      ORDER BY COALESCE(MM.DETALLE_MARCA, EM.CODIGO_MARCA);
    `);

  return resultado.recordset;
}


async function obtenerRubrosAcceso(idAcceso, idEmpresa) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ACCESO', sql.Int, idAcceso)
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .query(`
      SELECT
        UR.CODIGO_RUBRO,
        MR.DETALLE_RUBRO
      FROM dbo.USUARIOS_RUBROS UR
      LEFT JOIN dbo.MAESTRO_RUBROS MR
             ON MR.ID_EMPRESA = @ID_EMPRESA
            AND MR.CODIGO_RUBRO = UR.CODIGO_RUBRO
            AND MR.ACTIVO = 1
      WHERE UR.ID_ACCESO = @ID_ACCESO
        AND UR.ACTIVO = 1
      ORDER BY COALESCE(MR.DETALLE_RUBRO, UR.CODIGO_RUBRO);
    `);

  return resultado.recordset;
}


async function obtenerLicenciasAcceso(idAcceso) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input(
      'ID_ACCESO',
      sql.Int,
      idAcceso
    )
    .query(`
      SELECT
        LICENCIA
      FROM dbo.USUARIOS_LICENCIAS
      WHERE ID_ACCESO = @ID_ACCESO
        AND ACTIVO = 1
      ORDER BY LICENCIA;
    `);

  return resultado.recordset;
}


async function obtenerTodasEmpresas() {

  const pool = await getConnection();

  const resultado = await pool.request().query(`
    SELECT
      ID_EMPRESA,
      CODIGO_EMPRESA,
      RAZON_SOCIAL
    FROM dbo.EMPRESAS
    WHERE ACTIVA = 1
    ORDER BY RAZON_SOCIAL;
  `);

  return resultado.recordset;
}


async function obtenerEstadoSesionUsuario(idUsuario) {

  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1
        ID_USUARIO,
        ACTIVO,
        SESION_VERSION
      FROM dbo.USUARIOS
      WHERE ID_USUARIO = @ID_USUARIO;
    `);

  return resultado.recordset[0] || null;
}


module.exports = {
  buscarUsuarioPorNombre,
  actualizarUltimoLogin,
  obtenerRolesGlobales,
  obtenerAccesosEmpresa,
  obtenerMarcasAcceso,
  obtenerRubrosAcceso,
  obtenerLicenciasAcceso,
  obtenerTodasEmpresas,
  obtenerEstadoSesionUsuario
};
