const bcrypt = require('bcryptjs');

const repository =
  require('../repositories/usuarios.repository');


function booleano(valor) {
  return Boolean(valor);
}


function texto(valor) {
  return String(valor ?? '').trim();
}


function normalizar(valor) {
  return texto(valor).toUpperCase();
}


function enteroPositivo(valor, campo) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    const error = new Error(`${campo} inválido.`);
    error.status = 400;
    throw error;
  }

  return numero;
}


function valoresUnicos(lista, normalizarValor = valor => valor) {
  const vistos = new Set();
  const resultado = [];

  for (const item of Array.isArray(lista) ? lista : []) {
    const valor = normalizarValor(item);
    const clave = String(valor);

    if (!clave || vistos.has(clave)) continue;

    vistos.add(clave);
    resultado.push(valor);
  }

  return resultado;
}


function esSuperAdmin(contexto) {
  return Boolean(contexto?.superAdmin);
}


function accesosAdmin(contexto) {
  if (!Array.isArray(contexto?.empresas)) {
    return [];
  }

  return contexto.empresas.filter(item =>
    normalizar(item?.rol) === 'ADMIN'
  );
}


function puedeAdministrarUsuarios(contexto) {
  return esSuperAdmin(contexto) || accesosAdmin(contexto).length > 0;
}


function asegurarAdministrador(contexto) {
  if (!puedeAdministrarUsuarios(contexto)) {
    const error = new Error('Solo ADMIN o SUPER_ADMIN puede administrar usuarios.');
    error.status = 403;
    throw error;
  }
}


function mapearUsuario(item) {
  return {
    idUsuario: item.ID_USUARIO,
    usuario: item.USUARIO,
    nombre: item.NOMBRE,
    email: item.EMAIL,
    activo: booleano(item.ACTIVO),
    fechaCreacion: item.FECHA_CREACION,
    fechaUltimoLogin: item.FECHA_ULTIMO_LOGIN,
    superAdmin: booleano(item.ES_SUPER_ADMIN),
    cantidadAccesos: Number(item.CANTIDAD_ACCESOS || 0)
  };
}


async function listarUsuarios(contextoActual) {
  asegurarAdministrador(contextoActual);

  const filas = await repository.listarUsuarios();

  if (esSuperAdmin(contextoActual)) {
    return filas.map(mapearUsuario);
  }

  const empresasPermitidas = new Set(
    accesosAdmin(contextoActual).map(item => Number(item.idEmpresa))
  );

  const resultado = [];

  for (const fila of filas) {
    if (booleano(fila.ES_SUPER_ADMIN)) continue;

    const accesos = await repository.obtenerAccesos(fila.ID_USUARIO);
    const visibles = accesos.filter(item =>
      empresasPermitidas.has(Number(item.ID_EMPRESA))
    );

    if (!visibles.length) continue;

    const usuario = mapearUsuario(fila);
    usuario.cantidadAccesos = visibles.length;
    resultado.push(usuario);
  }

  return resultado;
}


