const {
  getConnection,
  sql
} = require('../config/database');

const authService = require('../services/auth.service');


async function validarSesionVigente(req) {
  const contexto = req.session?.usuario;

  if (!contexto) {
    return false;
  }

  const vigente = await authService.validarContextoSesion(contexto);

  if (!vigente) {
    if (req.session) {
      await new Promise(resolve => {
        req.session.destroy(() => resolve());
      });
    }
    return false;
  }

  req.usuario = contexto;
  return true;
}


async function requerirAutenticacion(req, res, next) {
  try {
    if (await validarSesionVigente(req)) {
      return next();
    }

    return res.status(401).json({
      ok: false,
      mensaje: 'Debe iniciar sesión nuevamente.'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo validar la sesión.'
    });
  }
}


function obtenerContextoUsuario(req) {
  return req.usuario || req.session?.usuario || null;
}


function obtenerAccesoEmpresa(contexto, idEmpresa) {

  if (!contexto) {
    return null;
  }

  const id = Number(idEmpresa);

  const empresaContexto =
    Array.isArray(contexto.empresas)
      ? contexto.empresas.find(
          item => Number(item.idEmpresa) === id
        )
      : null;

  if (!empresaContexto) {
    return null;
  }

  if (contexto.superAdmin) {
    return {
      ...empresaContexto,
      rol: 'SUPER_ADMIN',
      todasMarcas: true,
      todosRubros: true,
      todasLicencias: true,
      marcas: [],
      rubros: [],
      licencias: []
    };
  }

  return empresaContexto;
}


function puedeAccederEmpresa(contexto, idEmpresa) {
  return Boolean(
    obtenerAccesoEmpresa(
      contexto,
      idEmpresa
    )
  );
}


function leerIdEmpresaRequest(req) {

  const valor =
    req.query?.idEmpresa ??
    req.body?.idEmpresa ??
    req.get('x-id-empresa');

  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    const error =
      new Error('ID_EMPRESA inválido.');
    error.status = 400;
    throw error;
  }

  return id;
}


function resolverIdEmpresa(req) {

  const contexto =
    obtenerContextoUsuario(req);

  if (!contexto) {
    const error =
      new Error('Debe iniciar sesión.');
    error.status = 401;
    throw error;
  }

  const solicitado =
    leerIdEmpresaRequest(req);

  if (solicitado !== null) {

    const acceso =
      obtenerAccesoEmpresa(
        contexto,
        solicitado
      );

    if (!acceso) {
      const error =
        new Error(
          'No tiene permisos para acceder a la empresa indicada.'
        );
      error.status = 403;
      throw error;
    }

    return {
      idEmpresa: solicitado,
      acceso
    };
  }


  const empresas =
    Array.isArray(contexto.empresas)
      ? contexto.empresas
      : [];

  if (empresas.length === 1) {

    const idEmpresa =
      Number(empresas[0].idEmpresa);

    return {
      idEmpresa,
      acceso:
        obtenerAccesoEmpresa(
          contexto,
          idEmpresa
        )
    };
  }


  const error =
    new Error(
      'Debe seleccionar una empresa.'
    );

  error.status = 400;
  throw error;
}


function requerirEmpresa(req, res, next) {

  try {

    const {
      idEmpresa,
      acceso
    } =
      resolverIdEmpresa(req);

    req.idEmpresa =
      idEmpresa;

    req.accesoEmpresa =
      acceso;

    return next();

  } catch (error) {

    return res
      .status(error.status || 400)
      .json({
        ok: false,
        mensaje: error.message
      });
  }
}


function rolPermiteEscritura(rol) {

  return [
    'SUPER_ADMIN',
    'ADMIN',
    'OPERADOR'
  ].includes(
    String(rol || '')
      .trim()
      .toUpperCase()
  );
}


function requerirEscrituraEmpresa(req, res, next) {

  if (
    !req.accesoEmpresa ||
    !rolPermiteEscritura(
      req.accesoEmpresa.rol
    )
  ) {

    return res.status(403).json({
      ok: false,
      mensaje:
        'Su rol no permite modificar información.'
    });
  }

  return next();
}


function normalizarScope(valor) {
  return String(valor === undefined || valor === null ? '' : valor).trim().toUpperCase();
}

