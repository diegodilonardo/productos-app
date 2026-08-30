const { getConnection, sql } = require('../config/database');

async function buscarUsuarioPorIdentificador(identificador) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('IDENTIFICADOR', sql.VarChar(200), String(identificador || '').trim())
    .query(`
      SELECT TOP 1
        ID_USUARIO, USUARIO, NOMBRE, EMAIL, ACTIVO, EMAIL_VERIFICADO
      FROM dbo.USUARIOS
      WHERE ACTIVO = 1
        AND ISNULL(EMAIL_VERIFICADO, 0) = 1
        AND (
          UPPER(LTRIM(RTRIM(USUARIO))) = UPPER(LTRIM(RTRIM(@IDENTIFICADOR)))
          OR UPPER(LTRIM(RTRIM(ISNULL(EMAIL, '')))) = UPPER(LTRIM(RTRIM(@IDENTIFICADOR)))
        );
    `);
  return resultado.recordset[0] || null;
}

async function crearToken({ idUsuario, tokenHash, minutosValidez, ip, userAgent }) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .query(`
        UPDATE dbo.PASSWORD_RESET_TOKENS
        SET FECHA_USO = COALESCE(FECHA_USO, SYSDATETIME())
        WHERE ID_USUARIO = @ID_USUARIO
          AND FECHA_USO IS NULL;
      `);

    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .input('TOKEN_HASH', sql.Char(64), tokenHash)
      .input('MINUTOS', sql.Int, minutosValidez)
      .input('IP_SOLICITUD', sql.VarChar(64), String(ip || '').slice(0, 64))
      .input('USER_AGENT', sql.NVarChar(500), String(userAgent || '').slice(0, 500))
      .query(`
        INSERT INTO dbo.PASSWORD_RESET_TOKENS
        (ID_USUARIO, TOKEN_HASH, FECHA_CREACION, FECHA_VENCIMIENTO, FECHA_USO, IP_SOLICITUD, USER_AGENT)
        VALUES
        (@ID_USUARIO, @TOKEN_HASH, SYSDATETIME(), DATEADD(MINUTE, @MINUTOS, SYSDATETIME()), NULL, @IP_SOLICITUD, @USER_AGENT);
      `);

    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

async function restablecerPasswordConToken({ tokenHash, passwordHash }) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const resultado = await new sql.Request(transaction)
      .input('TOKEN_HASH', sql.Char(64), tokenHash)
      .query(`
        SELECT TOP 1
          T.ID_TOKEN,
          T.ID_USUARIO,
          T.FECHA_VENCIMIENTO,
          T.FECHA_USO,
          U.ACTIVO,
          CASE WHEN T.FECHA_VENCIMIENTO >= SYSDATETIME() THEN 1 ELSE 0 END AS VIGENTE
        FROM dbo.PASSWORD_RESET_TOKENS T WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.USUARIOS U WITH (UPDLOCK, HOLDLOCK)
          ON U.ID_USUARIO = T.ID_USUARIO
        WHERE T.TOKEN_HASH = @TOKEN_HASH;
      `);

    const token = resultado.recordset[0];
    if (!token || token.FECHA_USO || !Boolean(token.ACTIVO) || !Boolean(token.VIGENTE)) {
      const error = new Error('El enlace de recuperación es inválido, ya fue utilizado o venció.');
      error.status = 400;
      throw error;
    }

    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, token.ID_USUARIO)
      .input('PASSWORD_HASH', sql.VarChar(255), passwordHash)
      .query(`
        UPDATE dbo.USUARIOS
        SET PASSWORD_HASH = @PASSWORD_HASH,
            PASSWORD_CAMBIADA_EN = SYSDATETIME(),
            DEBE_CAMBIAR_PASSWORD = 0,
            SESION_VERSION = ISNULL(SESION_VERSION, 1) + 1
        WHERE ID_USUARIO = @ID_USUARIO;
      `);

    await new sql.Request(transaction)
      .input('ID_TOKEN', sql.BigInt, token.ID_TOKEN)
      .input('ID_USUARIO', sql.Int, token.ID_USUARIO)
      .query(`
        UPDATE dbo.PASSWORD_RESET_TOKENS
        SET FECHA_USO = SYSDATETIME()
        WHERE ID_TOKEN = @ID_TOKEN
          AND FECHA_USO IS NULL;

        UPDATE dbo.PASSWORD_RESET_TOKENS
        SET FECHA_USO = COALESCE(FECHA_USO, SYSDATETIME())
        WHERE ID_USUARIO = @ID_USUARIO
          AND FECHA_USO IS NULL;
      `);

    await transaction.commit();
    return { idUsuario: token.ID_USUARIO };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

module.exports = {
  buscarUsuarioPorIdentificador,
  crearToken,
  restablecerPasswordConToken
};
