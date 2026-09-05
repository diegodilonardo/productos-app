const pedidosRepository = require('../repositories/pedidos.repository');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const ftpService = require('./ftp.service');

const ESTADOS_ALTAS_HABILITADOS_PEDIDOS = Object.freeze([
  'GENERADO_OK_EN_ERP',
  'SIN_NOVEDADES_ERP',
]);

/* ============================================================
   UTILIDADES
   ============================================================ */

function texto(valor) {
  return String(
    valor === undefined || valor === null
      ? ''
      : valor
  ).trim();
}

function validarIdAlta(idAlta) {
  const id = Number(idAlta);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_ALTA inválido.');
  }

  return id;
}

function validarIdsAltas(valor) {
  const entrada = Array.isArray(valor) ? valor : [valor];
  const ids = [...new Set(entrada.map(validarIdAlta))];
  if (!ids.length) throw new Error('Debe seleccionar al menos un Alta.');
  if (ids.length > 50) throw new Error('No se pueden seleccionar más de 50 Altas por pedido.');
  return ids;
}

function validarIdPedido(idPedido) {
  const id = Number(idPedido);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_PEDIDO inválido.');
  }

  return id;
}

function estadoAltaHabilitadoParaPedido(estado) {
  return ESTADOS_ALTAS_HABILITADOS_PEDIDOS.includes(texto(estado).toUpperCase());
}

function calcularCantidadesPedido(tipoProducto, cantidadPares, paresPorModulo) {
  const tipo = normalizarTipoProducto(tipoProducto);

  if (tipo === 'PAR_SUELTO') {
    return { paresModulo: null, cantidadModulos: null };
  }

  if (tipo !== 'MODULO') {
    throw new Error(`Tipo de producto no habilitado: ${tipo}.`);
  }

  const paresModulo = enteroPositivo(paresPorModulo, 'Los pares del módulo');
  if (cantidadPares % paresModulo !== 0) {
    throw new Error(
      `La cantidad de pares (${cantidadPares}) no es divisible exactamente ` +
      `por los ${paresModulo} pares del módulo.`
    );
  }

  return {
    paresModulo,
    cantidadModulos: cantidadPares / paresModulo,
  };
}

function validarIdEmpresa(idEmpresa) {
  const id = Number(idEmpresa);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_EMPRESA inválido.');
  }

  return id;
}


function normalizarScope(valor) {
  const dato = texto(valor).toUpperCase();

  if (['__SIN_LICENCIA__', 'SIN LICENCIA'].includes(dato)) {
    return 'SIN LICENCIA';
  }

  return dato;
}

function codigoScope(item, campos) {
  /*
   * Los scopes de seguridad no tienen todos la misma forma:
   * - marcas/rubros llegan como objetos;
   * - licencias llegan actualmente como strings.
   * Aceptamos ambos formatos para no descartar accesos válidos.
   */
  if (typeof item === 'string' || typeof item === 'number') {
    return normalizarScope(item);
  }

  for (const campo of campos) {
    if (item && item[campo] !== undefined && item[campo] !== null && texto(item[campo]) !== '') {
      return normalizarScope(item[campo]);
    }
  }
  return '';
}

function accesoPermiteAlta(acceso, alta) {
  if (!acceso) return false;

  const marca = normalizarScope(alta.CODIGO_MARCA);
  const rubro = normalizarScope(alta.CODIGO_RUBRO);
  const licencia = normalizarScope(alta.LICENCIA_ALTA) || 'SIN LICENCIA';

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
      ? acceso.licencias.map(item => codigoScope(item, [
          'codigoLicencia', 'CODIGO_LICENCIA', 'licencia', 'LICENCIA',
          'detalleLicencia', 'DETALLE_LICENCIA'
        ]))
      : [];
    if (!licencias.includes(licencia)) return false;
  }

  return true;
}


function normalizarTipoProducto(valor) {
  return texto(valor).toUpperCase();
}

function normalizarMoneda(valor) {
  const moneda = texto(valor || 'USD').toUpperCase();

  if (!moneda) {
    throw new Error('La moneda es obligatoria.');
  }

  if (moneda.length > 10) {
    throw new Error('La moneda supera la longitud permitida.');
  }

  return moneda;
}