async function obtenerUsuario(idUsuario, contextoActual = null) {
  const id = enteroPositivo(idUsuario, 'ID_USUARIO');

  const usuario =
    await repository.buscarUsuarioPorId(id);

  if (!usuario) {
    const error = new Error('Usuario no encontrado.');
    error.status = 404;
    throw error;
  }

  const [rolesGlobales, accesosDb] =
    await Promise.all([
      repository.obtenerRolesGlobales(id),
      repository.obtenerAccesos(id)
    ]);

  const usuarioEsSuperAdmin = rolesGlobales.some(
    item => normalizar(item.CODIGO_ROL) === 'SUPER_ADMIN'
  );

  let accesosPermitidos = accesosDb;

  if (contextoActual && !esSuperAdmin(contextoActual)) {
    asegurarAdministrador(contextoActual);

    if (usuarioEsSuperAdmin) {
      const error = new Error('Un ADMIN no puede administrar usuarios SUPER_ADMIN.');
      error.status = 403;
      throw error;
    }

    const empresasPermitidas = new Set(
      accesosAdmin(contextoActual).map(item => Number(item.idEmpresa))
    );

    accesosPermitidos = accesosDb.filter(item =>
      empresasPermitidas.has(Number(item.ID_EMPRESA))
    );

    if (!accesosPermitidos.length) {
      const error = new Error('El usuario no pertenece a una empresa administrada por su cuenta.');
      error.status = 403;
      throw error;
    }
  }

  const accesos = [];

  for (const acceso of accesosPermitidos) {
    const [marcas, rubros, licencias] =
      await Promise.all([
        acceso.TODAS_MARCAS
          ? Promise.resolve([])
          : repository.obtenerMarcas(acceso.ID_ACCESO),
        acceso.TODOS_RUBROS
          ? Promise.resolve([])
          : repository.obtenerRubros(
              acceso.ID_ACCESO,
              acceso.ID_EMPRESA
            ),
        acceso.TODAS_LICENCIAS
          ? Promise.resolve([])
          : repository.obtenerLicencias(acceso.ID_ACCESO)
      ]);

    accesos.push({
      idAcceso: acceso.ID_ACCESO,
      idEmpresa: acceso.ID_EMPRESA,
      codigoEmpresa: acceso.CODIGO_EMPRESA,
      empresa: acceso.RAZON_SOCIAL,
      idRol: acceso.ID_ROL,
      rol: acceso.CODIGO_ROL,
      detalleRol: acceso.DETALLE_ROL,
      todasMarcas: booleano(acceso.TODAS_MARCAS),
      todosRubros: booleano(acceso.TODOS_RUBROS),
      todasLicencias: booleano(acceso.TODAS_LICENCIAS),
      marcas: marcas.map(item => ({
        idEmpresaMarca: item.ID_EMPRESA_MARCA,
        codigoMarca: item.CODIGO_MARCA,
        detalleMarca: item.DETALLE_MARCA
      })),
      rubros: rubros.map(item => ({
        codigoRubro: item.CODIGO_RUBRO,
        detalleRubro: item.DETALLE_RUBRO
      })),
      licencias: licencias.map(item => item.LICENCIA)
    });
  }

  let puedeEditarPermisos = false;

  if (contextoActual) {
    if (esSuperAdmin(contextoActual)) {
      puedeEditarPermisos = true;
    } else if (
      !usuarioEsSuperAdmin &&
      accesos.length > 0
    ) {
      try {
        const accesosObjetivo = normalizarAccesos(
          accesos.map(acceso => ({
            idEmpresa: acceso.idEmpresa,
            idRol: acceso.idRol,
            todasMarcas: acceso.todasMarcas,
            todosRubros: acceso.todosRubros,
            todasLicencias: acceso.todasLicencias,
            marcas: (acceso.marcas || []).map(item => item.idEmpresaMarca),
            rubros: (acceso.rubros || []).map(item => item.codigoRubro),
            licencias: acceso.licencias || []
          }))
        );

        const catalogosAdmin = await obtenerCatalogos(contextoActual);
        validarAccesosAdministrador(accesosObjetivo, contextoActual, catalogosAdmin);
        puedeEditarPermisos = true;
      } catch (_) {
        puedeEditarPermisos = false;
      }
    }
  }

  return {
    idUsuario: usuario.ID_USUARIO,
    usuario: usuario.USUARIO,
    nombre: usuario.NOMBRE,
    email: usuario.EMAIL,
    activo: booleano(usuario.ACTIVO),
    fechaCreacion: usuario.FECHA_CREACION,
    fechaUltimoLogin: usuario.FECHA_ULTIMO_LOGIN,
    rolesGlobales: rolesGlobales.map(item => ({
      idRol: item.ID_ROL,
      codigoRol: item.CODIGO_ROL,
      detalleRol: item.DETALLE_ROL
    })),
    superAdmin: usuarioEsSuperAdmin,
    puedeEditarPermisos,
    puedeCambiarEstado: contextoActual ? esSuperAdmin(contextoActual) : false,
    esPropio: Boolean(contextoActual) && Number(contextoActual?.idUsuario) === id,
    accesos
  };
}