function normalizarLicenciaScope(valor) {
  const normalizado = normalizarScope(valor);

  if (
    !normalizado ||
    normalizado === '__SIN_LICENCIA__' ||
    normalizado === 'SIN LICENCIA'
  ) {
    return 'SIN LICENCIA';
  }

  return normalizado;
}

function codigoScope(item, campos) {
  /*
   * Algunos scopes se guardan en el contexto como objetos
   * (marcas/rubros) y otros como valores simples (licencias).
   * Aceptamos ambos formatos para que la validación sea consistente
   * con el contexto construido por auth.service.
   */
  if (
    typeof item === 'string' ||
    typeof item === 'number'
  ) {
    return normalizarScope(item);
  }

  for (const campo of campos) {
    if (item && item[campo] !== undefined && item[campo] !== null && String(item[campo]).trim() !== '') {
      return normalizarScope(item[campo]);
    }
  }
  return '';
}

function accesoPermiteAlta(acceso, alta) {
  if (!acceso) return false;

  const marca = normalizarScope(alta.CODIGO_MARCA);
  const rubro = normalizarScope(alta.CODIGO_RUBRO);
  const licencia = normalizarLicenciaScope(alta.LICENCIA_ALTA);

  if (!acceso.todasMarcas) {
    const marcas = Array.isArray(acceso.marcas)
      ? acceso.marcas.map(item => codigoScope(item, ['codigoMarca', 'CODIGO_MARCA']))
      : [];
    if (!marcas.includes(marca)) return false;
  }

  if (!acceso.todosRubros) {
    const rubros = Array.isArray(acceso.rubros)
      ? acceso.rubros.map(item => codigoScope(item, ['codigoRubro', 'CODIGO_RUBRO']))
      : [];
    if (!rubros.includes(rubro)) return false;
  }

  if (!acceso.todasLicencias) {
    const licencias = Array.isArray(acceso.licencias)
      ? acceso.licencias.map(item => normalizarLicenciaScope(
          codigoScope(item, [
            'codigoLicencia', 'CODIGO_LICENCIA', 'licencia', 'LICENCIA',
            'detalleLicencia', 'DETALLE_LICENCIA'
          ])
        ))
      : [];
    if (!licencias.includes(licencia)) return false;
  }

  return true;
}


async function requerirAccesoAlta(req, res, next) {
  try {
    const contexto = obtenerContextoUsuario(req);
    if (!contexto) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });

    const idAlta = Number(req.params.id ?? req.params.idAlta);
    if (!Number.isInteger(idAlta) || idAlta <= 0) {
      return res.status(400).json({ ok: false, mensaje: 'ID_ALTA inválido.' });
    }

    const pool = await getConnection();
    const resultado = await pool.request()
      .input('ID_ALTA', sql.Int, idAlta)
      .query(`
        SELECT TOP 1
          A.ID_ALTA, A.ID_EMPRESA, A.CODIGO_ALTA,
          A.CODIGO_MARCA, A.CODIGO_RUBRO, A.ESTADO,
          (
            SELECT TOP 1
              CASE
                WHEN NULLIF(LTRIM(RTRIM(D.LICENCIA)), '') IS NULL THEN 'SIN LICENCIA'
                ELSE LTRIM(RTRIM(D.LICENCIA))
              END
            FROM dbo.ALTAS_PRODUCTOS_DETALLE D
            WHERE D.ID_EMPRESA = A.ID_EMPRESA
              AND D.ID_ALTA = A.ID_ALTA
            ORDER BY D.ID_DETALLE
          ) AS LICENCIA_ALTA
        FROM dbo.ALTAS_PRODUCTOS A
        WHERE A.ID_ALTA = @ID_ALTA;
      `);

    const alta = resultado.recordset[0];
    if (!alta) return res.status(404).json({ ok: false, mensaje: 'Alta no encontrada.' });

    const acceso = obtenerAccesoEmpresa(contexto, alta.ID_EMPRESA);
    if (!acceso) return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para acceder a esta alta.' });

    if (!accesoPermiteAlta(acceso, alta)) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para acceder a esta alta por marca, rubro o licencia.' });
    }

    req.idEmpresa = Number(alta.ID_EMPRESA);
    req.accesoEmpresa = acceso;
    req.altaSeguridad = alta;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo validar el acceso al alta.' });
  }
}