function sanitizarComponenteCodigo(valor, nombre) {
  const dato = texto(valor);

  if (!dato) {
    throw new Error(`${nombre} es obligatorio para generar el código del pedido.`);
  }

  return dato
    .replace(/\s+/g, '-')
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ============================================================
   ALTAS DISPONIBLES
   ============================================================ */

async function obtenerAltasDisponibles(idEmpresa, accesoEmpresa) {
  const altas = await pedidosRepository.obtenerAltasDisponibles(
    validarIdEmpresa(idEmpresa)
  );
  return altas.filter(alta => accesoPermiteAlta(accesoEmpresa, alta));
}

/* ============================================================
   VALIDAR ALTA DISPONIBLE
   ============================================================ */

async function validarAltaDisponible(idAlta, idEmpresa, accesoEmpresa) {
  const id = validarIdAlta(idAlta);
  const alta = await pedidosRepository.obtenerAltaDisponiblePorId(
    id,
    validarIdEmpresa(idEmpresa)
  );

  if (!alta) {
    throw new Error(
      'El Alta no existe o no está habilitada para Pedidos. Debe encontrarse en GENERADO_OK_EN_ERP o SIN_NOVEDADES_ERP.'
    );
  }

  if (!estadoAltaHabilitadoParaPedido(alta.ESTADO)) {
    throw new Error(
      `El Alta está en estado ${alta.ESTADO} y no está habilitada para Pedidos.`
    );
  }

  if (!accesoPermiteAlta(accesoEmpresa, alta)) {
    throw new Error(
      'No tiene permisos para acceder al Alta por marca, rubro o licencia.'
    );
  }

  const tipo = normalizarTipoProducto(alta.TIPO_PRODUCTO);

  if (!['MODULO', 'PAR_SUELTO'].includes(tipo)) {
    throw new Error(
      `El tipo de producto del Alta (${alta.TIPO_PRODUCTO}) no está habilitado para Pedidos.`
    );
  }

  return { ...alta, TIPO_PRODUCTO: tipo };
}

async function validarAltasDisponibles(idsAltas, idEmpresa, accesoEmpresa) {
  const ids = validarIdsAltas(idsAltas);
  return Promise.all(ids.map(id => validarAltaDisponible(id, idEmpresa, accesoEmpresa)));
}

/* ============================================================
   PROVEEDORES DEL ALTA
   ============================================================ */

async function obtenerProveedoresPorAlta(idAlta, idEmpresa, accesoEmpresa) {
  const alta = await validarAltaDisponible(idAlta, idEmpresa, accesoEmpresa);

  const proveedores = await pedidosRepository
    .obtenerProveedoresPorAlta(alta.ID_ALTA, alta.ID_EMPRESA);

  return proveedores;
}

async function obtenerProveedoresPorAltas(idsAltas, idEmpresa, accesoEmpresa) {
  const altas = await validarAltasDisponibles(idsAltas, idEmpresa, accesoEmpresa);
  if (altas.length === 1) {
    return pedidosRepository.obtenerProveedoresPorAlta(
      altas[0].ID_ALTA, validarIdEmpresa(idEmpresa)
    );
  }
  return pedidosRepository.obtenerProveedoresPorAltas(
    altas.map(alta => alta.ID_ALTA),
    validarIdEmpresa(idEmpresa)
  );
}

async function validarProveedorDelAlta(idAlta, codigoProveedor, idEmpresa, accesoEmpresa) {
  const alta = await validarAltaDisponible(idAlta, idEmpresa, accesoEmpresa);

  const codigo = texto(codigoProveedor);

  if (!codigo) {
    throw new Error('Debe seleccionar un proveedor.');
  }

  const proveedores = await pedidosRepository
    .obtenerProveedoresPorAlta(alta.ID_ALTA, alta.ID_EMPRESA);

  const proveedor = proveedores.find(
    item => texto(item.CODIGO_PROVEEDOR) === codigo
  );

  if (!proveedor) {
    throw new Error(
      'El proveedor seleccionado no pertenece al Alta o no posee productos habilitados.'
    );
  }

  return {
    alta,
    proveedor,
  };
}

/* ============================================================
   PRODUCTOS DISPONIBLES
   ============================================================ */

async function obtenerProductosDisponibles(idAlta, codigoProveedor, idEmpresa, accesoEmpresa) {
  const { alta, proveedor } = await validarProveedorDelAlta(
    idAlta,
    codigoProveedor,
    idEmpresa,
    accesoEmpresa
  );

  const productos = await pedidosRepository
    .obtenerProductosDisponibles(
      alta.ID_ALTA,
      proveedor.CODIGO_PROVEEDOR,
      alta.ID_EMPRESA
    );

  return productos.map(producto => {
    const tipo = normalizarTipoProducto(
      producto.TIPO_PRODUCTO_DETALLE
    );

    const talleCurva =
      tipo === 'MODULO'
        ? texto(producto.DETALLE_MODULO)
        : texto(producto.DETALLE_TALLE);

    const parametrosImagen = new URLSearchParams({
      idAlta: texto(producto.ID_ALTA),
      ano: texto(producto.CODIGO_ANO),
      temporada: texto(producto.CODIGO_TEMPORADA),
      modelo: texto(producto.CODIGO_MODELO),
      color: texto(producto.CODIGO_COLOR),
    });
    if (!texto(producto.ID_ALTA)) parametrosImagen.delete('idAlta');

    return {
      ...producto,
      TALLE_CURVA: talleCurva,
      URL_IMAGEN: `/api/imagenes/archivo?${parametrosImagen.toString()}`,
    };
  });
}

async function obtenerProductosDisponiblesPorAltas(idsAltas, codigoProveedor, idEmpresa, accesoEmpresa) {
  const altas = await validarAltasDisponibles(idsAltas, idEmpresa, accesoEmpresa);
  const codigo = texto(codigoProveedor);
  if (!codigo) throw new Error('Debe seleccionar un proveedor.');

  if (altas.length === 1) {
    return obtenerProductosDisponibles(
      altas[0].ID_ALTA, codigo, idEmpresa, accesoEmpresa
    );
  }

  const proveedores = await pedidosRepository.obtenerProveedoresPorAltas(
    altas.map(alta => alta.ID_ALTA),
    validarIdEmpresa(idEmpresa)
  );
  if (!proveedores.some(item => texto(item.CODIGO_PROVEEDOR) === codigo)) {
    throw new Error('El proveedor seleccionado no posee productos en las Altas elegidas.');
  }

  const productos = await pedidosRepository.obtenerProductosDisponiblesPorAltas(
    altas.map(alta => alta.ID_ALTA), codigo, validarIdEmpresa(idEmpresa)
  );
  return productos.map(producto => {
    const tipo = normalizarTipoProducto(producto.TIPO_PRODUCTO_DETALLE);
    const parametrosImagen = new URLSearchParams({
      idAlta: texto(producto.ID_ALTA),
      ano: texto(producto.CODIGO_ANO), temporada: texto(producto.CODIGO_TEMPORADA),
      modelo: texto(producto.CODIGO_MODELO), color: texto(producto.CODIGO_COLOR)
    });
    if (!texto(producto.ID_ALTA)) parametrosImagen.delete('idAlta');
    return {
      ...producto,
      TALLE_CURVA: tipo === 'MODULO' ? texto(producto.DETALLE_MODULO) : texto(producto.DETALLE_TALLE),
      URL_IMAGEN: `/api/imagenes/archivo?${parametrosImagen.toString()}`
    };
  });
}

async function obtenerResumenModelosAlta(idAlta, idEmpresa, accesoEmpresa) {
  const alta = await validarAltaDisponible(idAlta, idEmpresa, accesoEmpresa);
  const filas = await pedidosRepository.obtenerResumenModelosAlta(
    alta.ID_ALTA,
    alta.ID_EMPRESA
  );

  return filas.map(fila => {
    const tipo = normalizarTipoProducto(fila.TIPO_PRODUCTO_DETALLE);
    return {
      ...fila,
      CURVA_TALLE: tipo === 'MODULO'
        ? texto(fila.DETALLE_MODULO || fila.CODIGO_MODULO)
        : texto(fila.DETALLE_TALLE || fila.CODIGO_TALLE),
      CANTIDAD_REFERENCIA: tipo === 'MODULO' ? Number(fila.PARES || 0) : 1,
      UNIDAD_REFERENCIA: tipo === 'MODULO' ? 'PARES' : 'UNIDAD'
    };
  });
}

/* ============================================================
   VALIDAR PRODUCTO INDIVIDUAL
   ============================================================ */

async function validarProductoDisponible(
  idAlta,
  codigoProveedor,
  idProducto,
  idEmpresa,
  accesoEmpresa
) {
  const id = Number(idProducto);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_PRODUCTO inválido.');
  }

  const productos = await obtenerProductosDisponibles(
    idAlta,
    codigoProveedor,
    idEmpresa,
    accesoEmpresa
  );

  const producto = productos.find(
    item => Number(item.ID_PRODUCTO) === id
  );

  if (!producto) {
    throw new Error(
      'El producto no está habilitado para el Alta y proveedor seleccionados.'
    );
  }

  return producto;
}

/* ============================================================
   PREPARAR CABECERA DEL PEDIDO
   - Todavía no inserta en SQL.
   - Centraliza las reglas previas a la creación.
   ============================================================ */

async function prepararCabeceraPedido(datos = {}, idEmpresa, accesoEmpresa, usuarioAutenticado) {
  const idsAltas = validarIdsAltas(datos.idsAltas ?? datos.idAlta);
  const empresa = validarIdEmpresa(idEmpresa);

  const numeroOrden = texto(datos.numeroOrden);

  if (!numeroOrden) {
    throw new Error('El número de orden es obligatorio.');
  }

  if (numeroOrden.length > 50) {
    throw new Error('El número de orden supera los 50 caracteres.');
  }

  const moneda = normalizarMoneda(datos.moneda);

  const observaciones = texto(datos.observaciones);

  if (observaciones.length > 500) {
    throw new Error('Las observaciones superan los 500 caracteres.');
  }

  const usuarioCreacion = texto(usuarioAutenticado) || 'SISTEMA';

  if (usuarioCreacion.length > 100) {
    throw new Error('El usuario de creación supera los 100 caracteres.');
  }

  const altas = await validarAltasDisponibles(idsAltas, empresa, accesoEmpresa);
  const marcas = [...new Set(altas.map(item => texto(item.CODIGO_MARCA)))];
  if (marcas.length > 1) {
    throw new Error('Las Altas seleccionadas deben pertenecer a la misma marca para conservar un único destino de exportación.');
  }
  const proveedores = await obtenerProveedoresPorAltas(idsAltas, empresa, accesoEmpresa);
  const proveedor = proveedores.find(item =>
    texto(item.CODIGO_PROVEEDOR) === texto(datos.codigoProveedor)
  );
  if (!proveedor) throw new Error('El proveedor seleccionado no posee productos en las Altas elegidas.');
  const alta = altas[0];

  return {
    ID_EMPRESA: alta.ID_EMPRESA,
    ID_ALTA: alta.ID_ALTA,
    IDS_ALTAS: altas.map(item => item.ID_ALTA),
    CODIGO_ALTA: altas.length > 1
      ? `${alta.CODIGO_ALTA}-MAS-${altas.length - 1}`
      : alta.CODIGO_ALTA,
    CODIGOS_ALTAS: altas.map(item => item.CODIGO_ALTA),
    TIPO_PRODUCTO: alta.TIPO_PRODUCTO,

    CODIGO_PROVEEDOR: proveedor.CODIGO_PROVEEDOR,
    DETALLE_PROVEEDOR: proveedor.DETALLE_PROVEEDOR,

    NUMERO_ORDEN: numeroOrden,
    MONEDA: moneda,
    ESTADO: 'BORRADOR',

    OBSERVACIONES: observaciones || null,
    USUARIO_CREACION: usuarioCreacion,
  };
}

