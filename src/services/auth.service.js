const bcrypt = require('bcryptjs');

const repository =
  require('../repositories/auth.repository');


function texto(valor) {
  return String(valor ?? '').trim();
}


async function construirContextoUsuario(usuarioDb) {

  const rolesGlobales =
    await repository.obtenerRolesGlobales(
      usuarioDb.ID_USUARIO
    );

  const esSuperAdmin =
    rolesGlobales.some(
      item =>
        String(item.CODIGO_ROL).toUpperCase() ===
        'SUPER_ADMIN'
    );


  if (esSuperAdmin) {

    const empresas =
      await repository.obtenerTodasEmpresas();

    return {
      idUsuario:
        usuarioDb.ID_USUARIO,

      usuario:
        usuarioDb.USUARIO,

      nombre:
        usuarioDb.NOMBRE,

      email:
        usuarioDb.EMAIL,

      superAdmin:
        true,

      rolesGlobales:
        rolesGlobales.map(
          item => item.CODIGO_ROL
        ),

      sesionVersion:
        Number(usuarioDb.SESION_VERSION || 1),

      debeCambiarPassword:
        Boolean(usuarioDb.DEBE_CAMBIAR_PASSWORD),

      empresas:
        empresas.map(
          empresa => ({
            idEmpresa:
              empresa.ID_EMPRESA,

            codigoEmpresa:
              empresa.CODIGO_EMPRESA,

            empresa:
              empresa.RAZON_SOCIAL,

            rol:
              'SUPER_ADMIN',

            todasMarcas:
              true,

            todosRubros:
              true,

            todasLicencias:
              true,

            marcas:
              [],

            rubros:
              [],

            licencias:
              []
          })
        )
    };
  }


  const accesos =
    await repository.obtenerAccesosEmpresa(
      usuarioDb.ID_USUARIO
    );

  const empresas = [];


  for (const acceso of accesos) {

    const marcas =
      acceso.TODAS_MARCAS
        ? []
        : await repository.obtenerMarcasAcceso(
            acceso.ID_ACCESO
          );

    const rubros =
      acceso.TODOS_RUBROS
        ? []
        : await repository.obtenerRubrosAcceso(
            acceso.ID_ACCESO,
            acceso.ID_EMPRESA
          );

    const licencias =
      acceso.TODAS_LICENCIAS
        ? []
        : await repository.obtenerLicenciasAcceso(
            acceso.ID_ACCESO
          );


    empresas.push({
      idAcceso:
        acceso.ID_ACCESO,

      idEmpresa:
        acceso.ID_EMPRESA,

      codigoEmpresa:
        acceso.CODIGO_EMPRESA,

      empresa:
        acceso.RAZON_SOCIAL,

      rol:
        acceso.CODIGO_ROL,

      todasMarcas:
        Boolean(acceso.TODAS_MARCAS),

      todosRubros:
        Boolean(acceso.TODOS_RUBROS),

      todasLicencias:
        Boolean(acceso.TODAS_LICENCIAS),

      marcas:
        marcas.map(
          item => ({
            idEmpresaMarca:
              item.ID_EMPRESA_MARCA,

            codigoMarca:
              item.CODIGO_MARCA,

            detalleMarca:
              item.DETALLE_MARCA ||
              item.CODIGO_MARCA
          })
        ),

      rubros:
        rubros.map(
          item => ({
            codigoRubro:
              item.CODIGO_RUBRO,

            detalleRubro:
              item.DETALLE_RUBRO ||
              item.CODIGO_RUBRO
          })
        ),

      licencias:
        licencias.map(
          item => item.LICENCIA
        )
    });
  }


  return {
    idUsuario:
      usuarioDb.ID_USUARIO,

    usuario:
      usuarioDb.USUARIO,

    nombre:
      usuarioDb.NOMBRE,

    email:
      usuarioDb.EMAIL,

    superAdmin:
      false,

    rolesGlobales:
      rolesGlobales.map(
        item => item.CODIGO_ROL
      ),

    sesionVersion:
      Number(usuarioDb.SESION_VERSION || 1),

    debeCambiarPassword:
      Boolean(usuarioDb.DEBE_CAMBIAR_PASSWORD),

    empresas
  };
}


async function login({
  usuario,
  password
}) {

  const nombreUsuario =
    texto(usuario);

  const clave =
    String(password ?? '');


  if (!nombreUsuario || !clave) {
    throw new Error(
      'Debe informar usuario y contraseña.'
    );
  }


  const usuarioDb =
    await repository.buscarUsuarioPorNombre(
      nombreUsuario
    );


  if (
    !usuarioDb ||
    !Boolean(usuarioDb.ACTIVO)
  ) {

    return null;
  }


  const coincide =
    await bcrypt.compare(
      clave,
      usuarioDb.PASSWORD_HASH
    );


  if (!coincide) {
    return null;
  }


  const contexto =
    await construirContextoUsuario(
      usuarioDb
    );


  await repository.actualizarUltimoLogin(
    usuarioDb.ID_USUARIO
  );


  return contexto;
}


async function validarContextoSesion(contexto) {
  if (!contexto || !contexto.idUsuario) {
    return false;
  }

  const estado = await repository.obtenerEstadoSesionUsuario(contexto.idUsuario);

  return Boolean(
    estado &&
    estado.ACTIVO &&
    Number(estado.SESION_VERSION || 1) === Number(contexto.sesionVersion || 0)
  );
}


async function crearHashPassword(password) {

  const clave =
    String(password ?? '');

  if (clave.length < 8) {
    throw new Error(
      'La contraseña debe tener al menos 8 caracteres.'
    );
  }

  return bcrypt.hash(
    clave,
    12
  );
}


module.exports = {
  login,
  construirContextoUsuario,
  crearHashPassword,
  validarContextoSesion
};
