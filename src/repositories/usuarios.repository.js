const {
  getConnection,
  sql
} = require('../config/database');


async function listarUsuarios() {
  const pool = await getConnection();

  const resultado = await pool.request().query(`
    SELECT
      U.ID_USUARIO,
      U.USUARIO,
      U.NOMBRE,
      U.EMAIL,
      U.ACTIVO,
      U.FECHA_CREACION,
      U.FECHA_ULTIMO_LOGIN,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM dbo.USUARIOS_ROLES_GLOBALES UG
          INNER JOIN dbo.ROLES R
                  ON R.ID_ROL = UG.ID_ROL
          WHERE UG.ID_USUARIO = U.ID_USUARIO
            AND UG.ACTIVO = 1
            AND R.ACTIVO = 1
            AND UPPER(LTRIM(RTRIM(R.CODIGO_ROL))) = 'SUPER_ADMIN'
        ) THEN 1
        ELSE 0
      END AS ES_SUPER_ADMIN,
      (
        SELECT COUNT(*)
        FROM dbo.USUARIOS_ACCESOS UA
        WHERE UA.ID_USUARIO = U.ID_USUARIO
          AND UA.ACTIVO = 1
      ) AS CANTIDAD_ACCESOS
    FROM dbo.USUARIOS U
    ORDER BY
      U.ACTIVO DESC,
      COALESCE(NULLIF(LTRIM(RTRIM(U.NOMBRE)), ''), U.USUARIO),
      U.USUARIO;
  `);

  return resultado.recordset;
}


async function buscarUsuarioPorId(idUsuario) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT TOP 1
        ID_USUARIO,
        USUARIO,
        NOMBRE,
        EMAIL,
        ACTIVO,
        FECHA_CREACION,
        FECHA_ULTIMO_LOGIN
      FROM dbo.USUARIOS
      WHERE ID_USUARIO = @ID_USUARIO;
    `);

  return resultado.recordset[0] || null;
}


async function buscarUsuarioPorNombre(usuario) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input('USUARIO', sql.VarChar(100), String(usuario || '').trim())
    .query(`
      SELECT TOP 1
        ID_USUARIO, USUARIO, NOMBRE, EMAIL, ACTIVO
      FROM dbo.USUARIOS
      WHERE UPPER(LTRIM(RTRIM(USUARIO))) =
            UPPER(LTRIM(RTRIM(@USUARIO)));
    `);

  return resultado.recordset[0] || null;
}


async function crearUsuarioBase({
  usuario,
  nombre,
  email,
  passwordHash
}) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input('USUARIO', sql.VarChar(100), usuario)
    .input('NOMBRE', sql.VarChar(150), nombre)
    .input('EMAIL', sql.VarChar(200), email || null)
    .input('PASSWORD_HASH', sql.VarChar(255), passwordHash)
    .query(`
      INSERT INTO dbo.USUARIOS
      (
        USUARIO, NOMBRE, EMAIL, PASSWORD_HASH,
        ACTIVO, FECHA_CREACION
      )
      OUTPUT INSERTED.ID_USUARIO
      VALUES
      (
        @USUARIO, @NOMBRE, @EMAIL, @PASSWORD_HASH,
        0, SYSDATETIME()
      );
    `);

  return Number(resultado.recordset[0].ID_USUARIO);
}


async function eliminarUsuarioCreado(idUsuario) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .query(`
        DELETE L
        FROM dbo.USUARIOS_LICENCIAS L
        INNER JOIN dbo.USUARIOS_ACCESOS A
          ON A.ID_ACCESO = L.ID_ACCESO
        WHERE A.ID_USUARIO = @ID_USUARIO;

        DELETE R
        FROM dbo.USUARIOS_RUBROS R
        INNER JOIN dbo.USUARIOS_ACCESOS A
          ON A.ID_ACCESO = R.ID_ACCESO
        WHERE A.ID_USUARIO = @ID_USUARIO;

        DELETE M
        FROM dbo.USUARIOS_MARCAS M
        INNER JOIN dbo.USUARIOS_ACCESOS A
          ON A.ID_ACCESO = M.ID_ACCESO
        WHERE A.ID_USUARIO = @ID_USUARIO;

        DELETE FROM dbo.USUARIOS_ACCESOS
        WHERE ID_USUARIO = @ID_USUARIO;

        DELETE FROM dbo.USUARIOS_ROLES_GLOBALES
        WHERE ID_USUARIO = @ID_USUARIO;

        DELETE FROM dbo.USUARIOS
        WHERE ID_USUARIO = @ID_USUARIO
          AND FECHA_ULTIMO_LOGIN IS NULL;
      `);

    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}


async function obtenerRolesGlobales(idUsuario) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT
        R.ID_ROL,
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


async function obtenerAccesos(idUsuario) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .query(`
      SELECT
        UA.ID_ACCESO,
        UA.ID_EMPRESA,
        E.CODIGO_EMPRESA,
        E.RAZON_SOCIAL,
        R.ID_ROL,
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
      ORDER BY E.RAZON_SOCIAL, R.CODIGO_ROL;
    `);

  return resultado.recordset;
}


async function obtenerMarcas(idAcceso) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ACCESO', sql.Int, idAcceso)
    .query(`
      SELECT
        EM.ID_EMPRESA_MARCA,
        EM.CODIGO_MARCA,
        COALESCE(MM.DETALLE_MARCA, EM.CODIGO_MARCA) AS DETALLE_MARCA
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