/* ============================================================
   CODIGO PEDIDO

   Formato:
   PED-000001-PROVEEDOR-ORDEN-ALTA

   Ejemplo:
   PED-000001-80005-1258-ALT-000023
   ============================================================ */

function generarCodigoPedido({
  idPedido,
  codigoProveedor,
  numeroOrden,
  codigoAlta,
}) {
  const id = validarIdPedido(idPedido);

  const correlativo = String(id).padStart(6, '0');

  const proveedor = sanitizarComponenteCodigo(
    codigoProveedor,
    'CODIGO_PROVEEDOR'
  );

  const orden = sanitizarComponenteCodigo(
    numeroOrden,
    'NUMERO_ORDEN'
  );

  const alta = sanitizarComponenteCodigo(
    codigoAlta,
    'CODIGO_ALTA'
  );

  const codigo = `PED-${correlativo}-${proveedor}-${orden}-${alta}`;

  if (codigo.length > 100) {
    throw new Error(
      'El código generado del pedido supera los 100 caracteres.'
    );
  }

  return codigo;
}


/* ============================================================
   CREAR PEDIDO - CABECERA
   - Valida Alta + proveedor + datos de cabecera.
   - La creación y generación del código se hacen dentro de
     una única transacción SQL en el repository.
   ============================================================ */
async function crearPedido(datos = {}, idEmpresa, accesoEmpresa, usuarioAutenticado) {
  const cabecera = await prepararCabeceraPedido(datos, idEmpresa, accesoEmpresa, usuarioAutenticado);

  /*
   * Validación anticipada para devolver un mensaje claro al usuario.
   * El repository vuelve a comprobarlo dentro de la transacción.
   */
  const duplicado = await pedidosRepository.buscarPedidoDuplicadoActivo(
    cabecera.ID_ALTA,
    cabecera.CODIGO_PROVEEDOR,
    cabecera.NUMERO_ORDEN,
    cabecera.ID_EMPRESA
  );

  if (duplicado) {
    const referencia = duplicado.CODIGO_PEDIDO || `ID ${duplicado.ID_PEDIDO}`;
    throw new Error(
      `Ya existe un pedido activo para esta Alta, proveedor y número de orden (${referencia}).`
    );
  }

  return pedidosRepository.crearPedido(
    cabecera,
    generarCodigoPedido
  );
}


/* ============================================================
   UTILIDADES NUMERICAS DEL DETALLE
   ============================================================ */
function numeroNoNegativo(valor, nombre) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${nombre} debe ser un número mayor o igual a cero.`);
  }

  return numero;
}

function enteroPositivo(valor, nombre) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${nombre} debe ser un número entero mayor a cero.`);
  }

  return numero;
}

function redondear4(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 10000) / 10000;
}

/* ============================================================
   LISTAR PEDIDOS
   ============================================================ */
async function listarPedidos(idEmpresa, accesoEmpresa) {
  const pedidos = await pedidosRepository.listarPedidos(
    validarIdEmpresa(idEmpresa)
  );
  const evaluados = await Promise.all(pedidos.map(async pedido => {
    if (!accesoPermiteAlta(accesoEmpresa, pedido)) return null;

    const altasAsociadas = await pedidosRepository.obtenerAltasPorPedido(
      pedido.ID_PEDIDO,
      pedido.ID_EMPRESA
    );
    const alcances = altasAsociadas.length ? altasAsociadas : [pedido];
    return alcances.every(alta => accesoPermiteAlta(accesoEmpresa, alta))
      ? pedido
      : null;
  }));

  return evaluados.filter(Boolean);
}


/* ============================================================
   OBTENER / VALIDAR PEDIDO BORRADOR
   ============================================================ */
async function obtenerPedidoPorId(idPedido, idEmpresa) {
  const id = validarIdPedido(idPedido);
  const empresa = validarIdEmpresa(idEmpresa);
  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);
  if (!pedido) return null;
  let altas = [];
  if (Array.isArray(pedido.ALTAS_ASOCIADAS)) {
    altas = pedido.ALTAS_ASOCIADAS;
  } else if (Array.isArray(pedido.IDS_ALTAS)) {
    altas = pedido.IDS_ALTAS.map((idAlta, indice) => ({
      ID_ALTA: idAlta,
      CODIGO_ALTA: pedido.CODIGOS_ALTAS?.[indice] || (indice === 0 ? pedido.CODIGO_ALTA : null),
      CODIGO_ANO: indice === 0 ? pedido.CODIGO_ANO : null,
      CODIGO_TEMPORADA: indice === 0 ? pedido.CODIGO_TEMPORADA : null
    }));
  } else if (pedido.ID_ALTA) {
    altas = await pedidosRepository.obtenerAltasPorPedido(id, empresa);
  }
  if (!altas.length && pedido.ID_ALTA) altas = [{
    ID_ALTA: pedido.ID_ALTA,
    CODIGO_ALTA: pedido.CODIGO_ALTA,
    CODIGO_ANO: pedido.CODIGO_ANO,
    CODIGO_TEMPORADA: pedido.CODIGO_TEMPORADA
  }];
  return {
    ...pedido,
    ALTAS_ASOCIADAS: altas,
    IDS_ALTAS: altas.map(alta => alta.ID_ALTA),
    CODIGOS_ALTAS: altas.map(alta => alta.CODIGO_ALTA).filter(Boolean).join(', ')
  };
}

async function validarPedidoBorrador(idPedido, idEmpresa) {
  const id = validarIdPedido(idPedido);
  const pedido = await obtenerPedidoPorId(id, validarIdEmpresa(idEmpresa));

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  if (pedido.ESTADO !== 'BORRADOR') {
    throw new Error(
      `El pedido está en estado ${pedido.ESTADO}. Solamente se puede modificar en BORRADOR.`
    );
  }

  return pedido;
}

/* ============================================================
   PREPARAR PRODUCTO DEL PEDIDO

   Reglas:
   - El producto se valida usando SIEMPRE Alta + proveedor de
     la cabecera del pedido, no valores enviados por el cliente.
   - FOB se carga por par.
   - Cantidad se carga en pares.
   - MODULO: cantidad pares / pares módulo debe ser entero.
   - PAR_SUELTO: cantidad módulos queda NULL.
   - ADICIONAL es un valor por par, separado del FOB.\n   - TOTAL_ADICIONAL = CANTIDAD_PARES × ADICIONAL.
   ============================================================ */