function mapaAccesosAdmin(contexto) {
  return new Map(
    accesosAdmin(contexto).map(item => [Number(item.idEmpresa), item])
  );
}


function scopePermitido(accesoAdmin, claveTodas, claveLista, valor, campos = []) {
  if (Boolean(accesoAdmin?.[claveTodas])) {
    return true;
  }

  const permitido = new Set(
    (Array.isArray(accesoAdmin?.[claveLista]) ? accesoAdmin[claveLista] : [])
      .map(item => {
        if (typeof item !== 'object' || item === null) {
          return normalizar(item);
        }

        for (const campo of campos) {
          if (item[campo] !== undefined && item[campo] !== null) {
            return normalizar(item[campo]);
          }
        }

        return '';
      })
      .filter(Boolean)
  );

  return permitido.has(normalizar(valor));
}


function filtrarCatalogosParaAdmin(catalogos, contextoActual) {
  if (esSuperAdmin(contextoActual)) {
    return catalogos;
  }

  const accesos = mapaAccesosAdmin(contextoActual);
  const empresasPermitidas = new Set(accesos.keys());

  const marcas = catalogos.marcas.filter(item => {
    const acceso = accesos.get(Number(item.ID_EMPRESA));
    if (!acceso) return false;

    if (Boolean(acceso.todasMarcas)) return true;

    return scopePermitido(
      acceso,
      'todasMarcas',
      'marcas',
      item.CODIGO_MARCA,
      ['codigoMarca', 'CODIGO_MARCA']
    );
  });

  const rubros = catalogos.rubros.filter(item => {
    const acceso = accesos.get(Number(item.ID_EMPRESA));
    if (!acceso) return false;

    return scopePermitido(
      acceso,
      'todosRubros',
      'rubros',
      item.CODIGO_RUBRO,
      ['codigoRubro', 'CODIGO_RUBRO']
    );
  });

  const licencias = catalogos.licencias.filter(item => {
    const acceso = accesos.get(Number(item.ID_EMPRESA));
    if (!acceso) return false;

    return scopePermitido(
      acceso,
      'todasLicencias',
      'licencias',
      item.LICENCIA,
      ['licencia', 'LICENCIA']
    );
  });

  return {
    ...catalogos,
    empresas: catalogos.empresas.filter(item =>
      empresasPermitidas.has(Number(item.ID_EMPRESA))
    ),
    marcas,
    rubros,
    licencias
  };
}


async function obtenerCatalogos(contextoActual) {
  asegurarAdministrador(contextoActual);

  const completos =
    await repository.obtenerCatalogosAdministracion();

  const catalogos = filtrarCatalogosParaAdmin(
    completos,
    contextoActual
  );

  return {
    capacidades: {
      puedeCrear: true,
      puedeEditar: true,
      puedeCambiarEstado: esSuperAdmin(contextoActual),
      puedeResetearPassword: true,
      superAdmin: esSuperAdmin(contextoActual)
    },
    roles: catalogos.roles.map(item => ({
      idRol: item.ID_ROL,
      codigoRol: item.CODIGO_ROL,
      detalleRol: item.DETALLE_ROL
    })),
    empresas: catalogos.empresas.map(item => ({
      idEmpresa: item.ID_EMPRESA,
      codigoEmpresa: item.CODIGO_EMPRESA,
      empresa: item.RAZON_SOCIAL
    })),
    marcas: catalogos.marcas.map(item => ({
      idEmpresaMarca: item.ID_EMPRESA_MARCA,
      idEmpresa: item.ID_EMPRESA,
      codigoMarca: item.CODIGO_MARCA,
      detalleMarca: item.DETALLE_MARCA
    })),
    rubros: catalogos.rubros.map(item => ({
      idEmpresa: item.ID_EMPRESA,
      codigoRubro: item.CODIGO_RUBRO,
      detalleRubro: item.DETALLE_RUBRO
    })),
    licencias: catalogos.licencias.map(item => ({
      idEmpresa: item.ID_EMPRESA,
      licencia: item.LICENCIA
    }))
  };
}