async function requerirAccesoPedido(req, res, next) {
  try {
    const contexto = obtenerContextoUsuario(req);
    if (!contexto) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });

    const idPedido = Number(req.params.id);
    if (!Number.isInteger(idPedido) || idPedido <= 0) {
      return res.status(400).json({ ok: false, mensaje: 'ID_PEDIDO inválido.' });
    }

    const pool = await getConnection();
    const resultado = await pool.request()
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        SELECT
          P.ID_PEDIDO, P.ID_EMPRESA, P.ID_ALTA, P.CODIGO_PEDIDO, P.ESTADO,
          A.ID_ALTA AS ID_ALTA_ASOCIADA, A.CODIGO_MARCA, A.CODIGO_RUBRO,
          (
            SELECT TOP 1
              CASE
                WHEN NULLIF(LTRIM(RTRIM(D.LICENCIA)), '') IS NULL THEN 'SIN LICENCIA'
                ELSE LTRIM(RTRIM(D.LICENCIA))
              END
            FROM dbo.ALTAS_PRODUCTOS_DETALLE D
            WHERE D.ID_EMPRESA = A.ID_EMPRESA
              AND D.ID_ALTA = A.ID_ALTA
            ORDER BY D.ID_DETALLE
          ) AS LICENCIA_ALTA
        FROM dbo.PEDIDOS P
        CROSS APPLY
        (
          SELECT PA.ID_ALTA
          FROM dbo.PEDIDOS_ALTAS PA
          WHERE PA.ID_EMPRESA = P.ID_EMPRESA AND PA.ID_PEDIDO = P.ID_PEDIDO
          UNION
          SELECT P.ID_ALTA
          WHERE NOT EXISTS
          (
            SELECT 1 FROM dbo.PEDIDOS_ALTAS PA0
            WHERE PA0.ID_EMPRESA = P.ID_EMPRESA AND PA0.ID_PEDIDO = P.ID_PEDIDO
          )
        ) REL
        INNER JOIN dbo.ALTAS_PRODUCTOS A
          ON A.ID_EMPRESA = P.ID_EMPRESA AND A.ID_ALTA = REL.ID_ALTA
        WHERE P.ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedidosAltas = resultado.recordset || [];
    const pedido = pedidosAltas[0];
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });

    const acceso = obtenerAccesoEmpresa(contexto, pedido.ID_EMPRESA);
    if (!acceso) return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para acceder a este pedido.' });

    if (!pedidosAltas.every(alta => accesoPermiteAlta(acceso, alta))) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para acceder a este pedido por marca, rubro o licencia.' });
    }

    req.idEmpresa = Number(pedido.ID_EMPRESA);
    req.accesoEmpresa = acceso;
    req.pedidoSeguridad = pedido;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo validar el acceso al pedido.' });
  }
}


function esAdministradorUsuarios(contexto) {
  if (!contexto) {
    return false;
  }

  if (contexto.superAdmin) {
    return true;
  }

  return Array.isArray(contexto.empresas) &&
    contexto.empresas.some(item =>
      String(item?.rol || '')
        .trim()
        .toUpperCase() === 'ADMIN'
    );
}


function requerirAdminUsuarios(req, res, next) {
  const contexto = obtenerContextoUsuario(req);

  if (!contexto) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Debe iniciar sesión.'
    });
  }

  if (!esAdministradorUsuarios(contexto)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo ADMIN o SUPER_ADMIN puede administrar usuarios.'
    });
  }

  return next();
}


function requerirSuperAdmin(req, res, next) {
  const contexto = obtenerContextoUsuario(req);

  if (!contexto) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Debe iniciar sesión.'
    });
  }

  if (!contexto.superAdmin) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo SUPER_ADMIN puede administrar usuarios y permisos.'
    });
  }

  return next();
}


module.exports = {
  requerirAutenticacion,
  validarSesionVigente,
  requerirSuperAdmin,
  requerirAdminUsuarios,
  esAdministradorUsuarios,
  obtenerContextoUsuario,
  puedeAccederEmpresa,
  obtenerAccesoEmpresa,
  resolverIdEmpresa,
  requerirEmpresa,
  requerirEscrituraEmpresa,
  requerirAccesoAlta,
  requerirAccesoPedido,
  rolPermiteEscritura
};