async function prepararProductoPedido(idPedido, datos = {}, idEmpresa, accesoEmpresa) {
  const pedido = await validarPedidoBorrador(idPedido, idEmpresa);

  const idProducto = Number(datos.idProducto);

  if (!Number.isInteger(idProducto) || idProducto <= 0) {
    throw new Error('ID_PRODUCTO inválido.');
  }

  const productos = await obtenerProductosDisponiblesPorAltas(
    pedido.IDS_ALTAS,
    pedido.CODIGO_PROVEEDOR,
    pedido.ID_EMPRESA,
    accesoEmpresa
  );
  const producto = productos.find(item => Number(item.ID_PRODUCTO) === idProducto);
  if (!producto) {
    throw new Error('El producto no está habilitado para las Altas y proveedor seleccionados.');
  }

  const duplicado = await pedidosRepository.buscarProductoEnPedido(
    pedido.ID_PEDIDO,
    idProducto
  );

  if (duplicado) {
    throw new Error('El producto ya fue agregado a este pedido.');
  }

  const cantidadPares = enteroPositivo(
    datos.cantidadPares,
    'La cantidad de pares'
  );

  const precioFobPar = numeroNoNegativo(
    datos.precioFobPar,
    'El precio FOB por par'
  );

  const adicional = numeroNoNegativo(
    datos.adicional === undefined || datos.adicional === null || datos.adicional === ''
      ? 0
      : datos.adicional,
    'El adicional'
  );

  const observaciones = texto(datos.observaciones);

  if (observaciones.length > 500) {
    throw new Error('Las observaciones del producto superan los 500 caracteres.');
  }

  const tipoProducto = normalizarTipoProducto(
    producto.TIPO_PRODUCTO_DETALLE
  );

  const { paresModulo, cantidadModulos } = calcularCantidadesPedido(
    tipoProducto,
    cantidadPares,
    producto.PARES
  );

  const totalFob = redondear4(
    cantidadPares * precioFobPar
  );

  const totalAdicional = redondear4(
    cantidadPares * adicional
  );

  const totalProducto = redondear4(
    totalFob + totalAdicional
  );

  return {
    ID_EMPRESA: pedido.ID_EMPRESA,
    ID_PEDIDO: pedido.ID_PEDIDO,
    ID_ALTA: producto.ID_ALTA,
    ID_PRODUCTO: producto.ID_PRODUCTO,

    TIPO_PRODUCTO: tipoProducto,

    CODIGO_ALFA: texto(producto.CODIGO_ALFA),
    CODIGO_ERP: texto(producto.CODIGO_ERP) || null,
    CODIGO_EAN: texto(producto.CODIGO_EAN) || null,

    CODIGO_MODELO: texto(producto.CODIGO_MODELO) || null,
    DETALLE_MODELO: texto(producto.DETALLE_MODELO) || null,

    CODIGO_COLOR: texto(producto.CODIGO_COLOR) || null,
    DETALLE_COLOR: texto(producto.DETALLE_COLOR) || null,

    DETALLE_PRODUCTO: texto(producto.DETALLE_PRODUCTO) || null,

    CODIGO_TALLE: texto(producto.CODIGO_TALLE) || null,
    DETALLE_TALLE: texto(producto.DETALLE_TALLE) || null,

    CODIGO_MODULO: texto(producto.CODIGO_MODULO) || null,
    DETALLE_MODULO: texto(producto.DETALLE_MODULO) || null,

    DETALLE_EDAD: texto(producto.DETALLE_EDAD) || null,

    PARES_MODULO: paresModulo,
    CANTIDAD_PARES: cantidadPares,
    CANTIDAD_MODULOS: cantidadModulos,

    PRECIO_FOB_PAR: redondear4(precioFobPar),
    TOTAL_FOB: totalFob,
    ADICIONAL: redondear4(adicional),
    TOTAL_PRODUCTO: totalProducto,

    OBSERVACIONES: observaciones || null,
  };
}

/* ============================================================
   AGREGAR PRODUCTO AL PEDIDO
   ============================================================ */
async function agregarProductoPedido(idPedido, datos = {}, idEmpresa, accesoEmpresa) {
  const detalle = await prepararProductoPedido(idPedido, datos, idEmpresa, accesoEmpresa);
  return pedidosRepository.agregarProductoPedido(detalle);
}



/* ============================================================
   VALIDAR ID DEL RENGLON
   ============================================================ */
function validarIdPedidoDetalle(idPedidoDetalle) {
  const id = Number(idPedidoDetalle);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ID_PEDIDO_DETALLE inválido.');
  }

  return id;
}

/* ============================================================
   LISTAR DETALLE DEL PEDIDO
   - Puede consultarse en cualquier estado.
   ============================================================ */
async function listarDetallePedido(idPedido, idEmpresa) {
  const pedido = await obtenerPedidoPorId(idPedido, idEmpresa);

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  const detalle = await pedidosRepository.listarDetallePedido(
    pedido.ID_PEDIDO,
    pedido.ID_EMPRESA
  );

  return detalle.map(item => {
    const parametrosImagen = new URLSearchParams({
      idAlta: texto(item.ID_ALTA || pedido.ID_ALTA),
      ano: texto(item.CODIGO_ANO || pedido.CODIGO_ANO),
      temporada: texto(item.CODIGO_TEMPORADA || pedido.CODIGO_TEMPORADA),
      modelo: texto(item.CODIGO_MODELO),
      color: texto(item.CODIGO_COLOR),
    });
    if (!texto(item.ID_ALTA || pedido.ID_ALTA)) parametrosImagen.delete('idAlta');

    return {
      ...item,
      TALLE_CURVA:
        normalizarTipoProducto(item.TIPO_PRODUCTO) === 'MODULO'
          ? texto(item.DETALLE_MODULO)
          : texto(item.DETALLE_TALLE),
      URL_IMAGEN: `/api/imagenes/archivo?${parametrosImagen.toString()}`,
    };
  });
}

/* ============================================================
   PREPARAR ACTUALIZACION DE UN PRODUCTO
   - No permite reemplazar ID_PRODUCTO ni snapshot.
   - Recalcula siempre cantidades y totales en servidor.
   ============================================================ */
async function prepararActualizacionDetalle(
  idPedido,
  idPedidoDetalle,
  datos = {},
  idEmpresa
) {
  const pedido = await validarPedidoBorrador(idPedido, idEmpresa);
  const detalleId = validarIdPedidoDetalle(idPedidoDetalle);

  const detalleActual = await pedidosRepository
    .obtenerDetallePedidoPorId(
      pedido.ID_PEDIDO,
      detalleId
    );

  if (!detalleActual) {
    throw new Error('El producto no existe dentro del pedido.');
  }

  const cantidadPares = enteroPositivo(
    datos.cantidadPares,
    'La cantidad de pares'
  );

  const precioFobPar = numeroNoNegativo(
    datos.precioFobPar,
    'El precio FOB por par'
  );

  const adicional = numeroNoNegativo(
    datos.adicional === undefined ||
      datos.adicional === null ||
      datos.adicional === ''
      ? 0
      : datos.adicional,
    'El adicional'
  );

  const observaciones = texto(datos.observaciones);

  if (observaciones.length > 500) {
    throw new Error(
      'Las observaciones del producto superan los 500 caracteres.'
    );
  }

  const tipoProducto = normalizarTipoProducto(
    detalleActual.TIPO_PRODUCTO
  );

  let paresModulo = null;
  let cantidadModulos = null;

  if (tipoProducto === 'MODULO') {
    paresModulo = enteroPositivo(
      detalleActual.PARES_MODULO,
      'Los pares del módulo'
    );

    if (cantidadPares % paresModulo !== 0) {
      throw new Error(
        `La cantidad de pares (${cantidadPares}) no es divisible exactamente ` +
        `por los ${paresModulo} pares del módulo.`
      );
    }

    cantidadModulos = cantidadPares / paresModulo;
  } else if (tipoProducto === 'PAR_SUELTO') {
    paresModulo = null;
    cantidadModulos = null;
  } else {
    throw new Error(
      `Tipo de producto no habilitado: ${tipoProducto}.`
    );
  }

  const totalFob = redondear4(
    cantidadPares * precioFobPar
  );

  const totalAdicional = redondear4(
    cantidadPares * adicional
  );

  const totalProducto = redondear4(
    totalFob + totalAdicional
  );

  return {
    ID_PEDIDO: pedido.ID_PEDIDO,
    ID_PEDIDO_DETALLE: detalleId,
    PARES_MODULO: paresModulo,
    CANTIDAD_PARES: cantidadPares,
    CANTIDAD_MODULOS: cantidadModulos,
    PRECIO_FOB_PAR: redondear4(precioFobPar),
    TOTAL_FOB: totalFob,
    ADICIONAL: redondear4(adicional),
    TOTAL_PRODUCTO: totalProducto,
    OBSERVACIONES: observaciones || null,
  };
}