function normalizarAccesos(accesos) {
  const lista = Array.isArray(accesos) ? accesos : [];
  const empresas = new Set();

  return lista.map((item, indice) => {
    const idEmpresa = enteroPositivo(
      item?.idEmpresa,
      `ID_EMPRESA del acceso ${indice + 1}`
    );

    if (empresas.has(idEmpresa)) {
      const error = new Error('No se puede repetir la misma empresa en los accesos de un usuario.');
      error.status = 400;
      throw error;
    }

    empresas.add(idEmpresa);

    const idRol = enteroPositivo(
      item?.idRol,
      `ID_ROL del acceso ${indice + 1}`
    );

    const todasMarcas = Boolean(item?.todasMarcas);
    const todosRubros = Boolean(item?.todosRubros);
    const todasLicencias = Boolean(item?.todasLicencias);

    const marcas = todasMarcas
      ? []
      : valoresUnicos(
          item?.marcas,
          valor => enteroPositivo(valor, 'ID_EMPRESA_MARCA')
        );

    const rubros = todosRubros
      ? []
      : valoresUnicos(
          item?.rubros,
          valor => normalizar(valor)
        );

    const licencias = todasLicencias
      ? []
      : valoresUnicos(
          item?.licencias,
          valor => normalizar(valor)
        );

    if (!todasMarcas && marcas.length === 0) {
      const error = new Error(`Debe seleccionar al menos una marca para el acceso ${indice + 1}, o marcar TODAS.`);
      error.status = 400;
      throw error;
    }

    if (!todosRubros && rubros.length === 0) {
      const error = new Error(`Debe seleccionar al menos un rubro para el acceso ${indice + 1}, o marcar TODOS.`);
      error.status = 400;
      throw error;
    }

    if (!todasLicencias && licencias.length === 0) {
      const error = new Error(`Debe seleccionar al menos una licencia para el acceso ${indice + 1}, o marcar TODAS.`);
      error.status = 400;
      throw error;
    }

    return {
      idEmpresa,
      idRol,
      todasMarcas,
      todosRubros,
      todasLicencias,
      marcas,
      rubros,
      licencias
    };
  });
}


