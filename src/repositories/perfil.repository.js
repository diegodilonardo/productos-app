const { getConnection, sql } = require('../config/database');

async function obtenerPerfil(idUsuario) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1
        ID_USUARIO, USUARIO, NOMBRE, EMAIL, EMAIL_PENDIENTE,
        EMAIL_VERIFICADO, EMAIL_VERIFICADO_EN, ACTIVO, FECHA_ULTIMO_LOGIN
      FROM dbo.USUARIOS
      WHERE ID_USUARIO = @ID_USUARIO;
    `);
  return resultado.recordset[0] || null;
}

async function actualizarNombre(idUsuario, nombre) {
  const pool = await getConnection();
  await pool.request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .input('NOMBRE', sql.VarChar(150), nombre)
    .query(`
      UPDATE dbo.USUARIOS
      SET NOMBRE = @NOMBRE
      WHERE ID_USUARIO = @ID_USUARIO;
    `);
}

async function emailEnUso(email, idUsuario) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('EMAIL', sql.VarChar(200), email)
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1 ID_USUARIO
      FROM dbo.USUARIOS
      WHERE ID_USUARIO <> @ID_USUARIO
        AND (
          UPPER(LTRIM(RTRIM(ISNULL(EMAIL, '')))) = UPPER(LTRIM(RTRIM(@EMAIL)))
          OR UPPER(LTRIM(RTRIM(ISNULL(EMAIL_PENDIENTE, '')))) = UPPER(LTRIM(RTRIM(@EMAIL)))
        );
    `);
  return Boolean(resultado.recordset[0]);
}

async function crearSolicitudEmail({ idUsuario, emailNuevo, tokenHash, minutosValidez, ip, userAgent }) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .query(`
        UPDATE dbo.EMAIL_VERIFICATION_TOKENS
        SET FECHA_USO = COALESCE(FECHA_USO, SYSDATETIME())
        WHERE ID_USUARIO = @ID_USUARIO
          AND FECHA_USO IS NULL;
      `);

    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .input('EMAIL_NUEVO', sql.VarChar(200), emailNuevo)
      .input('TOKEN_HASH', sql.Char(64), tokenHash)
      .input('MINUTOS', sql.Int, minutosValidez)
      .input('IP_SOLICITUD', sql.VarChar(64), String(ip || '').slice(0, 64))
      .input('USER_AGENT', sql.NVarChar(500), String(userAgent || '').slice(0, 500))
      .query(`
        UPDATE dbo.USUARIOS
        SET EMAIL_PENDIENTE = @EMAIL_NUEVO
        WHERE ID_USUARIO = @ID_USUARIO;

        INSERT INTO dbo.EMAIL_VERIFICATION_TOKENS
        (ID_USUARIO, EMAIL_NUEVO, TOKEN_HASH, FECHA_CREACION, FECHA_VENCIMIENTO, FECHA_USO, IP_SOLICITUD, USER_AGENT)
        VALUES
        (@ID_USUARIO, @EMAIL_NUEVO, @TOKEN_HASH, SYSDATETIME(), DATEADD(MINUTE, @MINUTOS, SYSDATETIME()), NULL, @IP_SOLICITUD, @USER_AGENT);
      `);

    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

async function confirmarEmail({ tokenHash }) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const resultado = await new sql.Request(transaction)
      .input('TOKEN_HASH', sql.Char(64), tokenHash)
      .query(`
        SELECT TOP 1
          T.ID_TOKEN, T.ID_USUARIO, T.EMAIL_NUEVO, T.FECHA_USO,
          CASE WHEN T.FECHA_VENCIMIENTO >= SYSDATETIME() THEN 1 ELSE 0 END AS VIGENTE,
          U.ACTIVO, U.EMAIL_PENDIENTE
        FROM dbo.EMAIL_VERIFICATION_TOKENS T WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.USUARIOS U WITH (UPDLOCK, HOLDLOCK)
          ON U.ID_USUARIO = T.ID_USUARIO
        WHERE T.TOKEN_HASH = @TOKEN_HASH;
      `);

    const token = resultado.recordset[0];
    const coincidePendiente = token &&
      String(token.EMAIL_NUEVO || '').trim().toUpperCase() ===
      String(token.EMAIL_PENDIENTE || '').trim().toUpperCase();

    if (!token || token.FECHA_USO || !Boolean(token.ACTIVO) || !Boolean(token.VIGENTE) || !coincidePendiente) {
      const error = new Error('El enlace de verificación es inválido, ya fue utilizado o venció.');
      error.status = 400;
      throw error;
    }

    const duplicado = await new sql.Request(transaction)
      .input('EMAIL', sql.VarChar(200), token.EMAIL_NUEVO)
      .input('ID_USUARIO', sql.Int, token.ID_USUARIO)
      .query(`
        SELECT TOP 1 ID_USUARIO
        FROM dbo.USUARIOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_USUARIO <> @ID_USUARIO
          AND UPPER(LTRIM(RTRIM(ISNULL(EMAIL, '')))) = UPPER(LTRIM(RTRIM(@EMAIL)));
      `);

    if (duplicado.recordset[0]) {
      const error = new Error('Ese email ya está asociado a otro usuario.');
      error.status = 409;
      throw error;
    }

    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, token.ID_USUARIO)
      .input('EMAIL', sql.VarChar(200), token.EMAIL_NUEVO)
      .query(`
        UPDATE dbo.USUARIOS
        SET EMAIL = @EMAIL,
            EMAIL_PENDIENTE = NULL,
            EMAIL_VERIFICADO = 1,
            EMAIL_VERIFICADO_EN = SYSDATETIME(),
            SESION_VERSION = ISNULL(SESION_VERSION, 1) + 1
        WHERE ID_USUARIO = @ID_USUARIO;
      `);

    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, token.ID_USUARIO)
      .query(`
        UPDATE dbo.EMAIL_VERIFICATION_TOKENS
        SET FECHA_USO = COALESCE(FECHA_USO, SYSDATETIME())
        WHERE ID_USUARIO = @ID_USUARIO
          AND FECHA_USO IS NULL;
      `);

    await transaction.commit();
    return { idUsuario: token.ID_USUARIO, email: token.EMAIL_NUEVO };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

module.exports = {
  obtenerPerfil,
  actualizarNombre,
  emailEnUso,
  crearSolicitudEmail,
  confirmarEmail
};