/* ============================================================
   ACTUALIZAR PRODUCTO DEL PEDIDO
   ============================================================ */
async function actualizarProductoPedido(
  idPedido,
  idPedidoDetalle,
  datos = {},
  idEmpresa
) {
  const preparado = await prepararActualizacionDetalle(
    idPedido,
    idPedidoDetalle,
    datos,
    idEmpresa
  );

  return pedidosRepository.actualizarDetallePedido(
    preparado
  );
}

/* ============================================================
   ELIMINAR PRODUCTO DEL PEDIDO
   ============================================================ */
async function eliminarProductoPedido(
  idPedido,
  idPedidoDetalle,
  idEmpresa
) {
  const pedido = await validarPedidoBorrador(idPedido, idEmpresa);
  const detalleId = validarIdPedidoDetalle(idPedidoDetalle);

  const detalle = await pedidosRepository
    .obtenerDetallePedidoPorId(
      pedido.ID_PEDIDO,
      detalleId
    );

  if (!detalle) {
    throw new Error('El producto no existe dentro del pedido.');
  }

  return pedidosRepository.eliminarDetallePedido(
    pedido.ID_PEDIDO,
    detalleId
  );
}


/* ============================================================
   VALIDAR PEDIDO COMPLETO

   Reglas:
   - Solo BORRADOR.
   - Debe tener al menos un producto.
   - Cantidades mayores a cero.
   - FOB por par mayor a cero al momento de validar.
   - ADICIONAL mayor o igual a cero.
   - MODULO: cantidad pares / pares módulo debe ser entero.
   - Los totales se vuelven a calcular y comparar.
   - El cambio a VALIDADO se realiza transaccionalmente en SQL.
   ============================================================ */
async function validarPedido(idPedido, datos = {}, idEmpresa, usuarioAutenticado) {
  const pedido = await validarPedidoBorrador(idPedido, idEmpresa);

  const usuarioValidacion = texto(usuarioAutenticado) || 'SISTEMA';

  if (usuarioValidacion.length > 100) {
    throw new Error('El usuario de validación supera los 100 caracteres.');
  }

  const detalles = await pedidosRepository.listarDetallePedido(
    pedido.ID_PEDIDO,
    pedido.ID_EMPRESA
  );

  if (!detalles || detalles.length === 0) {
    throw new Error('El pedido no contiene productos para validar.');
  }

  for (const detalle of detalles) {
    const detalleId = detalle.ID_PEDIDO_DETALLE;
    const tipo = normalizarTipoProducto(detalle.TIPO_PRODUCTO);
    const codigoAlfa = texto(detalle.CODIGO_ALFA);
    const detalleProducto = texto(detalle.DETALLE_PRODUCTO);

    if (!codigoAlfa) {
      throw new Error(`El detalle ${detalleId} no posee CODIGO_ALFA.`);
    }

    if (!detalleProducto) {
      throw new Error(`El producto ${codigoAlfa} no posee descripción.`);
    }

    const cantidadPares = enteroPositivo(
      detalle.CANTIDAD_PARES,
      `La cantidad de pares del detalle ${detalleId}`
    );

    const precioFobPar = Number(detalle.PRECIO_FOB_PAR);

    if (!Number.isFinite(precioFobPar) || precioFobPar <= 0) {
      throw new Error(
        `El producto ${detalle.DETALLE_PRODUCTO || detalle.CODIGO_ALFA || detalleId} ` +
        'debe tener un precio FOB por par mayor a cero antes de validar.'
      );
    }

    const adicional = numeroNoNegativo(
      detalle.ADICIONAL,
      `El adicional por par del detalle ${detalleId}`
    );

    if (tipo === 'MODULO') {
      const paresModulo = enteroPositivo(
        detalle.PARES_MODULO,
        `Los pares del módulo del detalle ${detalleId}`
      );

      if (cantidadPares % paresModulo !== 0) {
        throw new Error(
          `El producto ${detalle.DETALLE_PRODUCTO || detalle.CODIGO_ALFA || detalleId} ` +
          `tiene ${cantidadPares} pares y el módulo contiene ${paresModulo}; ` +
          'la división debe dar un número entero.'
        );
      }

      const cantidadModulosEsperada = cantidadPares / paresModulo;

      if (Number(detalle.CANTIDAD_MODULOS) !== cantidadModulosEsperada) {
        throw new Error(
          `La cantidad de módulos del detalle ${detalleId} no coincide con la cantidad de pares.`
        );
      }
    } else if (tipo === 'PAR_SUELTO') {
      if (detalle.CANTIDAD_MODULOS !== null) {
        throw new Error(
          `El detalle ${detalleId} es PAR_SUELTO y no debe tener cantidad de módulos.`
        );
      }
    } else {
      throw new Error(
        `El detalle ${detalleId} posee un tipo de producto no habilitado.`
      );
    }

    const totalFobEsperado = redondear4(
      cantidadPares * precioFobPar
    );

    const totalAdicionalEsperado = redondear4(
      cantidadPares * adicional
    );

    const totalProductoEsperado = redondear4(
      totalFobEsperado + totalAdicionalEsperado
    );

    if (Math.abs(Number(detalle.TOTAL_FOB) - totalFobEsperado) > 0.0001) {
      throw new Error(
        `El TOTAL_FOB del detalle ${detalleId} no coincide con el cálculo esperado.`
      );
    }

    if (Math.abs(Number(detalle.TOTAL_PRODUCTO) - totalProductoEsperado) > 0.0001) {
      throw new Error(
        `El TOTAL_PRODUCTO del detalle ${detalleId} no coincide con el cálculo esperado.`
      );
    }
  }

  return pedidosRepository.marcarPedidoValidado(
    pedido.ID_PEDIDO,
    usuarioValidacion
  );
}


/* ============================================================
   ANULAR PEDIDO

   Reglas:
   - MOTIVO_ANULACION es obligatorio.
   - BORRADOR  -> ANULADO.
   - VALIDADO  -> ANULADO.
   - SINCRONIZADO no puede anularse.
   - ANULADO no vuelve a modificarse.
   ============================================================ */
async function anularPedido(idPedido, datos = {}, idEmpresa, usuarioAutenticado) {
  const id = validarIdPedido(idPedido);

  const motivo = texto(
    datos.motivoAnulacion ||
    datos.motivo ||
    datos.MOTIVO_ANULACION
  );

  if (!motivo) {
    throw new Error('El motivo de anulación es obligatorio.');
  }

  if (motivo.length > 500) {
    throw new Error('El motivo de anulación supera los 500 caracteres.');
  }

  const usuarioAnulacion = texto(
    usuarioAutenticado
  ) || 'SISTEMA';

  if (usuarioAnulacion.length > 100) {
    throw new Error('El usuario de anulación supera los 100 caracteres.');
  }

  const pedido = await pedidosRepository.obtenerPedidoPorId(id, validarIdEmpresa(idEmpresa));

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  const estado = texto(pedido.ESTADO).toUpperCase();

  if (estado === 'SINCRONIZADO') {
    throw new Error('Un pedido SINCRONIZADO no puede ser anulado.');
  }

  if (estado === 'ANULADO') {
    throw new Error('El pedido ya se encuentra ANULADO.');
  }

  if (!['BORRADOR', 'VALIDADO'].includes(estado)) {
    throw new Error(
      `El pedido está en estado ${pedido.ESTADO} y no puede ser anulado.`
    );
  }

  return pedidosRepository.marcarPedidoAnulado(
    id,
    usuarioAnulacion,
    motivo
  );
}