function validarAccesosAdministrador(accesos, contextoActual, catalogos) {
  if (esSuperAdmin(contextoActual)) return;

  const administrables = mapaAccesosAdmin(contextoActual);
  const rolesValidos = new Set(
    catalogos.roles.map(item => Number(item.idRol))
  );

  for (const acceso of accesos) {
    const admin = administrables.get(Number(acceso.idEmpresa));

    if (!admin) {
      const error = new Error('Un ADMIN solo puede crear usuarios dentro de empresas donde posee rol ADMIN.');
      error.status = 403;
      throw error;
    }

    if (!rolesValidos.has(Number(acceso.idRol))) {
      const error = new Error('El rol seleccionado no está permitido.');
      error.status = 403;
      throw error;
    }

    const marcasEmpresa = catalogos.marcas.filter(item =>
      Number(item.idEmpresa) === Number(acceso.idEmpresa)
    );
    const rubrosEmpresa = catalogos.rubros.filter(item =>
      Number(item.idEmpresa) === Number(acceso.idEmpresa)
    );
    const licenciasEmpresa = catalogos.licencias.filter(item =>
      Number(item.idEmpresa) === Number(acceso.idEmpresa)
    );

    if (acceso.todasMarcas && !Boolean(admin.todasMarcas)) {
      const error = new Error('No puede otorgar TODAS las marcas porque su propio acceso es limitado.');
      error.status = 403;
      throw error;
    }

    if (!acceso.todasMarcas) {
      const permitidas = new Set(marcasEmpresa.map(item => Number(item.idEmpresaMarca)));
      if (acceso.marcas.some(id => !permitidas.has(Number(id)))) {
        const error = new Error('Intentó otorgar una marca fuera de su propio alcance.');
        error.status = 403;
        throw error;
      }
    }

    if (acceso.todosRubros && !Boolean(admin.todosRubros)) {
      const error = new Error('No puede otorgar TODOS los rubros porque su propio acceso es limitado.');
      error.status = 403;
      throw error;
    }

    if (!acceso.todosRubros) {
      const permitidos = new Set(rubrosEmpresa.map(item => normalizar(item.codigoRubro)));
      if (acceso.rubros.some(codigo => !permitidos.has(normalizar(codigo)))) {
        const error = new Error('Intentó otorgar un rubro fuera de su propio alcance.');
        error.status = 403;
        throw error;
      }
    }

    if (acceso.todasLicencias && !Boolean(admin.todasLicencias)) {
      const error = new Error('No puede otorgar TODAS las licencias porque su propio acceso es limitado.');
      error.status = 403;
      throw error;
    }

    if (!acceso.todasLicencias) {
      const permitidas = new Set(licenciasEmpresa.map(item => normalizar(item.licencia)));
      if (acceso.licencias.some(licencia => !permitidas.has(normalizar(licencia)))) {
        const error = new Error('Intentó otorgar una licencia fuera de su propio alcance.');
        error.status = 403;
        throw error;
      }
    }
  }
}


async function crearUsuario(payload, contextoActual) {
  asegurarAdministrador(contextoActual);

  if (!payload || typeof payload !== 'object') {
    const error = new Error('Debe informar los datos del usuario.');
    error.status = 400;
    throw error;
  }

  const usuario = normalizar(payload.usuario);
  const nombre = texto(payload.nombre);
  const email = texto(payload.email);
  const password = String(payload.password ?? '');
  const activo = payload.activo === undefined ? true : Boolean(payload.activo);

  if (!/^[A-Z0-9._-]{3,100}$/.test(usuario)) {
    const error = new Error('El usuario debe tener entre 3 y 100 caracteres y solo puede contener letras, números, punto, guion o guion bajo.');
    error.status = 400;
    throw error;
  }

  if (!nombre || nombre.length > 150) {
    const error = new Error('Debe informar un nombre de hasta 150 caracteres.');
    error.status = 400;
    throw error;
  }

  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    const error = new Error('El email informado no es válido.');
    error.status = 400;
    throw error;
  }

  if (password.length < 8 || password.length > 200) {
    const error = new Error('La contraseña inicial debe tener entre 8 y 200 caracteres.');
    error.status = 400;
    throw error;
  }

  const accesos = normalizarAccesos(payload.accesos);

  if (!accesos.length) {
    const error = new Error('El nuevo usuario debe tener al menos un acceso por empresa.');
    error.status = 400;
    throw error;
  }

  const catalogos = await obtenerCatalogos(contextoActual);
  validarAccesosAdministrador(accesos, contextoActual, catalogos);

  const existente = await repository.buscarUsuarioPorNombre(usuario);
  if (existente) {
    const error = new Error(`El usuario ${usuario} ya existe.`);
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let idUsuario = null;

  try {
    idUsuario = await repository.crearUsuarioBase({
      usuario,
      nombre,
      email: email || null,
      passwordHash
    });

    await repository.actualizarUsuarioPermisos({
      idUsuario,
      activo,
      accesos
    });

    return obtenerUsuario(idUsuario, contextoActual);
  } catch (error) {
    if (idUsuario) {
      try {
        await repository.eliminarUsuarioCreado(idUsuario);
      } catch (errorLimpieza) {
        console.error('[USUARIOS] No se pudo limpiar un usuario creado parcialmente:', errorLimpieza);
      }
    }

    throw error;
  }
}