async function obtenerRubros(idAcceso, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ACCESO', sql.Int, idAcceso)
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .query(`
      SELECT
        UR.CODIGO_RUBRO,
        COALESCE(MR.DETALLE_RUBRO, UR.CODIGO_RUBRO) AS DETALLE_RUBRO
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


async function obtenerLicencias(idAcceso) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ACCESO', sql.Int, idAcceso)
    .query(`
      SELECT LICENCIA
      FROM dbo.USUARIOS_LICENCIAS
      WHERE ID_ACCESO = @ID_ACCESO
        AND ACTIVO = 1
      ORDER BY LICENCIA;
    `);

  return resultado.recordset;
}


async function obtenerCatalogosAdministracion() {
  const pool = await getConnection();

  const [roles, empresas, marcas, rubros, licencias] = await Promise.all([
    pool.request().query(`
      SELECT
        ID_ROL,
        CODIGO_ROL,
        DETALLE_ROL
      FROM dbo.ROLES
      WHERE ACTIVO = 1
        AND UPPER(LTRIM(RTRIM(CODIGO_ROL))) <> 'SUPER_ADMIN'
      ORDER BY CODIGO_ROL;
    `),

    pool.request().query(`
      SELECT
        ID_EMPRESA,
        CODIGO_EMPRESA,
        RAZON_SOCIAL
      FROM dbo.EMPRESAS
      WHERE ACTIVA = 1
      ORDER BY RAZON_SOCIAL;
    `),

    pool.request().query(`
      SELECT
        EM.ID_EMPRESA_MARCA,
        EM.ID_EMPRESA,
        EM.CODIGO_MARCA,
        COALESCE(MM.DETALLE_MARCA, EM.CODIGO_MARCA) AS DETALLE_MARCA
      FROM dbo.EMPRESAS_MARCAS EM
      LEFT JOIN dbo.MAESTRO_MARCAS MM
             ON MM.ID_EMPRESA = EM.ID_EMPRESA
            AND MM.CODIGO_MARCA = EM.CODIGO_MARCA
            AND MM.ACTIVO = 1
      WHERE EM.ACTIVA = 1
      ORDER BY EM.ID_EMPRESA, COALESCE(MM.DETALLE_MARCA, EM.CODIGO_MARCA);
    `),

    pool.request().query(`
      SELECT
        ID_EMPRESA,
        CODIGO_RUBRO,
        DETALLE_RUBRO
      FROM dbo.MAESTRO_RUBROS
      WHERE ACTIVO = 1
      ORDER BY ID_EMPRESA, DETALLE_RUBRO;
    `),

    pool.request().query(`
      SELECT DISTINCT
        ID_EMPRESA,
        CASE
          WHEN NULLIF(LTRIM(RTRIM(LICENCIA)), '') IS NULL
            THEN 'SIN LICENCIA'
          ELSE LTRIM(RTRIM(LICENCIA))
        END AS LICENCIA
      FROM dbo.MAESTRO_MODELOS
      WHERE ACTIVO = 1
      ORDER BY ID_EMPRESA, LICENCIA;
    `)
  ]);

  return {
    roles: roles.recordset,
    empresas: empresas.recordset,
    marcas: marcas.recordset,
    rubros: rubros.recordset,
    licencias: licencias.recordset
  };
}


async function actualizarUsuarioPermisos({
  idUsuario,
  activo,
  accesos,
  idsEmpresasGestionadas = null,
  actualizarActivo = true
}) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const usuarioResultado = await new sql.Request(transaction)
      .input('ID_USUARIO', sql.Int, idUsuario)
      .query(`
        SELECT TOP 1
          U.ID_USUARIO,
          U.USUARIO,
          U.ACTIVO,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM dbo.USUARIOS_ROLES_GLOBALES UG
              INNER JOIN dbo.ROLES R
                      ON R.ID_ROL = UG.ID_ROL
              WHERE UG.ID_USUARIO = U.ID_USUARIO
                AND UG.ACTIVO = 1
                AND R.ACTIVO = 1
                AND UPPER(LTRIM(RTRIM(R.CODIGO_ROL))) = 'SUPER_ADMIN'
            ) THEN 1 ELSE 0
          END AS ES_SUPER_ADMIN
        FROM dbo.USUARIOS U
        WHERE U.ID_USUARIO = @ID_USUARIO;
      `);

    const usuario = usuarioResultado.recordset[0];

    if (!usuario) {
      const error = new Error('Usuario no encontrado.');
      error.status = 404;
      throw error;
    }

    if (actualizarActivo) {
      await new sql.Request(transaction)
        .input('ID_USUARIO', sql.Int, idUsuario)
        .input('ACTIVO', sql.Bit, activo ? 1 : 0)
        .query(`
          UPDATE dbo.USUARIOS
          SET ACTIVO = @ACTIVO
          WHERE ID_USUARIO = @ID_USUARIO;
        `);
    }

    /*
     * Los roles globales se mantienen intactos en Paso 2B.
     * Para SUPER_ADMIN tampoco modificamos accesos por empresa: el contexto
     * global ignora esas filas y las administraremos en un paso específico.
     */
    if (!Boolean(usuario.ES_SUPER_ADMIN)) {
      const empresasGestionadas = Array.isArray(idsEmpresasGestionadas)
        ? [...new Set(idsEmpresasGestionadas.map(Number).filter(Number.isInteger))]
        : null;

      if (empresasGestionadas) {
        if (empresasGestionadas.length > 0) {
          const requestDesactivar = new sql.Request(transaction)
            .input('ID_USUARIO', sql.Int, idUsuario);

          const parametros = empresasGestionadas.map((idEmpresa, indice) => {
            const nombre = `ID_EMPRESA_${indice}`;
            requestDesactivar.input(nombre, sql.Int, idEmpresa);
            return `@${nombre}`;
          });

          await requestDesactivar.query(`
            UPDATE dbo.USUARIOS_ACCESOS
            SET ACTIVO = 0
            WHERE ID_USUARIO = @ID_USUARIO
              AND ID_EMPRESA IN (${parametros.join(', ')});
          `);
        }
      } else {
        await new sql.Request(transaction)
          .input('ID_USUARIO', sql.Int, idUsuario)
          .query(`
            UPDATE dbo.USUARIOS_ACCESOS
            SET ACTIVO = 0
            WHERE ID_USUARIO = @ID_USUARIO;
          `);
      }

      for (const acceso of accesos) {
        if (empresasGestionadas && !empresasGestionadas.includes(Number(acceso.idEmpresa))) {
          const error = new Error('Intentó modificar una empresa fuera del alcance administrado.');
          error.status = 403;
          throw error;
        }

        const empresaResultado = await new sql.Request(transaction)
          .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
          .query(`
            SELECT TOP 1 ID_EMPRESA
            FROM dbo.EMPRESAS
            WHERE ID_EMPRESA = @ID_EMPRESA
              AND ACTIVA = 1;
          `);

        if (!empresaResultado.recordset.length) {
          const error = new Error(`La empresa ${acceso.idEmpresa} no existe o está inactiva.`);
          error.status = 400;
          throw error;
        }

        const rolResultado = await new sql.Request(transaction)
          .input('ID_ROL', sql.Int, acceso.idRol)
          .query(`
            SELECT TOP 1 ID_ROL, CODIGO_ROL
            FROM dbo.ROLES
            WHERE ID_ROL = @ID_ROL
              AND ACTIVO = 1
              AND UPPER(LTRIM(RTRIM(CODIGO_ROL))) <> 'SUPER_ADMIN';
          `);

        if (!rolResultado.recordset.length) {
          const error = new Error('El rol informado no es válido para un acceso por empresa.');
          error.status = 400;
          throw error;
        }

        const accesoExistente = await new sql.Request(transaction)
          .input('ID_USUARIO', sql.Int, idUsuario)
          .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
          .input('ID_ROL', sql.Int, acceso.idRol)
          .query(`
            SELECT TOP 1 ID_ACCESO
            FROM dbo.USUARIOS_ACCESOS
            WHERE ID_USUARIO = @ID_USUARIO
              AND ID_EMPRESA = @ID_EMPRESA
              AND ID_ROL = @ID_ROL
            ORDER BY ID_ACCESO;
          `);

        let idAcceso;

        if (accesoExistente.recordset.length) {
          idAcceso = accesoExistente.recordset[0].ID_ACCESO;

          await new sql.Request(transaction)
            .input('ID_ACCESO', sql.Int, idAcceso)
            .input('ID_ROL', sql.Int, acceso.idRol)
            .input('TODAS_MARCAS', sql.Bit, acceso.todasMarcas ? 1 : 0)
            .input('TODOS_RUBROS', sql.Bit, acceso.todosRubros ? 1 : 0)
            .input('TODAS_LICENCIAS', sql.Bit, acceso.todasLicencias ? 1 : 0)
            .query(`
              UPDATE dbo.USUARIOS_ACCESOS
              SET
                ID_EMPRESA_MARCA = NULL,
                ACTIVO = 1,
                TODAS_MARCAS = @TODAS_MARCAS,
                TODOS_RUBROS = @TODOS_RUBROS,
                TODAS_LICENCIAS = @TODAS_LICENCIAS
              WHERE ID_ACCESO = @ID_ACCESO;
            `);
        } else {
          const creado = await new sql.Request(transaction)
            .input('ID_USUARIO', sql.Int, idUsuario)
            .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
            .input('ID_ROL', sql.Int, acceso.idRol)
            .input('TODAS_MARCAS', sql.Bit, acceso.todasMarcas ? 1 : 0)
            .input('TODOS_RUBROS', sql.Bit, acceso.todosRubros ? 1 : 0)
            .input('TODAS_LICENCIAS', sql.Bit, acceso.todasLicencias ? 1 : 0)
            .query(`
              INSERT INTO dbo.USUARIOS_ACCESOS
              (
                ID_USUARIO,
                ID_EMPRESA,
                ID_EMPRESA_MARCA,
                ID_ROL,
                ACTIVO,
                FECHA_CREACION,
                TODAS_MARCAS,
                TODOS_RUBROS,
                TODAS_LICENCIAS
              )
              OUTPUT INSERTED.ID_ACCESO
              VALUES
              (
                @ID_USUARIO,
                @ID_EMPRESA,
                NULL,
                @ID_ROL,
                1,
                SYSDATETIME(),
                @TODAS_MARCAS,
                @TODOS_RUBROS,
                @TODAS_LICENCIAS
              );
            `);

          idAcceso = creado.recordset[0].ID_ACCESO;
        }

        await new sql.Request(transaction)
          .input('ID_ACCESO', sql.Int, idAcceso)
          .query(`UPDATE dbo.USUARIOS_MARCAS SET ACTIVO = 0 WHERE ID_ACCESO = @ID_ACCESO;`);

        await new sql.Request(transaction)
          .input('ID_ACCESO', sql.Int, idAcceso)
          .query(`UPDATE dbo.USUARIOS_RUBROS SET ACTIVO = 0 WHERE ID_ACCESO = @ID_ACCESO;`);

        await new sql.Request(transaction)
          .input('ID_ACCESO', sql.Int, idAcceso)
          .query(`UPDATE dbo.USUARIOS_LICENCIAS SET ACTIVO = 0 WHERE ID_ACCESO = @ID_ACCESO;`);

        if (!acceso.todasMarcas) {
          for (const idEmpresaMarca of acceso.marcas) {
            const marcaValida = await new sql.Request(transaction)
              .input('ID_EMPRESA_MARCA', sql.Int, idEmpresaMarca)
              .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
              .query(`
                SELECT TOP 1 ID_EMPRESA_MARCA
                FROM dbo.EMPRESAS_MARCAS
                WHERE ID_EMPRESA_MARCA = @ID_EMPRESA_MARCA
                  AND ID_EMPRESA = @ID_EMPRESA
                  AND ACTIVA = 1;
              `);

            if (!marcaValida.recordset.length) {
              const error = new Error('Se informó una marca que no pertenece a la empresa seleccionada.');
              error.status = 400;
              throw error;
            }

            await new sql.Request(transaction)
              .input('ID_ACCESO', sql.Int, idAcceso)
              .input('ID_EMPRESA_MARCA', sql.Int, idEmpresaMarca)
              .query(`
                UPDATE dbo.USUARIOS_MARCAS
                SET ACTIVO = 1
                WHERE ID_ACCESO = @ID_ACCESO
                  AND ID_EMPRESA_MARCA = @ID_EMPRESA_MARCA;

                IF @@ROWCOUNT = 0
                BEGIN
                  INSERT INTO dbo.USUARIOS_MARCAS
                  (ID_ACCESO, ID_EMPRESA_MARCA, ACTIVO, FECHA_CREACION)
                  VALUES (@ID_ACCESO, @ID_EMPRESA_MARCA, 1, SYSDATETIME());
                END
              `);
          }
        }

        if (!acceso.todosRubros) {
          for (const codigoRubro of acceso.rubros) {
            const rubroValido = await new sql.Request(transaction)
              .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
              .input('CODIGO_RUBRO', sql.VarChar(30), codigoRubro)
              .query(`
                SELECT TOP 1 CODIGO_RUBRO
                FROM dbo.MAESTRO_RUBROS
                WHERE ID_EMPRESA = @ID_EMPRESA
                  AND CODIGO_RUBRO = @CODIGO_RUBRO
                  AND ACTIVO = 1;
              `);

            if (!rubroValido.recordset.length) {
              const error = new Error(`El rubro ${codigoRubro} no pertenece a la empresa seleccionada.`);
              error.status = 400;
              throw error;
            }

            await new sql.Request(transaction)
              .input('ID_ACCESO', sql.Int, idAcceso)
              .input('CODIGO_RUBRO', sql.VarChar(30), codigoRubro)
              .query(`
                UPDATE dbo.USUARIOS_RUBROS
                SET ACTIVO = 1
                WHERE ID_ACCESO = @ID_ACCESO
                  AND CODIGO_RUBRO = @CODIGO_RUBRO;

                IF @@ROWCOUNT = 0
                BEGIN
                  INSERT INTO dbo.USUARIOS_RUBROS
                  (ID_ACCESO, CODIGO_RUBRO, ACTIVO, FECHA_CREACION)
                  VALUES (@ID_ACCESO, @CODIGO_RUBRO, 1, SYSDATETIME());
                END
              `);
          }
        }

        if (!acceso.todasLicencias) {
          for (const licencia of acceso.licencias) {
            const licenciaNormalizada = String(licencia || '').trim();

            const licenciaValida = await new sql.Request(transaction)
              .input('ID_EMPRESA', sql.Int, acceso.idEmpresa)
              .input('LICENCIA', sql.VarChar(100), licenciaNormalizada)
              .query(`
                SELECT TOP 1 1 AS OK
                FROM dbo.MAESTRO_MODELOS
                WHERE ID_EMPRESA = @ID_EMPRESA
                  AND ACTIVO = 1
                  AND (
                    (@LICENCIA = 'SIN LICENCIA' AND NULLIF(LTRIM(RTRIM(LICENCIA)), '') IS NULL)
                    OR
                    (@LICENCIA <> 'SIN LICENCIA' AND LTRIM(RTRIM(LICENCIA)) = @LICENCIA)
                  );
              `);

            if (!licenciaValida.recordset.length) {
              const error = new Error(`La licencia ${licenciaNormalizada} no pertenece a la empresa seleccionada.`);
              error.status = 400;
              throw error;
            }

            await new sql.Request(transaction)
              .input('ID_ACCESO', sql.Int, idAcceso)
              .input('LICENCIA', sql.VarChar(100), licenciaNormalizada)
              .query(`
                UPDATE dbo.USUARIOS_LICENCIAS
                SET ACTIVO = 1
                WHERE ID_ACCESO = @ID_ACCESO
                  AND LICENCIA = @LICENCIA;

                IF @@ROWCOUNT = 0
                BEGIN
                  INSERT INTO dbo.USUARIOS_LICENCIAS
                  (ID_ACCESO, LICENCIA, ACTIVO, FECHA_CREACION)
                  VALUES (@ID_ACCESO, @LICENCIA, 1, SYSDATETIME());
                END
              `);
          }
        }
      }
    }

    await transaction.commit();

    return {
      idUsuario,
      activo: Boolean(activo),
      superAdmin: Boolean(usuario.ES_SUPER_ADMIN)
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw error;
  }
}


async function actualizarPasswordUsuario({ idUsuario, passwordHash }) {
  const pool = await getConnection();

  await pool.request()
    .input('ID_USUARIO', sql.Int, idUsuario)
    .input('PASSWORD_HASH', sql.VarChar(255), passwordHash)
    .query(`
      UPDATE dbo.USUARIOS
      SET PASSWORD_HASH = @PASSWORD_HASH,
          PASSWORD_CAMBIADA_EN = SYSDATETIME(),
          SESION_VERSION = ISNULL(SESION_VERSION, 1) + 1
      WHERE ID_USUARIO = @ID_USUARIO;

      IF @@ROWCOUNT = 0
      BEGIN
        THROW 50001, 'Usuario no encontrado.', 1;
      END
    `);
}


module.exports = {
  listarUsuarios,
  buscarUsuarioPorId,
  buscarUsuarioPorNombre,
  crearUsuarioBase,
  eliminarUsuarioCreado,
  obtenerRolesGlobales,
  obtenerAccesos,
  obtenerMarcas,
  obtenerRubros,
  obtenerLicencias,
  obtenerCatalogosAdministracion,
  actualizarUsuarioPermisos,
  actualizarPasswordUsuario
};