/* ============================================================
   EXPORTAR PEDIDO VALIDADO A EXCEL

   Formato de salida compatible con la otra aplicación:
   cod_alfa | descripcion | price | quantity | po | adicionales

   Reglas:
   - Solo pedidos VALIDADO.
   - MODULO:
       quantity    = CANTIDAD_MODULOS
       price       = PRECIO_FOB_PAR * PARES_MODULO
       adicionales = ADICIONAL * PARES_MODULO
   - PAR_SUELTO:
       quantity    = CANTIDAD_PARES
       price       = PRECIO_FOB_PAR
       adicionales = ADICIONAL
   ============================================================ */


/* ============================================================
   TRAZABILIDAD DE EXPORTACIONES
   ============================================================ */
async function registrarExportacionGenerada(
  idPedido,
  idEmpresa,
  tipoExportacion,
  nombreArchivo,
  cantidadRegistros,
  usuarioExportacion = 'SISTEMA'
) {
  return pedidosRepository.registrarExportacionPedido({
    ID_EMPRESA: validarIdEmpresa(idEmpresa),
    ID_PEDIDO: validarIdPedido(idPedido),
    TIPO_EXPORTACION: texto(tipoExportacion),
    NOMBRE_ARCHIVO: texto(nombreArchivo),
    USUARIO_EXPORTACION: texto(usuarioExportacion) || 'SISTEMA',
    CANTIDAD_REGISTROS: Number(cantidadRegistros || 0),
    ESTADO: 'OK',
    OBSERVACIONES: null,
  });
}

async function listarExportacionesPedido(idPedido, idEmpresa) {
  const id = validarIdPedido(idPedido);
  const empresa = validarIdEmpresa(idEmpresa);
  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);
  if (!pedido) throw new Error('Pedido no encontrado.');
  return pedidosRepository.listarExportacionesPedido(id, empresa);
}

function evaluarDestinosExportacionPedido(idEmpresa, codigoMarca, configuracion) {
  const rutas = {
    PEDIDO_EXCEL: texto(configuracion?.RUTA_PEDIDO_EXCEL),
    MASTER_DATA_APP: texto(configuracion?.RUTA_MASTER_DATA_APP),
    PREC_FOB: texto(configuracion?.RUTA_PREC_FOB),
  };
  const faltantes = Object.entries(rutas)
    .filter(([, ruta]) => !ruta)
    .map(([tipo]) => tipo);
  const activa = Boolean(configuracion?.ACTIVA);
  const configurada = activa && faltantes.length === 0;

  return {
    idEmpresa,
    codigoMarca: texto(codigoMarca),
    activa,
    configurada,
    rutas,
    faltantes,
    mensaje: configurada
      ? 'Los destinos de exportación del Pedido están configurados.'
      : 'Los destinos del Pedido no están habilitados. No se realizará ningún envío ni copia.',
  };
}

async function obtenerDestinosExportacionPedido(idPedido, idEmpresa) {
  const id = validarIdPedido(idPedido);
  const empresa = validarIdEmpresa(idEmpresa);
  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);

  if (!pedido) throw new Error('Pedido no encontrado.');

  const codigoMarca = texto(pedido.CODIGO_MARCA);
  const configuracion = codigoMarca
    ? await pedidosRepository.obtenerConfiguracionExportacionPedido(empresa, codigoMarca)
    : null;
  return evaluarDestinosExportacionPedido(empresa, codigoMarca, configuracion);
}

async function enviarArchivoPedidoFTP(idPedido, idEmpresa, tipoExportacion, resultado) {
  const destinos = await obtenerDestinosExportacionPedido(idPedido, idEmpresa);
  const tipo = texto(tipoExportacion).toUpperCase();
  const rutaFTP = texto(destinos.rutas[tipo]);

  if (!destinos.configurada || !rutaFTP) {
    throw new Error(
      `No se puede enviar ${tipo}: la configuración de destinos para ` +
      `ID_EMPRESA=${destinos.idEmpresa} / MARCA=${destinos.codigoMarca} no está completa y activa.`
    );
  }

  const carpetaLocal = path.join(
    process.env.EXPORT_PATH || path.join(process.cwd(), 'salidas'),
    'pedidos',
    String(destinos.idEmpresa),
    String(validarIdPedido(idPedido))
  );
  await fs.promises.mkdir(carpetaLocal, { recursive: true });
  const rutaLocal = path.join(carpetaLocal, resultado.nombreArchivo);
  await fs.promises.writeFile(rutaLocal, resultado.buffer);

  return ftpService.subirArchivo(
    rutaLocal,
    resultado.nombreArchivo,
    resultado.nombreArchivo,
    rutaFTP
  );
}