async function actualizarUsuario(idUsuario, payload, contextoActual) {
  const id = enteroPositivo(idUsuario, 'ID_USUARIO');

  asegurarAdministrador(contextoActual);

  if (!payload || typeof payload !== 'object') {
    const error = new Error('Debe informar los datos a guardar.');
    error.status = 400;
    throw error;
  }

  /*
   * SUPER_ADMIN administra el usuario completo.
   * ADMIN solamente administra los accesos de las empresas donde posee rol ADMIN.
   * Los accesos de otras empresas quedan intactos.
   */
  if (esSuperAdmin(contextoActual)) {
    const usuarioActual = await obtenerUsuario(id, contextoActual);
    const activo = Boolean(payload.activo);

    if (
      Number(contextoActual?.idUsuario) === id &&
      usuarioActual.activo &&
      !activo
    ) {
      const error = new Error('No puede desactivar el usuario con el que tiene iniciada la sesión.');
      error.status = 400;
      throw error;
    }

    const accesos = usuarioActual.superAdmin
      ? []
      : normalizarAccesos(payload.accesos);

    await repository.actualizarUsuarioPermisos({
      idUsuario: id,
      activo,
      accesos,
      actualizarActivo: true
    });

    return obtenerUsuario(id, contextoActual);
  }

  const esPerfilPropio = Number(contextoActual?.idUsuario) === id;

  const objetivoCompleto = await obtenerUsuario(id, null);

  if (objetivoCompleto.superAdmin) {
    const error = new Error('Un ADMIN no puede administrar usuarios SUPER_ADMIN.');
    error.status = 403;
    throw error;
  }

  /* Verifica que el usuario sea visible y completamente administrable dentro del scope del ADMIN. */
  const objetivoVisible = await obtenerUsuario(id, contextoActual);
  const catalogos = await obtenerCatalogos(contextoActual);

  const accesosActualesVisibles = normalizarAccesos(
    (objetivoVisible.accesos || []).map(acceso => ({
      idEmpresa: acceso.idEmpresa,
      idRol: acceso.idRol,
      todasMarcas: acceso.todasMarcas,
      todosRubros: acceso.todosRubros,
      todasLicencias: acceso.todasLicencias,
      marcas: (acceso.marcas || []).map(item => item.idEmpresaMarca),
      rubros: (acceso.rubros || []).map(item => item.codigoRubro),
      licencias: acceso.licencias || []
    }))
  );

  validarAccesosAdministrador(
    accesosActualesVisibles,
    contextoActual,
    catalogos
  );

  const accesos = normalizarAccesos(payload.accesos);

  validarAccesosAdministrador(
    accesos,
    contextoActual,
    catalogos
  );

  /*
   * Un ADMIN puede editar su propio perfil, pero no puede alterar
   * la estructura que le concede autoridad administrativa.
   * En perfil propio se conservan exactamente las mismas empresas
   * y el mismo rol ADMIN; solo se permiten ajustes de scopes dentro
   * del alcance que ya poseía al iniciar la sesión.
   */
  if (esPerfilPropio) {
    const actualesPorEmpresa = new Map(
      accesosActualesVisibles.map(acceso => [Number(acceso.idEmpresa), Number(acceso.idRol)])
    );
    const nuevosPorEmpresa = new Map(
      accesos.map(acceso => [Number(acceso.idEmpresa), Number(acceso.idRol)])
    );

    if (actualesPorEmpresa.size !== nuevosPorEmpresa.size) {
      const error = new Error('No puede agregar ni quitar empresas desde su propio perfil ADMIN.');
      error.status = 403;
      throw error;
    }

    for (const [idEmpresa, idRolActual] of actualesPorEmpresa) {
      if (!nuevosPorEmpresa.has(idEmpresa)) {
        const error = new Error('No puede quitar una empresa desde su propio perfil ADMIN.');
        error.status = 403;
        throw error;
      }

      if (Number(nuevosPorEmpresa.get(idEmpresa)) !== Number(idRolActual)) {
        const error = new Error('No puede modificar su propio rol ADMIN.');
        error.status = 403;
        throw error;
      }
    }
  }

  const idsEmpresasGestionadas = accesosAdmin(contextoActual)
    .map(item => Number(item.idEmpresa))
    .filter(Number.isInteger);

  await repository.actualizarUsuarioPermisos({
    idUsuario: id,
    activo: objetivoCompleto.activo,
    accesos,
    idsEmpresasGestionadas,
    actualizarActivo: false
  });

  try {
    return await obtenerUsuario(id, contextoActual);
  } catch (error) {
    /*
     * Si el ADMIN quitó el último acceso del usuario dentro de sus empresas,
     * el usuario deja de ser visible para él. No exponemos accesos de otras empresas.
     */
    if (error?.status === 403) {
      return {
        idUsuario: objetivoCompleto.idUsuario,
        usuario: objetivoCompleto.usuario,
        nombre: objetivoCompleto.nombre,
        email: objetivoCompleto.email,
        activo: objetivoCompleto.activo,
        fechaCreacion: objetivoCompleto.fechaCreacion,
        fechaUltimoLogin: objetivoCompleto.fechaUltimoLogin,
        rolesGlobales: [],
        superAdmin: false,
        puedeEditarPermisos: false,
        puedeCambiarEstado: false,
        accesos: []
      };
    }

    throw error;
  }
}