function limpiarNombreArchivoPedido(valor) {
  return texto(valor)
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

async function exportarPedidoExcel(idPedido, idEmpresa, usuarioAutenticado) {
  const id = validarIdPedido(idPedido);

  const empresa = validarIdEmpresa(idEmpresa);

  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  const estado = texto(pedido.ESTADO).toUpperCase();

  if (estado !== 'VALIDADO') {
    throw new Error(
      `El pedido está en estado ${pedido.ESTADO}. Solamente se pueden exportar pedidos VALIDADO.`
    );
  }

  const detalles = await pedidosRepository.listarDetallePedido(id, empresa);

  if (!detalles || detalles.length === 0) {
    throw new Error('El pedido no contiene productos para exportar.');
  }

  const filas = detalles.map(detalle => {
    const tipo = normalizarTipoProducto(detalle.TIPO_PRODUCTO);
    const precioFobPar = Number(detalle.PRECIO_FOB_PAR || 0);
    const adicionalPar = Number(detalle.ADICIONAL || 0);

    let quantity;
    let price;
    let adicionales;

    if (tipo === 'MODULO') {
      const paresModulo = enteroPositivo(
        detalle.PARES_MODULO,
        `Los pares del módulo del detalle ${detalle.ID_PEDIDO_DETALLE}`
      );

      quantity = enteroPositivo(
        detalle.CANTIDAD_MODULOS,
        `La cantidad de módulos del detalle ${detalle.ID_PEDIDO_DETALLE}`
      );

      price = redondear4(precioFobPar * paresModulo);
      adicionales = redondear4(adicionalPar * paresModulo);
    } else if (tipo === 'PAR_SUELTO') {
      quantity = enteroPositivo(
        detalle.CANTIDAD_PARES,
        `La cantidad de pares del detalle ${detalle.ID_PEDIDO_DETALLE}`
      );

      price = redondear4(precioFobPar);
      adicionales = redondear4(adicionalPar);
    } else {
      throw new Error(
        `Tipo de producto no habilitado para exportación: ${detalle.TIPO_PRODUCTO}.`
      );
    }

    return {
      cod_alfa: texto(detalle.CODIGO_ALFA),
      descripcion: texto(detalle.DETALLE_PRODUCTO),
      price,
      quantity,
      po: texto(pedido.NUMERO_ORDEN),
      adicionales,
    };
  });

  const hoja = XLSX.utils.json_to_sheet(filas, {
    header: [
      'cod_alfa',
      'descripcion',
      'price',
      'quantity',
      'po',
      'adicionales',
    ],
  });

  hoja['!cols'] = [
    { wch: 22 },
    { wch: 60 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');

  const buffer = XLSX.write(libro, {
    type: 'buffer',
    bookType: 'xlsx',
  });

  const orden = limpiarNombreArchivoPedido(pedido.NUMERO_ORDEN) || `PEDIDO_${id}`;
  const proveedor =
    limpiarNombreArchivoPedido(pedido.DETALLE_PROVEEDOR) ||
    limpiarNombreArchivoPedido(pedido.CODIGO_PROVEEDOR) ||
    'PROVEEDOR';

  const nombreArchivo = `PEDIDO_${orden}_${proveedor}.xlsx`;

  const envioFTP = await enviarArchivoPedidoFTP(
    id,
    empresa,
    'PEDIDO_EXCEL',
    { buffer, nombreArchivo }
  );

  await registrarExportacionGenerada(
    id,
    empresa,
    'PEDIDO_EXCEL',
    nombreArchivo,
    filas.length,
    usuarioAutenticado
  );

  return {
    buffer,
    nombreArchivo,
    cantidadRegistros: filas.length,
    envioFTP,
  };
}


/* ============================================================
   EXPORTAR MASTER_DATA_APP DEL PEDIDO VALIDADO

   Genera solamente los productos incluidos en el pedido.
   Mantiene exactamente las 24 columnas del archivo modelo.
   ============================================================ */
const MAPA_TALLES_MASTER = [
  ['T01', '01'], ['T02', '02'], ['T03', '03'], ['T04', '04'], ['T05', '05'],
  ['T06', '06'], ['T07', '07'], ['T08', '08'], ['T10', '10'], ['T12', '12'],
  ['T14', '14'], ['T15', '15'], ['T16', '16'], ['T17', '17'], ['T18', '18'],
  ['T19', '19'], ['T20', '20'], ['T21', '21'], ['T22', '22'], ['T23', '23'],
  ['T24', '24'], ['T25', '25'], ['T26', '26'], ['T27', '27'], ['T28', '28'],
  ['T29', '29'], ['T30', '30'], ['T31', '31'], ['T32', '32'], ['T33', '33'],
  ['T34', '34'], ['T35', '35'], ['T36', '36'], ['T37', '37'], ['T38', '38'],
  ['T385', '38.5'], ['T39', '39'], ['T395', '39.5'], ['T40', '40'], ['T405', '40.5'],
  ['T41', '41'], ['T415', '41.5'], ['T42', '42'], ['T425', '42.5'], ['T43', '43'],
  ['T435', '43.5'], ['T44', '44'], ['T445', '44.5'], ['T45', '45'], ['T455', '45.5'],
  ['T46', '46'], ['T47', '47'], ['T48', '48'], ['T49', '49'], ['T50', '50'],
  ['T_XS', 'XS'], ['T_S', 'S'], ['T_M', 'M'], ['T_L', 'L'], ['T_XL', 'XL'],
  ['T_2XL', '2XL'], ['T_3XL', '3XL'],
];

function obtenerCurvaMaster(detalle) {
  const tipo = normalizarTipoProducto(detalle.TIPO_PRODUCTO);

  if (tipo === 'PAR_SUELTO') {
    return {
      codigoCurva: texto(detalle.CODIGO_TALLE),
      curva: texto(detalle.DETALLE_TALLE),
      composicion: '1',
      modulo: 1,
    };
  }

  const activos = [];

  for (const [campo, talle] of MAPA_TALLES_MASTER) {
    const cantidad = Number(detalle[campo] || 0);
    if (cantidad > 0) {
      activos.push({ talle, cantidad });
    }
  }

  if (activos.length === 0) {
    return {
      codigoCurva: texto(detalle.CODIGO_MODULO_PEDIDO),
      curva: texto(detalle.DETALLE_MODULO_PEDIDO),
      composicion: '',
      modulo: Number(detalle.PARES_MODULO || 0),
    };
  }

  return {
    codigoCurva: texto(detalle.CODIGO_MODULO_PEDIDO),
    curva: `${activos[0].talle}-${activos[activos.length - 1].talle}`,
    composicion: activos.map(item => item.cantidad).join(','),
    modulo: Number(detalle.PARES_MODULO || 0),
  };
}

async function exportarMasterDataAppExcel(idPedido, idEmpresa, usuarioAutenticado) {
  const id = validarIdPedido(idPedido);
  const empresa = validarIdEmpresa(idEmpresa);

  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  const estado = texto(pedido.ESTADO).toUpperCase();
  if (estado !== 'VALIDADO') {
    throw new Error(
      `El pedido está en estado ${pedido.ESTADO}. Solamente se pueden exportar pedidos VALIDADO.`
    );
  }

  const detalles = await pedidosRepository.obtenerDatosMasterPedido(id, empresa);
  if (!detalles || detalles.length === 0) {
    throw new Error('El pedido no contiene productos para exportar al MASTER_DATA_APP.');
  }

  const filas = detalles.map(detalle => {
    const curva = obtenerCurvaMaster(detalle);

    return {
      cod_alfa: texto(detalle.CODIGO_ALFA),
      descripcion: texto(detalle.DETALLE_PRODUCTO),
      proveedor: texto(detalle.CODIGO_PROVEEDOR),
      nombre: texto(detalle.DETALLE_MARCA),
      imagen: [
        texto(detalle.CODIGO_ANO),
        texto(detalle.CODIGO_TEMPORADA),
        texto(detalle.CODIGO_MODELO),
        texto(detalle.CODIGO_COLOR),
      ].join(''),
      grupo: texto(detalle.DETALLE_GRUPO),
      subgrupo: texto(detalle.DETALLE_SUBGRUPO),
      linea: texto(detalle.DETALLE_LINEA),
      deporte: texto(detalle.DETALLE_DEPORTE),
      modelo: texto(detalle.DETALLE_MODELO),
      cod_mod: texto(detalle.CODIGO_MODELO),
      codigo_interno: texto(detalle.CODIGO_INTERNO_PRODUCTO),
      yy: Number(detalle.CODIGO_ANO),
      temporada: texto(detalle.DETALLE_TEMPORADA),
      pais: texto(detalle.DETALLE_PAIS),
      codigo_color: texto(detalle.CODIGO_COLOR),
      color: texto(detalle.DETALLE_COLOR),
      grupo_genero: texto(detalle.DETALLE_EDAD),
      genero: texto(detalle.SEXO),
      clasificacion: texto(detalle.DETALLE_CLASIFICACION),
      codigo_curva: curva.codigoCurva,
      curva: curva.curva,
      composicion_curva: curva.composicion,
      modulo: curva.modulo,
    };
  });

  const headers = [
    'cod_alfa', 'descripcion', 'proveedor', 'nombre', 'imagen', 'grupo',
    'subgrupo', 'linea', 'deporte', 'modelo', 'cod_mod', 'codigo_interno',
    'yy', 'temporada', 'pais', 'codigo_color', 'color', 'grupo_genero',
    'genero', 'clasificacion', 'codigo_curva', 'curva', 'composicion_curva', 'modulo',
  ];

  const hoja = XLSX.utils.json_to_sheet(filas, { header: headers });
  hoja['!cols'] = [
    { wch: 22 }, { wch: 60 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 25 }, { wch: 14 }, { wch: 22 },
    { wch: 8 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
    { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 10 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'MASTER_DATA_APP');

  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
  const orden = limpiarNombreArchivoPedido(pedido.NUMERO_ORDEN) || `PEDIDO_${id}`;
  const marca = limpiarNombreArchivoPedido(pedido.DETALLE_MARCA || pedido.CODIGO_MARCA)
    .replace(/\s+/g, '_')
    .toUpperCase();

  if (!marca) {
    throw new Error('El Pedido no tiene una marca válida para generar el nombre del MASTER_DATA_APP.');
  }

  const nombreArchivo = `MASTER_DATA_APP_${marca}_${orden}.xlsx`;

  const envioFTP = await enviarArchivoPedidoFTP(
    id,
    empresa,
    'MASTER_DATA_APP',
    { buffer, nombreArchivo }
  );

  await registrarExportacionGenerada(
    id,
    empresa,
    'MASTER_DATA_APP',
    nombreArchivo,
    filas.length,
    usuarioAutenticado
  );

  return {
    buffer,
    nombreArchivo,
    cantidadRegistros: filas.length,
    envioFTP,
  };
}

/* ============================================================
   EXPORTAR PREC_FOB.DBI DEL PEDIDO VALIDADO

   Estructura exacta del archivo modelo:
   MODC       C(20)
   COD_CURVA  C(20)
   COD_ANO    C(20)
   DCOD_TEM   C(30)
   COLOR      C(50)
   PAIS       C(50)
   FOB        N(20,5)

   FOB siempre es el precio FOB POR PAR.
   MODULO     -> COD_CURVA = CODIGO_MODULO
   PAR_SUELTO -> COD_CURVA = CODIGO_TALLE
   ============================================================ */
const CAMPOS_PREC_FOB = [
  { nombre: 'MODC', tipo: 'C', largo: 20, decimales: 0 },
  { nombre: 'COD_CURVA', tipo: 'C', largo: 20, decimales: 0 },
  { nombre: 'COD_ANO', tipo: 'C', largo: 20, decimales: 0 },
  { nombre: 'DCOD_TEM', tipo: 'C', largo: 30, decimales: 0 },
  { nombre: 'COLOR', tipo: 'C', largo: 50, decimales: 0 },
  { nombre: 'PAIS', tipo: 'C', largo: 50, decimales: 0 },
  { nombre: 'FOB', tipo: 'N', largo: 20, decimales: 5 },
];

function cortarBufferWin1252(valor, largo) {
  const origen = iconv.encode(texto(valor), 'win1252');
  if (origen.length <= largo) return origen;
  return origen.subarray(0, largo);
}

function crearDBFBuffer(registros, campos) {
  const cantidad = registros.length;
  const headerLength = 32 + (campos.length * 32) + 1;
  const recordLength = 1 + campos.reduce((sum, c) => sum + c.largo, 0);
  const totalLength = headerLength + (cantidad * recordLength) + 1;
  const buffer = Buffer.alloc(totalLength, 0);
  const ahora = new Date();

  buffer[0] = 0x03;
  buffer[1] = ahora.getFullYear() - 1900;
  buffer[2] = ahora.getMonth() + 1;
  buffer[3] = ahora.getDate();
  buffer.writeUInt32LE(cantidad, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  buffer[29] = 0x57; // Windows ANSI / cp1252

  let offset = 32;
  for (const campo of campos) {
    const descriptor = Buffer.alloc(32, 0);
    Buffer.from(campo.nombre, 'ascii').copy(descriptor, 0, 0, Math.min(11, campo.nombre.length));
    descriptor[11] = campo.tipo.charCodeAt(0);
    descriptor[16] = campo.largo;
    descriptor[17] = campo.decimales || 0;
    descriptor.copy(buffer, offset);
    offset += 32;
  }
  buffer[offset] = 0x0D;

  let recordOffset = headerLength;
  for (const registro of registros) {
    buffer[recordOffset] = 0x20;
    let colOffset = recordOffset + 1;

    for (const campo of campos) {
      const destino = Buffer.alloc(campo.largo, 0x20);
      const valor = registro[campo.nombre];

      if (campo.tipo === 'N') {
        const numero = Number(valor);
        const formateado = Number.isFinite(numero)
          ? numero.toFixed(campo.decimales || 0)
          : ''.padStart(campo.largo, ' ');
        const fuente = Buffer.from(formateado.padStart(campo.largo, ' '), 'ascii');
        fuente.copy(destino, Math.max(0, campo.largo - fuente.length), 0, Math.min(fuente.length, campo.largo));
      } else {
        const fuente = cortarBufferWin1252(valor, campo.largo);
        fuente.copy(destino, 0);
      }

      destino.copy(buffer, colOffset);
      colOffset += campo.largo;
    }

    recordOffset += recordLength;
  }

  buffer[totalLength - 1] = 0x1A;
  return buffer;
}

async function exportarPrecFobDBI(idPedido, idEmpresa, usuarioAutenticado) {
  const id = validarIdPedido(idPedido);
  const empresa = validarIdEmpresa(idEmpresa);

  const pedido = await pedidosRepository.obtenerPedidoPorId(id, empresa);

  if (!pedido) {
    throw new Error('Pedido no encontrado.');
  }

  const estado = texto(pedido.ESTADO).toUpperCase();
  if (estado !== 'VALIDADO') {
    throw new Error(
      `El pedido está en estado ${pedido.ESTADO}. Solamente se pueden exportar pedidos VALIDADO.`
    );
  }

  const detalles = await pedidosRepository.obtenerDatosMasterPedido(id, empresa);
  if (!detalles || detalles.length === 0) {
    throw new Error('El pedido no contiene productos para exportar a PREC_FOB.DBI.');
  }

  const unicos = new Map();

  for (const detalle of detalles) {
    const tipo = normalizarTipoProducto(detalle.TIPO_PRODUCTO);
    const codigoCurva = tipo === 'MODULO'
      ? texto(detalle.CODIGO_MODULO_PEDIDO)
      : texto(detalle.CODIGO_TALLE);

    const registro = {
      MODC: texto(detalle.CODIGO_MODELO),
      COD_CURVA: codigoCurva,
      COD_ANO: texto(detalle.CODIGO_ANO),
      DCOD_TEM: texto(detalle.DETALLE_TEMPORADA),
      COLOR: texto(detalle.DETALLE_COLOR),
      PAIS: texto(detalle.DETALLE_PAIS),
      FOB: redondear4(detalle.PRECIO_FOB_PAR),
    };

    if (!registro.MODC || !registro.COD_CURVA || !registro.COD_ANO) {
      throw new Error(
        `No se puede exportar PREC_FOB para ${texto(detalle.CODIGO_ALFA)}: faltan MODC, COD_CURVA o COD_ANO.`
      );
    }

    const clave = [
      registro.MODC, registro.COD_CURVA, registro.COD_ANO, registro.DCOD_TEM,
      registro.COLOR, registro.PAIS, Number(registro.FOB).toFixed(5),
    ].join('|').toUpperCase();

    if (!unicos.has(clave)) unicos.set(clave, registro);
  }

  const registros = Array.from(unicos.values());
  const buffer = crearDBFBuffer(registros, CAMPOS_PREC_FOB);
  const orden = limpiarNombreArchivoPedido(pedido.NUMERO_ORDEN) || `PEDIDO_${id}`;

  const nombreArchivo = `PREC_FOB_${orden}.DBI`;

  const envioFTP = await enviarArchivoPedidoFTP(
    id,
    empresa,
    'PREC_FOB',
    { buffer, nombreArchivo }
  );

  await registrarExportacionGenerada(
    id,
    empresa,
    'PREC_FOB',
    nombreArchivo,
    registros.length,
    usuarioAutenticado
  );

  return {
    buffer,
    nombreArchivo,
    cantidadRegistros: registros.length,
    envioFTP,
  };
}

module.exports = {
  listarPedidos,
  obtenerAltasDisponibles,
  validarAltaDisponible,
  validarAltasDisponibles,
  obtenerProveedoresPorAlta,
  obtenerProveedoresPorAltas,
  validarProveedorDelAlta,
  obtenerProductosDisponibles,
  obtenerProductosDisponiblesPorAltas,
  obtenerResumenModelosAlta,
  validarProductoDisponible,
  prepararCabeceraPedido,
  generarCodigoPedido,
  crearPedido,
  obtenerPedidoPorId,
  validarPedidoBorrador,
  prepararProductoPedido,
  agregarProductoPedido,
  listarDetallePedido,
  prepararActualizacionDetalle,
  actualizarProductoPedido,
  eliminarProductoPedido,
  validarPedido,
  anularPedido,
  exportarPedidoExcel,
  exportarMasterDataAppExcel,
  exportarPrecFobDBI,
  listarExportacionesPedido,
  obtenerDestinosExportacionPedido,
  _internals: {
    calcularCantidadesPedido,
    evaluarDestinosExportacionPedido,
    estadoAltaHabilitadoParaPedido,
    ESTADOS_ALTAS_HABILITADOS_PEDIDOS,
  },
};