async function asegurarPuedeResetearPassword(idUsuario, contextoActual) {
  asegurarAdministrador(contextoActual);

  if (esSuperAdmin(contextoActual)) {
    return obtenerUsuario(idUsuario, null);
  }

  const objetivo = await obtenerUsuario(idUsuario, null);

  if (objetivo.superAdmin) {
    const error = new Error('Un ADMIN no puede modificar la contraseña de un SUPER_ADMIN.');
    error.status = 403;
    throw error;
  }

  const accesosObjetivo = normalizarAccesos(
    (Array.isArray(objetivo.accesos) ? objetivo.accesos : []).map(acceso => ({
      idEmpresa: acceso.idEmpresa,
      idRol: acceso.idRol,
      todasMarcas: acceso.todasMarcas,
      todosRubros: acceso.todosRubros,
      todasLicencias: acceso.todasLicencias,
      marcas: (Array.isArray(acceso.marcas) ? acceso.marcas : [])
        .map(item => item.idEmpresaMarca),
      rubros: (Array.isArray(acceso.rubros) ? acceso.rubros : [])
        .map(item => item.codigoRubro),
      licencias: Array.isArray(acceso.licencias) ? acceso.licencias : []
    }))
  );

  if (!accesosObjetivo.length) {
    const error = new Error('Un ADMIN no puede resetear un usuario sin accesos activos dentro de su alcance.');
    error.status = 403;
    throw error;
  }

  const catalogos = await obtenerCatalogos(contextoActual);
  validarAccesosAdministrador(accesosObjetivo, contextoActual, catalogos);

  return objetivo;
}


async function cambiarPasswordUsuario(idUsuario, payload, contextoActual) {
  const id = enteroPositivo(idUsuario, 'ID_USUARIO');

  if (!payload || typeof payload !== 'object') {
    const error = new Error('Debe informar la nueva contraseña.');
    error.status = 400;
    throw error;
  }

  await asegurarPuedeResetearPassword(id, contextoActual);

  const password = String(payload.password ?? '');

  if (password.length < 8 || password.length > 200) {
    const error = new Error('La nueva contraseña debe tener entre 8 y 200 caracteres.');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await repository.actualizarPasswordUsuario({
    idUsuario: id,
    passwordHash
  });

  return {
    idUsuario: id,
    actualizado: true
  };
}


module.exports = {
  listarUsuarios,
  obtenerUsuario,
  obtenerCatalogos,
  crearUsuario,
  actualizarUsuario,
  cambiarPasswordUsuario,
  puedeAdministrarUsuarios
};
