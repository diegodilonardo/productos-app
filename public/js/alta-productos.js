const pagina = document.getElementById('paginaProductosAlta');
const ID_ALTA = Number(pagina.dataset.idAlta);
let altaActual = null;
let colores = [];
let modelos = [];
let modelosFiltrados = [];
let timerBusquedaModelo = null;
let secuenciaBusquedaModelo = 0;
let modulos = [];
let modulosFiltrados = [];
let clasificacionesMaestro = [];

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  try {
    await cargarAlta();
    await cargarUsuarioAutenticado();
    configurarTipoProducto();
    await cargarMaestros();
    configurarEventos();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  }
}


async function cargarUsuarioAutenticado() {
  const input = document.getElementById('usuarioProducto');
  if (!input) return;

  let usuario = '';

  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (response.ok && data?.autenticado && data?.usuario) {
      const contexto = data.usuario;

      usuario = String(
        contexto.nombre ??
        contexto.NOMBRE ??
        contexto.nombreCompleto ??
        contexto.NOMBRE_COMPLETO ??
        contexto.displayName ??
        contexto.DISPLAY_NAME ??
        contexto.usuario ??
        contexto.USUARIO ??
        contexto.nombreUsuario ??
        contexto.NOMBRE_USUARIO ??
        ''
      ).trim();
    }
  } catch {
    // Si la sesión no puede consultarse, usamos el creador del Alta
    // como respaldo visual. El backend mantiene sus propias validaciones.
  }

  if (!usuario) {
    usuario = String(
      altaActual?.USUARIO_CREACION ??
      altaActual?.usuarioCreacion ??
      ''
    ).trim();
  }

  input.value = usuario;
  input.readOnly = true;
}

async function apiJson(url, opciones = {}) {
  const response = await fetch(url, opciones);
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.mensaje || `Error HTTP ${response.status} en ${url}`);
  return data;
}

function extraerDatos(data) {
  if (Array.isArray(data)) return data;
  if (data && Object.prototype.hasOwnProperty.call(data, 'datos')) return data.datos;
  if (data && Object.prototype.hasOwnProperty.call(data, 'resultado')) return data.resultado;
  if (data && Object.prototype.hasOwnProperty.call(data, 'data')) return data.data;
  return data;
}

async function obtenerListado(urls) {
  let ultimoError = null;
  for (const url of urls) {
    try {
      const lista = extraerDatos(await apiJson(url));
      if (Array.isArray(lista)) return lista;
      ultimoError = new Error(`La respuesta de ${url} no contiene un listado.`);
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError || new Error('No se pudo obtener el maestro.');
}

async function cargarAlta() {
  altaActual = extraerDatos(await apiJson(`/api/altas/${ID_ALTA}`));
  if (!altaActual || typeof altaActual !== 'object') throw new Error('No se pudo interpretar la cabecera del alta.');
  pintarCabecera();
  pintarDetalle();
  actualizarControlesEstado();
  actualizarLicenciaAlta();
}

function pintarCabecera() {
  document.getElementById('infoIdAlta').textContent = altaActual.ID_ALTA ?? ID_ALTA;
  document.getElementById('codigoAltaCabecera').textContent = altaActual.CODIGO_ALTA ?? '-';
  const badgeEstadoAlta = document.getElementById('estadoAltaCabecera');
  badgeEstadoAlta.textContent = altaActual.ESTADO ?? '-';
  aplicarClaseEstadoAlta(badgeEstadoAlta, altaActual.ESTADO);
  document.getElementById('infoMarca').textContent = altaActual.DETALLE_MARCA ?? altaActual.CODIGO_MARCA ?? '-';
  document.getElementById('infoRubro').textContent = altaActual.DETALLE_RUBRO ?? altaActual.CODIGO_RUBRO ?? '-';
  document.getElementById('infoTipo').textContent = altaActual.TIPO_PRODUCTO ?? '-';
  document.getElementById('infoAno').textContent = altaActual.CODIGO_ANO ?? '-';
  document.getElementById('infoTemporada').textContent = altaActual.DETALLE_TEMPORADA ?? altaActual.CODIGO_TEMPORADA ?? '-';
  document.getElementById('estadoLote').textContent = altaActual.ESTADO ?? '-';
}


function aplicarClaseEstadoAlta(elemento, estado) {
  if (!elemento) return;

  const valor = String(estado || '').trim().toUpperCase();

  elemento.className = 'badge rounded-pill px-3 py-2';

  const clases = {
    BORRADOR: 'text-bg-secondary',
    VALIDADO: 'text-bg-info',
    EXPORTADO: 'text-bg-primary',
    PARCIAL_ERP: 'text-bg-warning',
    GENERADO_OK_EN_ERP: 'text-bg-success',
    ANULADO: 'text-bg-danger'
  };

  elemento.classList.add(
    clases[valor] || 'text-bg-secondary'
  );
}

function normalizarTipo(valor) {
  return String(valor || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/-+/g, '_');
}

function configurarTipoProducto() {
  const tipo = normalizarTipo(altaActual?.TIPO_PRODUCTO);

  const clas = document.getElementById('contenedorClasificacion');
  const mod = document.getElementById('contenedorModulo');
  const talle = document.getElementById('contenedorTalle');

  const codigoClasificacion =
    document.getElementById('codigoClasificacion');
  const codigoModulo =
    document.getElementById('codigoModulo');
  const codigoTalle =
    document.getElementById('codigoTalle');

  if (tipo === 'MODULO') {
    clas?.classList.remove('d-none');
    mod?.classList.remove('d-none');
    talle?.classList.add('d-none');

    if (codigoClasificacion) {
      codigoClasificacion.required = true;
    }

    if (codigoModulo) {
      codigoModulo.required = true;
    }

    if (codigoTalle) {
      codigoTalle.required = false;
    }

    return;
  }

  clas?.classList.add('d-none');
  mod?.classList.add('d-none');
  talle?.classList.remove('d-none');

  if (codigoClasificacion) {
    codigoClasificacion.required = false;
  }

  if (codigoModulo) {
    codigoModulo.required = false;
  }

  if (codigoTalle) {
    codigoTalle.required = true;
  }
}

async function cargarMaestros() {
  const marca = encodeURIComponent(altaActual.CODIGO_MARCA || '');
  const rubro = encodeURIComponent(altaActual.CODIGO_RUBRO || '');
  const detalleMarca = encodeURIComponent(altaActual.DETALLE_MARCA || '');
  const detalleRubro = encodeURIComponent(altaActual.DETALLE_RUBRO || '');

  const [
    listaModelos, listaLicencias, proveedores, grupos, subgrupos, lineas, deportes,
    listaColores, edades, sexos, paises, clasificaciones
  ] = await Promise.all([
    obtenerListado([
      `/api/maestros/modelos?marca=${detalleMarca}&rubro=${detalleRubro}`,
      `/api/maestros/modelos?codigoMarca=${marca}&codigoRubro=${rubro}`,
      `/api/maestros/modelos?marca=${marca}&rubro=${rubro}`
    ]),
    obtenerListado([
      `/api/maestros/licencias-modelos?marca=${detalleMarca}&rubro=${detalleRubro}`
    ]),
    obtenerListado([
      `/api/maestros/proveedores?marca=${marca}&rubro=${detalleRubro}`,
      `/api/maestros/proveedores?marca=${marca}&rubro=${rubro}`,
      `/api/maestros/proveedores?marca=${marca}`
    ]),
    obtenerListado(['/api/maestros/grupos']),
    obtenerListado(['/api/maestros/subgrupos']),
    obtenerListado(['/api/maestros/lineas', '/api/maestros/linea']),
    obtenerListado(['/api/maestros/deportes']),
    obtenerListado(['/api/maestros/colores']),
    obtenerListado(['/api/maestros/edades']),
    obtenerListado(['/api/maestros/sexos', '/api/maestros/sexo']),
    obtenerListado(['/api/maestros/paises']),
    obtenerListado(['/api/maestros/clasificaciones', '/api/maestros/clasificacion'])
  ]);

  modelos = Array.isArray(listaModelos)
    ? listaModelos.slice()
    : [];

  modelos.sort(
    (a, b) => {
      const modeloA = formatearModelo(a);
      const modeloB = formatearModelo(b);

      const comparacionNombre =
        modeloA.detalle.localeCompare(
          modeloB.detalle,
          'es',
          {
            sensitivity: 'base',
            numeric: true
          }
        );

      if (comparacionNombre !== 0) {
        return comparacionNombre;
      }

      return modeloA.codigo.localeCompare(
        modeloB.codigo,
        'es',
        {
          sensitivity: 'base',
          numeric: true
        }
      );
    }
  );

  modelosFiltrados = modelos.slice();

  pintarModelos(modelosFiltrados);

  cargarLicenciasModelos(listaLicencias);
  actualizarLicenciaAlta();

  inicializarBuscadorMaestro({
    clave: 'Proveedor',
    lista: proveedores,
    campoCodigo: ['CODIGO', 'codigo', 'CODIGO_PROVEEDOR', 'codigoProveedor'],
    campoDetalle: ['NVA_RAZON_SOCIAL', 'nvaRazonSocial', 'DETALLE_PROVEEDOR', 'detalleProveedor']
  });

  inicializarBuscadorMaestro({
    clave: 'Grupo',
    lista: grupos,
    campoCodigo: ['CODIGO_GRUPO', 'codigoGrupo'],
    campoDetalle: ['DETALLE_GRUPO', 'detalleGrupo']
  });

  inicializarBuscadorMaestro({
    clave: 'Subgrupo',
    lista: subgrupos,
    campoCodigo: ['CODIGO_SUBGRUPO', 'codigoSubgrupo'],
    campoDetalle: ['DETALLE_SUBGRUPO', 'detalleSubgrupo']
  });

  inicializarBuscadorMaestro({
    clave: 'Linea',
    lista: lineas,
    campoCodigo: ['CODIGO_LINEA', 'codigoLinea'],
    campoDetalle: ['DETALLE_LINEA', 'detalleLinea']
  });

  inicializarBuscadorMaestro({
    clave: 'Deporte',
    lista: deportes,
    campoCodigo: ['CODIGO_DEPORTE', 'codigoDeporte'],
    campoDetalle: ['DETALLE_DEPORTE', 'detalleDeporte']
  });

  inicializarBuscadorMaestro({
    clave: 'Edad',
    lista: edades,
    campoCodigo: ['CODIGO_EDAD', 'codigoEdad'],
    campoDetalle: ['DETALLE_EDAD', 'detalleEdad']
  });

  cargarSexo(sexos);

  inicializarBuscadorMaestro({
    clave: 'Pais',
    lista: paises,
    campoCodigo: ['CODIGO_PAIS', 'codigoPais'],
    campoDetalle: ['DETALLE_PAIS', 'detallePais']
  });
  clasificacionesMaestro =
    Array.isArray(clasificaciones)
      ? clasificaciones.slice()
      : [];

  cargarClasificaciones(clasificacionesMaestro);

  colores = listaColores;
  pintarColores(colores);

  if (normalizarTipo(altaActual.TIPO_PRODUCTO) === 'MODULO') {
    modulos = await obtenerListado([
      '/api/maestros/talles-modulos',
      '/api/maestros/talles_modulos',
      '/api/maestros/modulos'
    ]);

    modulos = Array.isArray(modulos)
      ? modulos.slice()
      : [];

    modulos.sort(compararModulos);
    modulosFiltrados = modulos.slice();
    pintarModulos(modulosFiltrados);
  } else {
    const talles = await obtenerListado([
      '/api/maestros/talles'
    ]);

    const tallesFiltrados =
      filtrarTallesParSueltoPorRubro(
        talles,
        altaActual.DETALLE_RUBRO ??
        altaActual.detalleRubro ??
        altaActual.CODIGO_RUBRO ??
        altaActual.codigoRubro
      );

    cargarSelect(
      'codigoTalle',
      tallesFiltrados,

      // IMPORTANTE:
      // enviamos siempre el CODIGO_TALLE real al backend.
      ['CODIGO_TALLE', 'codigoTalle'],

      // Al usuario le mostramos el DETALLE_TALLE.
      ['DETALLE_TALLE', 'detalleTalle'],

      'Seleccionar talle...'
    );
  }
}


function normalizarBusqueda(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function formatearModelo(fila) {
  const codigo =
    obtenerCampo(
      fila,
      ['CODIGO_MODELO', 'codigoModelo']
    ) ?? '';

  const detalle =
    obtenerCampo(
      fila,
      ['DETALLE_MODELO', 'detalleModelo']
    ) ?? '';

  const licencia =
    obtenerCampo(
      fila,
      ['LICENCIA', 'licencia']
    ) ?? '';

  return {
    codigo: String(codigo).trim(),
    detalle: String(detalle).trim(),
    licencia: String(licencia).trim()
  };
}


function resaltarCoincidencia(texto, busqueda) {
  const original =
    String(texto || '');

  const criterio =
    String(busqueda || '').trim();

  if (!criterio) {
    return escapar(original);
  }

  const normalOriginal =
    normalizarBusqueda(original);

  const normalCriterio =
    normalizarBusqueda(criterio);

  const posicion =
    normalOriginal.indexOf(normalCriterio);

  if (posicion < 0) {
    return escapar(original);
  }

  const antes =
    original.slice(0, posicion);

  const coincidencia =
    original.slice(
      posicion,
      posicion + criterio.length
    );

  const despues =
    original.slice(
      posicion + criterio.length
    );

  return (
    escapar(antes) +
    '<mark class="alta-model-match">' +
    escapar(coincidencia) +
    '</mark>' +
    escapar(despues)
  );
}

function pintarModelos(lista) {
  const contenedor =
    document.getElementById('listaModelos');

  if (!contenedor) return;

  contenedor.innerHTML = '';

  if (!Array.isArray(lista) || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="alta-model-empty">
        No se encontraron modelos con ese criterio.
      </div>`;
    return;
  }

  // Para no convertir el DOM en una lista enorme,
  // mostramos como máximo 80 coincidencias.
  const visibles =
    lista.slice(0, 60);

  const busquedaActual =
    document.getElementById('buscarModelo')?.value ?? '';

  for (const fila of visibles) {
    const modelo =
      formatearModelo(fila);

    if (!modelo.codigo) continue;

    const boton =
      document.createElement('button');

    boton.type = 'button';
    boton.className = 'alta-model-item';
    boton.dataset.codigoModelo = modelo.codigo;

    boton.innerHTML = `
      <div class="alta-model-code">
        ${resaltarCoincidencia(modelo.codigo, busquedaActual)}
      </div>
      <div class="alta-model-main">
        <div class="alta-model-name">
          ${resaltarCoincidencia(modelo.detalle || modelo.codigo, busquedaActual)}
        </div>
        ${
          modelo.licencia
            ? `<div class="alta-model-license">${resaltarCoincidencia(modelo.licencia, busquedaActual)}</div>`
            : ''
        }
      </div>`;

    boton.addEventListener(
      'click',
      () => seleccionarModelo(fila)
    );

    contenedor.appendChild(boton);
  }

  if (lista.length > visibles.length) {
    const aviso =
      document.createElement('div');

    aviso.className =
      'alta-model-more';

    aviso.textContent =
      `Mostrando ${visibles.length} de ${lista.length}. ` +
      'Escribí para acotar la búsqueda.';

    contenedor.appendChild(aviso);
  }
}

function cargarLicenciasModelos(lista) {
  const select =
    document.getElementById('licenciaModelo');

  if (!select) return;

  select.innerHTML =
    '<option value="">Todas las licencias</option>';

  for (const fila of (Array.isArray(lista) ? lista : [])) {
    const codigo =
      fila.CODIGO_LICENCIA ??
      fila.codigoLicencia ??
      fila.LICENCIA ??
      fila.licencia ??
      '';

    const detalle =
      fila.DETALLE_LICENCIA ??
      fila.detalleLicencia ??
      codigo;

    if (!String(codigo).trim()) continue;

    const option =
      document.createElement('option');

    option.value =
      String(codigo).trim();

    option.textContent =
      String(detalle || codigo).trim();

    select.appendChild(option);
  }
}


function obtenerLicenciaModeloSeleccionada() {
  return String(
    document
      .getElementById('licenciaModelo')
      ?.value || ''
  ).trim();
}


function obtenerLicenciaAltaDesdeDetalle() {
  const detalle =
    Array.isArray(altaActual?.detalle)
      ? altaActual.detalle
      : (
          Array.isArray(altaActual?.DETALLE)
            ? altaActual.DETALLE
            : []
        );

  if (!detalle.length) {
    return null;
  }

  const licencias =
    [
      ...new Set(
        detalle.map(item => {
          const valor =
            String(
              item.LICENCIA ??
              item.licencia ??
              ''
            ).trim();

          return valor ||
            '__SIN_LICENCIA__';
        })
      )
    ];

  if (licencias.length !== 1) {
    return '__INCONSISTENTE__';
  }

  return licencias[0];
}


function actualizarLicenciaAlta() {
  const select =
    document.getElementById(
      'licenciaModelo'
    );

  if (!select) return;

  const licenciaAlta =
    obtenerLicenciaAltaDesdeDetalle();

  if (!licenciaAlta) {
    select.disabled = false;
    select.value = '';
    select.title =
      'La licencia quedará definida al agregar el primer producto.';
    return;
  }

  if (licenciaAlta === '__INCONSISTENTE__') {
    select.disabled = true;
    select.title =
      'El Alta contiene más de una licencia y debe corregirse.';

    return;
  }

  const valorSelect =
    licenciaAlta === '__SIN_LICENCIA__'
      ? '__SIN_LICENCIA__'
      : licenciaAlta;

  const existeOpcion =
    [...select.options]
      .some(
        option =>
          option.value === valorSelect
      );

  if (existeOpcion) {
    select.value =
      valorSelect;
  }

  select.disabled = true;
  select.title =
    'La licencia quedó definida por los productos de esta Alta.';

  const hiddenModelo =
    document.getElementById(
      'codigoModelo'
    );

  const buscadorModelo =
    document.getElementById(
      'buscarModelo'
    );

  const panelModelo =
    document.getElementById(
      'modeloSeleccionado'
    );

  const listaModelos =
    document.getElementById(
      'listaModelos'
    );

  if (hiddenModelo) {
    hiddenModelo.value = '';
  }

  if (buscadorModelo) {
    buscadorModelo.value = '';
    buscadorModelo.classList.remove(
      'd-none'
    );
  }

  panelModelo?.classList.add(
    'd-none'
  );

  listaModelos?.classList.remove(
    'd-none'
  );

  clearTimeout(
    timerBusquedaModelo
  );

  buscarModelosEnServidor('');
}


function cambiarLicenciaModelo() {
  const select =
    document.getElementById(
      'licenciaModelo'
    );

  if (select?.disabled) {
    return;
  }

  const hidden =
    document.getElementById('codigoModelo');

  const buscador =
    document.getElementById('buscarModelo');

  const panel =
    document.getElementById('modeloSeleccionado');

  const lista =
    document.getElementById('listaModelos');

  if (hidden) hidden.value = '';

  if (buscador) {
    buscador.value = '';
    buscador.classList.remove('d-none');
  }

  panel?.classList.add('d-none');
  lista?.classList.remove('d-none');

  clearTimeout(timerBusquedaModelo);

  buscarModelosEnServidor('');

  buscador?.focus();
}


function mostrarEstadoBusquedaModelos(mensaje) {
  const contenedor = document.getElementById('listaModelos');
  if (!contenedor) return;

  contenedor.classList.remove('d-none');
  contenedor.innerHTML = `
    <div class="alta-model-empty">
      ${escapar(mensaje)}
    </div>`;
}

async function buscarModelosEnServidor(texto) {
  if (!altaActual) return;

  const marca =
    altaActual.DETALLE_MARCA ??
    altaActual.detalleMarca ??
    altaActual.CODIGO_MARCA ??
    altaActual.codigoMarca ??
    '';

  const rubro =
    altaActual.DETALLE_RUBRO ??
    altaActual.detalleRubro ??
    altaActual.CODIGO_RUBRO ??
    altaActual.codigoRubro ??
    '';

  const params = new URLSearchParams();

  if (marca) params.set('marca', String(marca).trim());
  if (rubro) params.set('rubro', String(rubro).trim());

  const licencia =
    obtenerLicenciaModeloSeleccionada();

  if (licencia) {
    params.set(
      'licencia',
      licencia
    );
  }

  const criterio = String(texto || '').trim();
  if (criterio) params.set('texto', criterio);

  const secuencia = ++secuenciaBusquedaModelo;

  mostrarEstadoBusquedaModelos(
    criterio ? 'Buscando modelos...' : 'Cargando modelos...'
  );

  try {
    const respuesta = await fetch(
      `/api/maestros/modelos?${params.toString()}`
    );

    const data = await respuesta.json();

    if (!respuesta.ok || data.ok === false) {
      throw new Error(
        data.mensaje || 'No se pudieron buscar los modelos.'
      );
    }

    if (secuencia !== secuenciaBusquedaModelo) return;

    const lista =
      Array.isArray(data)
        ? data
        : Array.isArray(data.datos)
          ? data.datos
          : [];

    modelos = lista.slice();

    modelos.sort((a, b) => {
      const modeloA = formatearModelo(a);
      const modeloB = formatearModelo(b);

      const porNombre = modeloA.detalle.localeCompare(
        modeloB.detalle,
        'es',
        { sensitivity: 'base', numeric: true }
      );

      if (porNombre !== 0) return porNombre;

      return modeloA.codigo.localeCompare(
        modeloB.codigo,
        'es',
        { sensitivity: 'base', numeric: true }
      );
    });

    modelosFiltrados = modelos.slice();
    pintarModelos(modelosFiltrados);

  } catch (error) {
    if (secuencia !== secuenciaBusquedaModelo) return;

    mostrarEstadoBusquedaModelos(
      error.message || 'Error buscando modelos.'
    );
  }
}

function filtrarModelos() {
  const input = document.getElementById('buscarModelo');
  const texto = String(input?.value || '').trim();

  const hidden = document.getElementById('codigoModelo');
  if (hidden) hidden.value = '';

  clearTimeout(timerBusquedaModelo);

  timerBusquedaModelo = setTimeout(
    () => buscarModelosEnServidor(texto),
    300
  );
}

function seleccionarModelo(fila) {
  const modelo =
    formatearModelo(fila);

  const hidden =
    document.getElementById('codigoModelo');

  const buscador =
    document.getElementById('buscarModelo');

  const panel =
    document.getElementById('modeloSeleccionado');

  const texto =
    document.getElementById('modeloSeleccionadoTexto');

  const lista =
    document.getElementById('listaModelos');

  hidden.value =
    modelo.codigo;

  buscador.value =
    modelo.detalle || modelo.codigo;

  texto.textContent =
    [
      modelo.codigo,
      modelo.detalle,
      modelo.licencia
    ]
      .filter(Boolean)
      .join(' - ');

  panel.classList.remove('d-none');
  lista.classList.add('d-none');
  buscador.classList.add('d-none');

  actualizarImagenesProducto();
}

function limpiarModeloSeleccionado() {
  const hidden =
    document.getElementById('codigoModelo');

  const buscador =
    document.getElementById('buscarModelo');

  const panel =
    document.getElementById('modeloSeleccionado');

  const lista =
    document.getElementById('listaModelos');

  hidden.value = '';
  buscador.value = '';

  panel.classList.add('d-none');
  buscador.classList.remove('d-none');
  lista.classList.remove('d-none');

  buscarModelosEnServidor('');

  actualizarImagenesProducto();

  buscador.focus();
}

function cargarSelectBasico(id, lista, campoCodigo, campoDetalle, placeholder) {
  cargarSelect(id, lista, [campoCodigo, camelizar(campoCodigo)], [campoDetalle, camelizar(campoDetalle)], placeholder);
}

function cargarSelect(id, lista, camposCodigo, camposDetalle, placeholder, formateador = null) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const fila of lista) {
    const codigo = obtenerCampo(fila, camposCodigo);
    if (codigo === undefined || codigo === null || String(codigo).trim() === '') continue;
    const detalle = obtenerCampo(fila, camposDetalle);
    const option = document.createElement('option');
    option.value = String(codigo);
    option.textContent = formateador ? formateador(fila) : (detalle ? `${codigo} - ${detalle}` : String(codigo));
    select.appendChild(option);
  }
}

function cargarSexo(lista) {
  inicializarBuscadorMaestro({
    clave: 'Sexo',
    lista,
    campoCodigo: ['SEXO', 'sexo'],
    campoDetalle: ['SEXO', 'sexo']
  });
}


function normalizarValorRegla(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obtenerEdadSeleccionadaDetalle() {
  const codigoEdad =
    String(document.getElementById('codigoEdad')?.value || '').trim();

  if (!codigoEdad) return '';

  const item =
    buscadoresMaestro?.Edad?.filas?.find(
      fila => String(fila.codigo).trim() === codigoEdad
    );

  return normalizarValorRegla(item?.detalle || '');
}

function obtenerClasificacionesPermitidasEdadSexo() {
  const edad = obtenerEdadSeleccionadaDetalle();

  let sexo =
    normalizarValorRegla(
      document.getElementById('codigoSexo')?.value || ''
    );

  if (sexo === 'HOM') sexo = 'MAS';

  if (!edad || !sexo) return [];

  const reglas = {
    ADULTO: {
      MAS: ['MOD.HOM'],
      FEM: ['MOD.MUJ'],
      UNI: ['MOD.UNI']
    },
    BABY: {
      MAS: ['MOD.BB'],
      FEM: ['MOD.BB'],
      UNI: ['MOD.BB']
    },
    JUNIOR: {
      MAS: ['MOD.JUN'],
      FEM: ['MOD.JUN'],
      UNI: ['MOD.JUN']
    },
    KIDS: {
      MAS: ['MOD.KID'],
      FEM: ['MOD.KID'],
      UNI: ['MOD.KID']
    },
    TEEN: {
      MAS: ['MOD.TEEN'],
      FEM: ['MOD.TEEN'],
      UNI: ['MOD.TEEN']
    },
    YOUTH: {
      MAS: ['MOD.YOUTH'],
      FEM: ['MOD.YOUTH'],
      UNI: ['MOD.YOUTH']
    }
  };

  return reglas?.[edad]?.[sexo] || [];
}

function cargarClasificaciones(lista) {
  const select =
    document.getElementById(
      'codigoClasificacion'
    );

  if (!select) return;

  const tipo =
    normalizarTipo(
      altaActual?.TIPO_PRODUCTO
    );

  const filas =
    Array.isArray(lista)
      ? lista
      : [];

  if (tipo !== 'MODULO') {
    const filtradas =
      filas.filter(fila => {
        const codigo =
          String(
            obtenerCampo(
              fila,
              [
                'CODIGO_CLASIFICACION',
                'codigoClasificacion'
              ]
            ) ?? ''
          ).trim();

        return codigo === '1';
      });

    cargarSelect(
      'codigoClasificacion',
      filtradas,
      [
        'CODIGO_CLASIFICACION',
        'codigoClasificacion'
      ],
      [
        'DETALLE_CLASIFICACION',
        'detalleClasificacion'
      ],
      'Seleccionar clasificación...'
    );

    if (filtradas.length === 1) {
      const codigo =
        obtenerCampo(
          filtradas[0],
          [
            'CODIGO_CLASIFICACION',
            'codigoClasificacion'
          ]
        );

      if (
        codigo !== undefined &&
        codigo !== null
      ) {
        select.value = String(codigo);
      }
    }

    return;
  }

  const edad =
    obtenerEdadSeleccionadaDetalle();

  const sexo =
    normalizarValorRegla(
      document
        .getElementById(
          'codigoSexo'
        )
        ?.value || ''
    );

  const permitidas =
    obtenerClasificacionesPermitidasEdadSexo();

  if (!edad || !sexo) {
    select.innerHTML =
      '<option value="">Seleccioná Edad y Sexo primero...</option>';
    select.disabled = true;
    return;
  }

  const filtradas =
    filas.filter(fila => {
      const detalle =
        normalizarValorRegla(
          obtenerCampo(
            fila,
            [
              'DETALLE_CLASIFICACION',
              'detalleClasificacion'
            ]
          )
        );

      return permitidas.includes(
        detalle
      );
    });

  select.disabled = false;

  cargarSelect(
    'codigoClasificacion',
    filtradas,
    [
      'CODIGO_CLASIFICACION',
      'codigoClasificacion'
    ],
    [
      'DETALLE_CLASIFICACION',
      'detalleClasificacion'
    ],
    filtradas.length
      ? 'Seleccionar clasificación...'
      : 'Sin clasificación válida para Edad + Sexo'
  );

  if (filtradas.length === 1) {
    const codigo =
      obtenerCampo(
        filtradas[0],
        [
          'CODIGO_CLASIFICACION',
          'codigoClasificacion'
        ]
      );

    if (
      codigo !== undefined &&
      codigo !== null
    ) {
      select.value = String(codigo);
    }
  }
}


function actualizarClasificacionesEdadSexo() {
  const select =
    document.getElementById(
      'codigoClasificacion'
    );

  if (select) {
    select.value = '';
  }

  cargarClasificaciones(
    clasificacionesMaestro
  );
}


function obtenerClasificacionSeleccionadaDetalle() {
  const codigo =
    String(
      document
        .getElementById(
          'codigoClasificacion'
        )
        ?.value || ''
    ).trim();

  if (!codigo) return '';

  const item =
    (Array.isArray(clasificacionesMaestro)
      ? clasificacionesMaestro
      : []
    ).find(
      fila =>
        String(
          obtenerCampo(
            fila,
            [
              'CODIGO_CLASIFICACION',
              'codigoClasificacion'
            ]
          ) ?? ''
        ).trim() === codigo
    );

  return normalizarValorRegla(
    obtenerCampo(
      item || {},
      [
        'DETALLE_CLASIFICACION',
        'detalleClasificacion'
      ]
    ) || ''
  );
}

function obtenerDatosModulo(fila) {
  const codigo =
    String(
      obtenerCampo(
        fila,
        ['CODIGO_MODULO', 'codigoModulo']
      ) ?? ''
    ).trim();

  const detalle =
    String(
      obtenerCampo(
        fila,
        ['DETALLE_MODULO', 'detalleModulo']
      ) ?? ''
    ).trim();

  const descripcion =
    String(
      obtenerCampo(
        fila,
        ['DESCRIPCION_CURVA', 'descripcionCurva']
      ) ?? ''
    ).trim();

  const pares =
    Number(
      obtenerCampo(
        fila,
        ['PARES', 'pares']
      ) ?? 0
    );

  let rango = '';
  let composicion = '';

  if (descripcion) {
    const partes =
      descripcion
        .split('/')
        .map(parte => parte.trim())
        .filter(Boolean);

    if (partes.length) {
      rango =
        partes[0]
          .replace(/^\(/, '')
          .replace(/\)$/, '')
          .trim();
    }

    if (partes.length >= 2) {
      composicion =
        partes[1].trim();
    }
  }

  if (!rango) {
    rango = detalle;
  }

  if (!composicion && detalle && detalle !== rango) {
    composicion = detalle;
  }

  return {
    codigo,
    detalle,
    descripcion,
    rango,
    composicion,
    pares
  };
}


function claveOrdenModulo(fila) {
  const modulo =
    obtenerDatosModulo(fila);

  const texto =
    `${modulo.rango} ${modulo.composicion}`;

  const numero =
    texto.match(
      /(?:^|\D)(\d+(?:[.,]\d+)?)/
    );

  if (numero) {
    return {
      grupo: 0,
      valor:
        Number(
          numero[1].replace(',', '.')
        )
    };
  }

  return {
    grupo: 1,
    valor:
      normalizarBusqueda(
        modulo.rango ||
        modulo.composicion ||
        modulo.codigo
      )
  };
}


function compararModulos(a, b) {
  const claveA =
    claveOrdenModulo(a);

  const claveB =
    claveOrdenModulo(b);

  if (claveA.grupo !== claveB.grupo) {
    return claveA.grupo - claveB.grupo;
  }

  if (
    typeof claveA.valor === 'number' &&
    typeof claveB.valor === 'number' &&
    claveA.valor !== claveB.valor
  ) {
    return claveA.valor - claveB.valor;
  }

  const porRango =
    String(claveA.valor).localeCompare(
      String(claveB.valor),
      'es',
      {
        sensitivity: 'base',
        numeric: true
      }
    );

  if (porRango !== 0) {
    return porRango;
  }

  return obtenerDatosModulo(a)
    .codigo
    .localeCompare(
      obtenerDatosModulo(b).codigo,
      'es',
      {
        sensitivity: 'base',
        numeric: true
      }
    );
}


function textoBusquedaModulo(fila) {
  const modulo =
    obtenerDatosModulo(fila);

  return normalizarBusqueda(
    [
      modulo.codigo,
      modulo.detalle,
      modulo.descripcion,
      modulo.rango,
      modulo.composicion,
      modulo.pares,
      modulo.pares
        ? `${modulo.pares} pares`
        : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}


function filtrarModulos() {
  const texto =
    document
      .getElementById('buscarModulo')
      ?.value || '';

  const terminos =
    normalizarBusqueda(texto)
      .split(/\s+/)
      .filter(Boolean);

  modulosFiltrados =
    modulos.filter(
      fila => {
        const buscable =
          textoBusquedaModulo(fila);

        return terminos.every(
          termino =>
            buscable.includes(termino)
        );
      }
    );

  pintarModulos(
    modulosFiltrados
  );
}


function pintarModulos(lista) {
  const contenedor =
    document.getElementById('listaModulos');

  if (!contenedor) return;

  contenedor.innerHTML = '';
  contenedor.classList.remove('d-none');

  if (
    !Array.isArray(lista) ||
    lista.length === 0
  ) {
    contenedor.innerHTML = `
      <div class="alta-module-empty">
        No se encontraron curvas con ese criterio.
      </div>`;

    return;
  }

  const visibles =
    lista.slice(0, 60);

  const busqueda =
    document
      .getElementById('buscarModulo')
      ?.value || '';

  for (const fila of visibles) {
    const modulo =
      obtenerDatosModulo(fila);

    if (!modulo.codigo) continue;

    const boton =
      document.createElement('button');

    boton.type = 'button';
    boton.className = 'alta-module-item';

    boton.innerHTML = `
      <div class="alta-module-code">
        ${resaltarCoincidencia(modulo.codigo, busqueda)}
      </div>

      <div class="alta-module-main">
        <div class="alta-module-head">
          <strong class="alta-module-range">
            ${resaltarCoincidencia(modulo.rango || modulo.detalle || 'Sin rango', busqueda)}
          </strong>

          ${
            modulo.pares
              ? `<span class="alta-module-pairs">${escapar(modulo.pares)} PARES</span>`
              : ''
          }
        </div>

        <div class="alta-module-composition">
          ${
            modulo.composicion
              ? resaltarCoincidencia(modulo.composicion, busqueda)
              : escapar(modulo.descripcion || modulo.detalle || '')
          }
        </div>
      </div>`;

    boton.addEventListener(
      'click',
      () => seleccionarModulo(fila)
    );

    contenedor.appendChild(
      boton
    );
  }

  if (lista.length > visibles.length) {
    const aviso =
      document.createElement('div');

    aviso.className =
      'alta-module-more';

    aviso.textContent =
      `Mostrando ${visibles.length} de ${lista.length}. ` +
      'Escribí para acotar la búsqueda.';

    contenedor.appendChild(
      aviso
    );
  }
}


function seleccionarModulo(fila) {
  const modulo =
    obtenerDatosModulo(fila);

  const hidden =
    document.getElementById('codigoModulo');

  const buscador =
    document.getElementById('buscarModulo');

  const lista =
    document.getElementById('listaModulos');

  const seleccionado =
    document.getElementById('moduloSeleccionado');

  if (hidden) {
    hidden.value =
      modulo.codigo;
  }

  if (buscador) {
    buscador.value = '';
    buscador.classList.add('d-none');
  }

  lista?.classList.add('d-none');
  seleccionado?.classList.remove('d-none');

  document.getElementById(
    'moduloSeleccionadoCodigo'
  ).textContent =
    modulo.codigo;

  document.getElementById(
    'moduloSeleccionadoRango'
  ).textContent =
    modulo.rango ||
    modulo.detalle ||
    'Curva';

  const pares =
    document.getElementById(
      'moduloSeleccionadoPares'
    );

  if (pares) {
    pares.textContent =
      modulo.pares
        ? `${modulo.pares} PARES`
        : '';
    pares.classList.toggle(
      'd-none',
      !modulo.pares
    );
  }

  document.getElementById(
    'moduloSeleccionadoComposicion'
  ).textContent =
    modulo.composicion ||
    modulo.descripcion ||
    modulo.detalle ||
    '';
}


function limpiarModuloSeleccionado() {
  const hidden =
    document.getElementById('codigoModulo');

  const buscador =
    document.getElementById('buscarModulo');

  const lista =
    document.getElementById('listaModulos');

  const seleccionado =
    document.getElementById('moduloSeleccionado');

  if (hidden) {
    hidden.value = '';
  }

  if (buscador) {
    buscador.value = '';
    buscador.classList.remove('d-none');
  }

  seleccionado?.classList.add('d-none');
  lista?.classList.remove('d-none');

  modulosFiltrados =
    modulos.slice();

  pintarModulos(
    modulosFiltrados
  );

  buscador?.focus();
}


function formatearModulo(fila) {
  const modulo =
    obtenerDatosModulo(fila);

  return [
    modulo.codigo,
    modulo.rango || modulo.detalle,
    modulo.pares
      ? `${modulo.pares} pares`
      : null
  ]
    .filter(Boolean)
    .join(' - ');
}


/* ============================================================
   TALLES PAR SUELTO POR RUBRO
   ============================================================ */

function normalizarCodigoTalle(valor) {
  return String(
    valor ?? ''
  )
    .trim()
    .toUpperCase();
}


function filtrarTallesParSueltoPorRubro(
  lista,
  rubroEntrada
) {
  if (globalThis.ReglasTallesParSuelto) {
    return globalThis.ReglasTallesParSuelto.filtrar(lista, rubroEntrada);
  }

  const rubro =
    normalizarBusqueda(
      rubroEntrada
    ).toUpperCase();

  const talles =
    Array.isArray(lista)
      ? lista
      : [];

  const excluidosCalzado =
    new Set([
      'T_XS',
      'T_S',
      'T_M',
      'T_L',
      'T_XL',
      'T_2X',
      'T_3X',
      'T_2XL',
      'T_3XL',
      'T_00'
    ]);

  const permitidosIndumentaria =
    new Set([
      'T_XS',
      'T_S',
      'T_M',
      'T_L',
      'T_XL',
      'T_2X',
      'T_3X',
      'T_2XL',
      'T_3XL'
    ]);

  const permitidosAccesorios =
    new Set([
      'T00',
      'T01',
      'T02',
      'T03',
      'XS',
      'S',
      'M',
      'L',
      'XL',
      '2X',
      '3X'
    ]);

  const permitidosPop =
    new Set([
      'T00'
    ]);

  const filtrados =
    talles.filter(fila => {
      const codigo =
        normalizarCodigoTalle(
          fila.CODIGO_TALLE ??
          fila.codigoTalle
        );

      const detalle =
        String(
          fila.DETALLE_TALLE ??
          fila.detalleTalle ??
          ''
        )
          .trim()
          .replace(',', '.');

      if (!codigo) {
        return false;
      }

      switch (rubro) {

        case 'CALZADO':
          return (
            !excluidosCalzado.has(codigo) &&
            Number.isFinite(Number(detalle)) &&
            Number(detalle) > 0
          );

        case 'INDUMENTARIA':
          return permitidosIndumentaria.has(
            codigo
          );

        case 'ACCESORIOS':
          return permitidosAccesorios.has(
            codigo
          );

        case 'POP':
          return permitidosPop.has(
            codigo
          );

        default:
          // Por seguridad, si el rubro no tiene regla
          // no mostramos talles indiscriminadamente.
          return false;
      }
    });

  return filtrados.sort(
    compararTallesParSuelto
  );
}


function compararTallesParSuelto(a, b) {
  const codigoA =
    normalizarCodigoTalle(
      a.CODIGO_TALLE ??
      a.codigoTalle
    );

  const codigoB =
    normalizarCodigoTalle(
      b.CODIGO_TALLE ??
      b.codigoTalle
    );

  const detalleA =
    String(
      a.DETALLE_TALLE ??
      a.detalleTalle ??
      codigoA
    ).trim();

  const detalleB =
    String(
      b.DETALLE_TALLE ??
      b.detalleTalle ??
      codigoB
    ).trim();

  const numeroA =
    Number(
      detalleA.replace(',', '.')
    );

  const numeroB =
    Number(
      detalleB.replace(',', '.')
    );

  const aEsNumero =
    Number.isFinite(numeroA);

  const bEsNumero =
    Number.isFinite(numeroB);

  if (aEsNumero && bEsNumero) {
    return numeroA - numeroB;
  }

  if (aEsNumero !== bEsNumero) {
    return aEsNumero ? -1 : 1;
  }

  const ordenTexto = [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    '2X',
    '2XL',
    '3X',
    '3XL'
  ];

  const posA =
    ordenTexto.indexOf(
      detalleA.toUpperCase()
    );

  const posB =
    ordenTexto.indexOf(
      detalleB.toUpperCase()
    );

  if (
    posA >= 0 ||
    posB >= 0
  ) {
    if (posA < 0) return 1;
    if (posB < 0) return -1;

    return posA - posB;
  }

  return detalleA.localeCompare(
    detalleB,
    'es',
    {
      sensitivity: 'base',
      numeric: true
    }
  );
}



/* ============================================================
   BUSCADORES VISUALES DE MAESTROS
   Grupo / Subgrupo / Línea / Deporte

   - El usuario ve solamente DETALLE.
   - El hidden codigoX conserva el código ERP real.
   ============================================================ */

const buscadoresMaestro = {};


function inicializarBuscadorMaestro({
  clave,
  lista,
  campoCodigo,
  campoDetalle
}) {
  const filas =
    (Array.isArray(lista) ? lista : [])
      .map(fila => ({
        original: fila,
        codigo:
          String(
            obtenerCampo(
              fila,
              campoCodigo
            ) ?? ''
          ).trim(),
        detalle:
          String(
            obtenerCampo(
              fila,
              campoDetalle
            ) ?? ''
          ).trim()
      }))
      .filter(
        item =>
          item.codigo &&
          item.detalle
      )
      .sort(
        (a, b) =>
          a.detalle.localeCompare(
            b.detalle,
            'es',
            {
              sensitivity: 'base',
              numeric: true
            }
          )
      );

  buscadoresMaestro[clave] = {
    filas,
    filtradas: filas.slice()
  };

  const buscador =
    document.getElementById(
      `buscar${clave}`
    );

  const limpiar =
    document.getElementById(
      `btnLimpiar${clave}`
    );

  buscador?.addEventListener(
    'input',
    () =>
      filtrarBuscadorMaestro(
        clave
      )
  );

  limpiar?.addEventListener(
    'click',
    () =>
      limpiarBuscadorMaestro(
        clave
      )
  );

  pintarBuscadorMaestro(
    clave,
    filas
  );
}


function filtrarBuscadorMaestro(clave) {
  const estado =
    buscadoresMaestro[clave];

  if (!estado) return;

  const texto =
    document
      .getElementById(
        `buscar${clave}`
      )
      ?.value || '';

  const terminos =
    normalizarBusqueda(texto)
      .split(/\s+/)
      .filter(Boolean);

  const origenFiltro =
    clave === 'Clasificacion' &&
    Array.isArray(estado.permitidas)
      ? estado.permitidas
      : estado.filas;

  estado.filtradas =
    origenFiltro.filter(item => {
      const detalle =
        normalizarBusqueda(
          item.detalle
        );

      return terminos.every(
        termino =>
          detalle.includes(termino)
      );
    });

  pintarBuscadorMaestro(
    clave,
    estado.filtradas
  );
}


function pintarBuscadorMaestro(
  clave,
  lista
) {
  const contenedor =
    document.getElementById(
      `lista${clave}`
    );

  if (!contenedor) return;

  contenedor.innerHTML = '';
  contenedor.classList.remove(
    'd-none'
  );

  if (!lista?.length) {
    contenedor.innerHTML = `
      <div class="alta-master-empty">
        No se encontraron opciones.
      </div>`;

    return;
  }

  const busqueda =
    document
      .getElementById(
        `buscar${clave}`
      )
      ?.value || '';

  const visibles =
    lista.slice(0, 50);

  for (const item of visibles) {
    const boton =
      document.createElement(
        'button'
      );

    boton.type = 'button';
    boton.className =
      'alta-master-item';

    boton.innerHTML = `
      <span class="alta-master-detail">
        ${resaltarCoincidencia(
          item.detalle,
          busqueda
        )}
      </span>`;

    boton.addEventListener(
      'click',
      () =>
        seleccionarBuscadorMaestro(
          clave,
          item
        )
    );

    contenedor.appendChild(
      boton
    );
  }

  if (lista.length > visibles.length) {
    const aviso =
      document.createElement(
        'div'
      );

    aviso.className =
      'alta-master-more';

    aviso.textContent =
      `Mostrando ${visibles.length} de ${lista.length}. ` +
      'Escribí para acotar la búsqueda.';

    contenedor.appendChild(
      aviso
    );
  }
}


function seleccionarBuscadorMaestro(
  clave,
  item
) {
  const hidden =
    document.getElementById(
      `codigo${clave}`
    );

  const buscador =
    document.getElementById(
      `buscar${clave}`
    );

  const lista =
    document.getElementById(
      `lista${clave}`
    );

  const claveCamel =
    clave.charAt(0).toLowerCase() +
    clave.slice(1);

  const seleccionado =
    document.getElementById(
      `${claveCamel}Seleccionado`
    );

  const detalle =
    document.getElementById(
      `${claveCamel}SeleccionadoDetalle`
    );

  if (hidden) {
    hidden.value =
      item.codigo;
  }

  if (buscador) {
    buscador.value = '';
    buscador.classList.add(
      'd-none'
    );
  }

  if (detalle) {
    detalle.textContent =
      item.detalle;
  }

  lista?.classList.add(
    'd-none'
  );

  seleccionado?.classList.remove(
    'd-none'
  );

  if (clave === 'Edad' || clave === 'Sexo') {
    actualizarClasificacionesEdadSexo();
  }
}


function limpiarBuscadorMaestro(clave) {
  const estado =
    buscadoresMaestro[clave];

  const hidden =
    document.getElementById(
      `codigo${clave}`
    );

  const buscador =
    document.getElementById(
      `buscar${clave}`
    );

  const lista =
    document.getElementById(
      `lista${clave}`
    );

  const claveCamel =
    clave.charAt(0).toLowerCase() +
    clave.slice(1);

  const seleccionado =
    document.getElementById(
      `${claveCamel}Seleccionado`
    );

  if (hidden) {
    hidden.value = '';
  }

  if (buscador) {
    buscador.value = '';
    buscador.classList.remove(
      'd-none'
    );
  }

  seleccionado?.classList.add(
    'd-none'
  );

  lista?.classList.remove(
    'd-none'
  );

  if (estado) {
    const origen =
      clave === 'Clasificacion' &&
      Array.isArray(estado.permitidas)
        ? estado.permitidas
        : estado.filas;

    estado.filtradas =
      origen.slice();

    pintarBuscadorMaestro(
      clave,
      estado.filtradas
    );
  }

  if (clave === 'Edad' || clave === 'Sexo') {
    actualizarClasificacionesEdadSexo();
  }

  buscador?.focus();
}


function validarBuscadoresMaestro() {
  const campos = [
    {
      clave: 'Proveedor',
      id: 'codigoProveedor',
      mensaje:
        'Debe seleccionar un proveedor.'
    },
    {
      clave: 'Grupo',
      id: 'codigoGrupo',
      mensaje:
        'Debe seleccionar un grupo.'
    },
    {
      clave: 'Subgrupo',
      id: 'codigoSubgrupo',
      mensaje:
        'Debe seleccionar un subgrupo.'
    },
    {
      clave: 'Linea',
      id: 'codigoLinea',
      mensaje:
        'Debe seleccionar una línea.'
    },
    {
      clave: 'Deporte',
      id: 'codigoDeporte',
      mensaje:
        'Debe seleccionar un deporte.'
    },
    {
      clave: 'Edad',
      id: 'codigoEdad',
      mensaje:
        'Debe seleccionar una edad.'
    },
    {
      clave: 'Sexo',
      id: 'codigoSexo',
      mensaje:
        'Debe seleccionar un sexo.'
    },
    {
      clave: 'Pais',
      id: 'codigoPais',
      mensaje:
        'Debe seleccionar un país.'
    }
  ];

  for (const campo of campos) {
    if (!valor(campo.id)) {
      mostrarAlerta(
        campo.mensaje,
        'warning'
      );

      document
        .getElementById(
          `buscar${campo.clave}`
        )
        ?.focus();

      return false;
    }
  }

  return true;
}


function pintarColores(lista) {
  const contenedor = document.getElementById('listaColores');
  contenedor.innerHTML = '';
  for (const fila of lista) {
    const codigo = obtenerCampo(fila, ['CODIGO_COLOR','codigoColor']);
    const detalle = obtenerCampo(fila, ['DETALLE_COLOR','detalleColor']);
    if (!codigo) continue;

    const div = document.createElement('div');
    div.className = 'form-check app-color-item';
    div.dataset.texto = `${codigo} ${detalle || ''}`.toUpperCase();

    const input = document.createElement('input');
    input.className = 'form-check-input color-check';
    input.type = 'checkbox';
    input.value = codigo;
    input.id = `color_${codigo}`;
    input.addEventListener(
      'change',
      () => {
        actualizarCantidadColores();
        actualizarImagenesProducto();
      }
    );

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = detalle ? `${codigo} - ${detalle}` : String(codigo);

    div.append(input, label);
    contenedor.appendChild(div);
  }

  actualizarCantidadColores();
}

function pintarColoresSeleccionados() {
  const contenedor =
    document.getElementById('coloresSeleccionados');

  if (!contenedor) return;

  const seleccionados =
    [...document.querySelectorAll('.color-check:checked')];

  contenedor.innerHTML = '';

  if (!seleccionados.length) {
    contenedor.classList.add('d-none');
    contenedor.classList.remove('d-flex');
    return;
  }

  contenedor.classList.remove('d-none');
  contenedor.classList.add('d-flex');

  for (const check of seleccionados) {
    const label =
      document.querySelector(`label[for="${CSS.escape(check.id)}"]`);

    const textoColor =
      label?.textContent?.trim() || check.value;

    const chip = document.createElement('span');
    chip.className =
      'badge rounded-pill text-bg-primary d-inline-flex align-items-center gap-2 px-3 py-2';

    const texto = document.createElement('span');
    texto.textContent = textoColor;

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className =
      'btn btn-sm p-0 border-0 text-white lh-1';
    quitar.style.fontSize = '1rem';
    quitar.style.fontWeight = '700';
    quitar.style.boxShadow = 'none';
    quitar.setAttribute(
      'aria-label',
      `Quitar color ${textoColor}`
    );
    quitar.textContent = '×';

    quitar.addEventListener('click', () => {
      check.checked = false;
      actualizarCantidadColores();
      filtrarColores();
      actualizarImagenesProducto();
    });

    chip.append(texto, quitar);
    contenedor.appendChild(chip);
  }
}

function actualizarCantidadColores() {
  const cantidad = document.querySelectorAll('.color-check:checked').length;
  document.getElementById('cantidadColores').textContent = `${cantidad} seleccionado${cantidad === 1 ? '' : 's'}`;
  pintarColoresSeleccionados();
}

function filtrarColores() {
  const texto = document.getElementById('buscarColor').value.trim().toUpperCase();

  document.querySelectorAll('.app-color-item').forEach(item => {
    const check = item.querySelector('.color-check');
    const seleccionado = Boolean(check?.checked);
    const coincide = !texto || item.dataset.texto.includes(texto);

    // Los colores ya seleccionados permanecen siempre visibles,
    // aunque no coincidan con el filtro de búsqueda.
    item.classList.toggle(
      'd-none',
      !seleccionado && !coincide
    );
  });
}

function configurarEventos() {

  document
    .getElementById('buscarModelo')
    ?.addEventListener(
      'input',
      filtrarModelos
    );

  document
    .getElementById('btnLimpiarModelo')
    ?.addEventListener(
      'click',
      limpiarModeloSeleccionado
    );

  document
    .getElementById('licenciaModelo')
    ?.addEventListener(
      'change',
      cambiarLicenciaModelo
    );

  document
    .getElementById('buscarModulo')
    ?.addEventListener(
      'input',
      filtrarModulos
    );

  document
    .getElementById('btnLimpiarModulo')
    ?.addEventListener(
      'click',
      limpiarModuloSeleccionado
    );

  document.getElementById('formProducto').addEventListener('submit', agregarProducto);
  document.getElementById('buscarColor').addEventListener('input', filtrarColores);
  document.getElementById('btnActualizarAlta').addEventListener('click', cargarAlta);
  document.getElementById('btnGuardarBorrador').addEventListener('click', guardarBorrador);
  document.getElementById('btnAnularAlta')?.addEventListener('click', anularAlta);
  document.getElementById('btnBorradorExcel')?.addEventListener('click', exportarBorradorExcel);
  document.getElementById('btnValidarAlta').addEventListener('click', validarAlta);
  document.getElementById('btnPreviewAlta').addEventListener('click', mostrarPreview);
  document.getElementById('btnExportarPreviewExcel')?.addEventListener('click', exportarPreviewExcel);

  document
    .querySelectorAll('#modalPreviewExportacion [data-bs-dismiss="modal"]')
    .forEach((boton) => {
      boton.addEventListener('click', () => {
        const modalElemento = document.getElementById('modalPreviewExportacion');
        if (!modalElemento || typeof bootstrap === 'undefined') return;

        bootstrap.Modal
          .getOrCreateInstance(modalElemento)
          .hide();
      });
    });

  document.getElementById('btnExportarAlta').addEventListener('click', exportarAlta);

  document
    .getElementById('tablaProductosAlta')
    .addEventListener('click', manejarAccionesDetalle);

  document
    .getElementById('tablaProductosAlta')
    .addEventListener('change', manejarCambioImagenDetalle);

  document
    .getElementById('filtroProductosTexto')
    ?.addEventListener('input', aplicarFiltrosProductos);

  document
    .getElementById('filtroProductosEstado')
    ?.addEventListener('change', aplicarFiltrosProductos);

  document
    .getElementById('filtroProductosTipo')
    ?.addEventListener('change', aplicarFiltrosProductos);

  document
    .getElementById('filtroProductosOrigen')
    ?.addEventListener('change', aplicarFiltrosProductos);

  document
    .getElementById('btnLimpiarFiltrosProductos')
    ?.addEventListener('click', limpiarFiltrosProductos);
}

async function agregarProducto(event) {
  event.preventDefault();
  ocultarAlerta();

  const form = event.currentTarget;

  if (!valor('codigoModelo')) {
    mostrarAlerta(
      'Debe seleccionar un modelo.',
      'warning'
    );

    document
      .getElementById('buscarModelo')
      ?.focus();

    return;
  }

  if (!validarBuscadoresMaestro()) {
    return;
  }

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const codigosColor = [...document.querySelectorAll('.color-check:checked')].map(input => input.value);
  if (!codigosColor.length) {
    mostrarAlerta('Debe seleccionar al menos un color.', 'warning');
    return;
  }

  const payload = {
    codigoModelo: valor('codigoModelo'),
    codigoProveedor: valor('codigoProveedor'),
    codigoGrupo: valor('codigoGrupo'),
    codigoSubgrupo: valor('codigoSubgrupo'),
    codigoLinea: valor('codigoLinea'),
    codigoDeporte: valor('codigoDeporte'),
    codigoEdad: valor('codigoEdad'),
    sexo: valor('codigoSexo'),
    codigoPais: valor('codigoPais'),
    codigosColor,
    usuario: valor('usuarioProducto').toUpperCase()
  };

  if (normalizarTipo(altaActual.TIPO_PRODUCTO) === 'MODULO') {

    if (!valor('codigoModulo')) {
      mostrarAlerta(
        'Debe seleccionar una curva / módulo.',
        'warning'
      );

      document
        .getElementById('buscarModulo')
        ?.focus();

      return;
    }

    const permitidasEdadSexo =
      obtenerClasificacionesPermitidasEdadSexo();

    const detalleClasificacionSeleccionada =
      obtenerClasificacionSeleccionadaDetalle();

    if (!permitidasEdadSexo.length) {
      mostrarAlerta(
        'La combinación de Edad y Sexo no tiene una clasificación de módulo válida.',
        'warning'
      );
      return;
    }

    if (
      !detalleClasificacionSeleccionada ||
      !permitidasEdadSexo.includes(detalleClasificacionSeleccionada)
    ) {
      mostrarAlerta(
        'La clasificación seleccionada no corresponde a la combinación de Edad y Sexo.',
        'warning'
      );
      return;
    }

    payload.codigoClasificacion = valor('codigoClasificacion');
    payload.codigoModulo = valor('codigoModulo');

  } else {
    payload.codigoTalle = valor('codigoTalle');
  }

  const btn = document.getElementById('btnAgregarProducto');

  try {
    btn.disabled = true;
    btn.textContent = 'Generando...';

    const resultado = extraerDatos(await apiJson(`/api/altas/${ID_ALTA}/detalle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }));

    const cantidad =
      resultado?.cantidad ??
      resultado?.cantidadGenerados ??
      resultado?.productos?.length ??
      null;

    const omitidos =
      Array.isArray(resultado?.omitidos)
        ? resultado.omitidos
        : [];

    const cantidadOmitidos =
      Number(
        resultado?.cantidadOmitidos ??
        omitidos.length ??
        0
      ) || 0;

    if (cantidadOmitidos > 0) {
      const omitidosMismaAlta =
        omitidos.filter(
          item =>
            item?.motivo === 'YA_EXISTE_EN_ALTA' ||
            item?.motivo === 'DUPLICADO_OPERACION'
        ).length;

      const omitidosOtraAlta =
        omitidos.filter(
          item =>
            item?.motivo === 'YA_EXISTE_EN_OTRA_ALTA'
        ).length;

      const partesMensaje = [];

      if (cantidad !== null) {
        partesMensaje.push(
          `Familia generada correctamente: ${cantidad} registro(s) nuevo(s).`
        );
      } else {
        partesMensaje.push(
          'Familia generada correctamente.'
        );
      }

      if (omitidosMismaAlta > 0) {
        partesMensaje.push(
          `${omitidosMismaAlta} par(es) suelto(s) ya forman parte de otra familia de esta Alta y no necesitan volver a generarse.`
        );
      }

      if (omitidosOtraAlta > 0) {
        partesMensaje.push(
          `${omitidosOtraAlta} producto(s) ya forman parte de otra Alta activa y fueron omitidos.`
        );
      }

      const omitidosSinDetalle =
        Math.max(
          0,
          cantidadOmitidos -
          omitidosMismaAlta -
          omitidosOtraAlta
        );

      if (omitidosSinDetalle > 0) {
        partesMensaje.push(
          `${omitidosSinDetalle} producto(s) adicional(es) ya existían y fueron omitidos.`
        );
      }

      mostrarAlerta(
        partesMensaje.join(' '),
        omitidosOtraAlta > 0
          ? 'warning'
          : 'info'
      );
    } else {
      mostrarAlerta(
        cantidad !== null
          ? `Producto agregado correctamente. Se generaron ${cantidad} registros.`
          : 'Producto agregado correctamente.',
        'success'
      );
    }

    // Conservamos los colores seleccionados después de generar la familia.
    // Esto permite cargar otra familia con la misma paleta sin volver a marcarlos.
    actualizarCantidadColores();
    actualizarImagenesProducto();
    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Agregar producto';
  }
}


/* ============================================================
   IMAGENES POR FAMILIA
   La fila PRINCIPAL administra la imagen.
   Los hijos automáticos usan la misma imagen.

   Archivo físico:
   COD_AÑO + COD_TEMPORADA + COD_MODELO + COD_COLOR + .JPG/.PNG
   ============================================================ */

async function actualizarImagenesProducto() {
  /* Compatibilidad con llamadas anteriores.
     Las imágenes ahora se pintan dentro de la tabla. */
}


function puedeModificarImagenes() {
  return [
    'BORRADOR',
    'VALIDADO'
  ].includes(
    estadoAlta()
  );
}


function parametrosImagenFamilia(fila) {
  return {
    idAlta:
      ID_ALTA,

    ano:
      String(
        altaActual?.CODIGO_ANO ?? ''
      ).trim(),

    temporada:
      String(
        altaActual?.CODIGO_TEMPORADA ?? ''
      ).trim(),

    modelo:
      String(
        fila?.CODIGO_MODELO ?? ''
      ).trim(),

    color:
      String(
        fila?.CODIGO_COLOR ?? ''
      ).trim()
  };
}


function nombreBaseImagenFamilia(fila) {
  const p =
    parametrosImagenFamilia(
      fila
    );

  return (
    p.ano +
    p.temporada +
    p.modelo +
    p.color
  );
}


function idImagenFamilia(fila) {
  return (
    String(
      fila?.ID_DETALLE ??
      fila?.idDetalle ??
      ''
    )
  ).replace(
    /[^A-Za-z0-9_-]/g,
    '_'
  );
}


function urlEstadoImagenFamilia(fila) {
  const p =
    parametrosImagenFamilia(
      fila
    );

  return (
    '/api/imagenes/estado?' +
    new URLSearchParams({
      ano:
        p.ano,
      temporada:
        p.temporada,
      modelo:
        p.modelo,
      color:
        p.color
    }).toString()
  );
}


function urlArchivoImagenFamilia(fila) {
  const p =
    parametrosImagenFamilia(
      fila
    );

  return (
    '/api/imagenes/archivo?' +
    new URLSearchParams({
      ano:
        p.ano,
      temporada:
        p.temporada,
      modelo:
        p.modelo,
      color:
        p.color,
      v:
        Date.now()
    }).toString()
  );
}


function htmlImagenFamilia(
  fila,
  esPrincipal
) {
  if (!esPrincipal) {
    return `
      <div
        class="alta-family-image-child"
        title="Usa la misma imagen de la fila principal"
      >
        <span class="alta-family-image-child-icon">↳</span>
        <span>Principal</span>
      </div>
    `;
  }

  const id =
    idImagenFamilia(
      fila
    );

  const editable =
    puedeModificarImagenes();

  const nombre =
    nombreBaseImagenFamilia(
      fila
    );

  return `
    <div
      class="alta-family-image"
      data-id-imagen="${escapar(id)}"
      title="${escapar(nombre)}.JPG / PNG"
    >
      <div class="alta-family-image-preview">
        <div
          id="sinFotoFila_${id}"
          class="alta-family-image-empty"
        >
          <span class="alta-family-image-empty-icon">▧</span>
          <span class="alta-family-image-empty-text">Sin foto</span>
        </div>

        <img
          id="fotoFila_${id}"
          class="d-none"
          alt="Imagen ${escapar(
            fila.DETALLE_PRODUCTO ??
            fila.DETALLE ??
            ''
          )}"
        >
      </div>

      <div
        id="estadoFotoFila_${id}"
        class="alta-family-image-status"
      >
        Revisando...
      </div>

      ${
        editable
          ? `
            <div class="alta-family-image-actions">
              <label
                class="btn btn-sm btn-outline-primary alta-family-image-button mb-0"
                title="Seleccionar una imagen JPG o PNG"
              >
                <span id="textoFotoFila_${id}">
                  Agregar
                </span>

                <input
                  type="file"
                  class="d-none control-imagen-producto"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  data-accion="seleccionar-imagen-familia"
                  data-id-detalle="${escapar(
                    fila.ID_DETALLE ??
                    fila.idDetalle ??
                    ''
                  )}"
                >
              </label>

              <button
                type="button"
                id="guardarFotoFila_${id}"
                class="btn btn-sm btn-success alta-family-image-button d-none"
                data-accion="guardar-imagen-familia"
                data-id-detalle="${escapar(
                  fila.ID_DETALLE ??
                  fila.idDetalle ??
                  ''
                )}"
              >
                Guardar
              </button>
            </div>
          `
          : `
            <div class="alta-family-image-readonly">
              Solo lectura
            </div>
          `
      }
    </div>
  `;
}


function buscarFilaDetallePorId(
  idDetalle
) {
  return detalleActual()
    .find(
      item =>
        String(
          item.ID_DETALLE ??
          item.idDetalle ??
          ''
        ) ===
        String(
          idDetalle
        )
    ) || null;
}


async function cargarEstadoImagenFila(
  fila
) {
  const id =
    idImagenFamilia(
      fila
    );

  const img =
    document.getElementById(
      `fotoFila_${id}`
    );

  if (!img) return;

  const sinFoto =
    document.getElementById(
      `sinFotoFila_${id}`
    );

  const estado =
    document.getElementById(
      `estadoFotoFila_${id}`
    );

  const textoBoton =
    document.getElementById(
      `textoFotoFila_${id}`
    );

  try {
    const data =
      await apiJson(
        urlEstadoImagenFamilia(
          fila
        )
      );

    if (
      data.existe
    ) {
      img.src =
        urlArchivoImagenFamilia(
          fila
        );

      img.classList.remove(
        'd-none'
      );

      sinFoto?.classList.add(
        'd-none'
      );

      if (estado) {
        estado.textContent =
          'Imagen guardada';

        estado.className =
          'alta-family-image-status text-success';
      }

      const contenedor =
        img.closest(
          '.alta-family-image'
        );

      if (
        contenedor &&
        data.archivo
      ) {
        contenedor.title =
          data.archivo;
      }

      if (textoBoton) {
        textoBoton.textContent =
          'Reemplazar';
      }

    } else {
      if (estado) {
        estado.textContent =
          'Sin imagen';

        estado.className =
          'alta-family-image-status text-secondary';
      }

      if (textoBoton) {
        textoBoton.textContent =
          'Agregar imagen';
      }
    }

  } catch (error) {
    if (estado) {
      estado.textContent =
        'Error';

      estado.className =
        'alta-family-image-status text-danger';
    }
  }
}


function manejarCambioImagenDetalle(
  event
) {
  const input =
    event.target.closest(
      '[data-accion="seleccionar-imagen-familia"]'
    );

  if (!input) return;

  const fila =
    buscarFilaDetallePorId(
      input.dataset.idDetalle
    );

  if (!fila) return;

  const archivo =
    input.files?.[0];

  const id =
    idImagenFamilia(
      fila
    );

  const botonGuardar =
    document.getElementById(
      `guardarFotoFila_${id}`
    );

  if (!archivo) {
    botonGuardar?.classList.add(
      'd-none'
    );

    cargarEstadoImagenFila(
      fila
    );

    return;
  }

  if (
    ![
      'image/jpeg',
      'image/png'
    ].includes(
      archivo.type
    )
  ) {
    mostrarAlerta(
      'La imagen debe ser JPG o PNG.',
      'warning'
    );

    input.value = '';
    return;
  }

  if (
    archivo.size >
    6 * 1024 * 1024
  ) {
    mostrarAlerta(
      'La imagen supera el máximo permitido de 6 MB.',
      'warning'
    );

    input.value = '';
    return;
  }

  const img =
    document.getElementById(
      `fotoFila_${id}`
    );

  const sinFoto =
    document.getElementById(
      `sinFotoFila_${id}`
    );

  const estado =
    document.getElementById(
      `estadoFotoFila_${id}`
    );

  const extension =
    archivo.type ===
      'image/png'
        ? '.png'
        : '.jpg';

  if (img) {
    img.src =
      URL.createObjectURL(
        archivo
      );

    img.classList.remove(
      'd-none'
    );
  }

  sinFoto?.classList.add(
    'd-none'
  );

  if (estado) {
    estado.textContent =
      'Vista previa';

    estado.className =
      'alta-family-image-status text-primary';
  }

  const contenedor =
    img?.closest(
      '.alta-family-image'
    );

  if (contenedor) {
    contenedor.title =
      nombreBaseImagenFamilia(
        fila
      ) +
      extension;
  }

  botonGuardar?.classList.remove(
    'd-none'
  );
}


async function archivoABase64Familia(
  archivo
) {
  return new Promise(
    (resolve, reject) => {
      const lector =
        new FileReader();

      lector.onload =
        () => {
          const resultado =
            String(
              lector.result || ''
            );

          const coma =
            resultado.indexOf(
              ','
            );

          resolve(
            coma >= 0
              ? resultado.slice(
                  coma + 1
                )
              : resultado
          );
        };

      lector.onerror =
        () =>
          reject(
            new Error(
              'No se pudo leer la imagen seleccionada.'
            )
          );

      lector.readAsDataURL(
        archivo
      );
    }
  );
}


async function guardarImagenFamilia(
  boton
) {
  if (
    !puedeModificarImagenes()
  ) {
    mostrarAlerta(
      'Las imágenes solamente se pueden modificar en BORRADOR o VALIDADO.',
      'warning'
    );
    return;
  }

  const fila =
    buscarFilaDetallePorId(
      boton.dataset.idDetalle
    );

  if (!fila) {
    mostrarAlerta(
      'No se pudo identificar el producto principal.',
      'danger'
    );
    return;
  }

  const id =
    idImagenFamilia(
      fila
    );

  const input =
    document.querySelector(
      `[data-accion="seleccionar-imagen-familia"][data-id-detalle="${CSS.escape(
        String(
          fila.ID_DETALLE ??
          fila.idDetalle ??
          ''
        )
      )}"]`
    );

  const archivo =
    input?.files?.[0];

  if (!archivo) {
    mostrarAlerta(
      'Seleccioná una imagen antes de guardar.',
      'warning'
    );
    return;
  }

  const estado =
    document.getElementById(
      `estadoFotoFila_${id}`
    );

  try {
    boton.disabled =
      true;

    boton.textContent =
      'Guardando...';

    const contenidoBase64 =
      await archivoABase64Familia(
        archivo
      );

    const resultado =
      await apiJson(
        '/api/imagenes/producto',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              ...parametrosImagenFamilia(
                fila
              ),
              contenidoBase64
            })
        }
      );

    input.value = '';

    boton.classList.add(
      'd-none'
    );

    await cargarEstadoImagenFila(
      fila
    );

    mostrarToastProductos(
      `Imagen ${resultado.archivo} guardada correctamente.`,
      'success'
    );

  } catch (error) {
    if (estado) {
      estado.textContent =
        'Error al guardar';

      estado.className =
        'alta-family-image-status text-danger';
    }

    mostrarAlerta(
      error.message,
      'danger'
    );

  } finally {
    boton.disabled =
      false;

    boton.textContent =
      'Guardar';
  }
}



function obtenerIdsPadresFamilia(fila) {
  const relaciones =
    fila.FAMILIAS_PADRE ??
    fila.familiasPadre ??
    [];

  if (Array.isArray(relaciones) && relaciones.length) {
    return [
      ...new Set(
        relaciones
          .map(Number)
          .filter(
            id =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    ];
  }

  const legado =
    fila.ID_DETALLE_PADRE ??
    fila.idDetallePadre ??
    null;

  if (
    legado !== null &&
    legado !== undefined &&
    legado !== ''
  ) {
    const id = Number(legado);

    return Number.isInteger(id) && id > 0
      ? [id]
      : [];
  }

  return [];
}


function pintarDetalle() {
  const detalle = Array.isArray(altaActual.detalle)
    ? altaActual.detalle
    : (Array.isArray(altaActual.DETALLE) ? altaActual.DETALLE : []);

  /*
   * Los contadores representan PRODUCTOS FÍSICOS únicos,
   * no cantidad de relaciones visuales con familias.
   */
  document.getElementById('cantidadProductosAlta').textContent = detalle.length;

  const cantidadExistentesERP =
    detalle.filter(
      item =>
        String(item.ESTADO_VALIDACION || '').toUpperCase() === 'EXISTE_ERP'
    ).length;

  document.getElementById('cantidadProductosExistentesERP').textContent =
    cantidadExistentesERP;

  document.getElementById('cantidadProductosExportables').textContent =
    detalle.length - cantidadExistentesERP;

  const tbody = document.getElementById('tablaProductosAlta');
  tbody.innerHTML = '';

  if (!detalle.length) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="text-center py-4 text-secondary">Todavía no hay productos en esta alta.</td></tr>';
    return;
  }

  const puedeEditar = estadoAlta() === 'BORRADOR';

  const principales =
    detalle.filter(
      item =>
        !esValorVerdadero(
          item.GENERADO_AUTOMATICO
        )
    );

  const automaticos =
    detalle.filter(
      item =>
        esValorVerdadero(
          item.GENERADO_AUTOMATICO
        )
    );

  const hijosPorPadre = new Map();

  for (const hijo of automaticos) {
    for (const idPadre of obtenerIdsPadresFamilia(hijo)) {
      const clave =
        String(idPadre);

      if (!hijosPorPadre.has(clave)) {
        hijosPorPadre.set(clave, []);
      }

      hijosPorPadre
        .get(clave)
        .push(hijo);
    }
  }

  function renderFila(
    fila,
    {
      esPrincipal,
      idPadreVisual = null
    }
  ) {
    const generadoAutomatico =
      esValorVerdadero(
        fila.GENERADO_AUTOMATICO
      );

    const idDetalle =
      fila.ID_DETALLE ??
      fila.idDetalle;

    const tipoDetalle = String(
      fila.TIPO_PRODUCTO_DETALLE ??
      fila.TIPO_PRODUCTO ??
      ''
    ).toUpperCase();

    const puedeEliminar =
      puedeEditar &&
      esPrincipal &&
      idDetalle;

    const cantidadHijos =
      esPrincipal && idDetalle
        ? (
            hijosPorPadre.get(
              String(idDetalle)
            ) || []
          ).length
        : 0;

    const botonFamilia =
      cantidadHijos > 0
        ? `
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary alta-family-toggle"
            data-accion="toggle-familia"
            data-id-padre="${escapar(idDetalle)}"
            data-cantidad-hijos="${cantidadHijos}"
            aria-expanded="false"
            title="Mostrar productos automáticos de esta familia"
          >
            <span class="alta-family-toggle-icon" aria-hidden="true">▸</span>
            <span class="alta-family-toggle-text">Ver familia (${cantidadHijos})</span>
          </button>
        `
        : '';

    let botonEliminar = '';

    if (puedeEliminar) {
      const texto =
        tipoDetalle === 'MODULO'
          ? 'Eliminar familia'
          : 'Eliminar';

      botonEliminar = `
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          data-accion="eliminar-detalle"
          data-id-detalle="${escapar(idDetalle)}"
          data-tipo-detalle="${escapar(tipoDetalle)}"
          data-codigo-alfa="${escapar(fila.CODIGO_ALFA ?? fila.COD_ALFA ?? '')}"
        >
          ${texto}
        </button>
      `;
    }

    const accion =
      (botonFamilia || botonEliminar)
        ? `
          <div class="alta-family-actions">
            ${botonFamilia}
            ${botonEliminar}
          </div>
        `
        : '<span class="text-secondary">-</span>';

    const estadoValidacion =
      String(fila.ESTADO_VALIDACION || 'VALIDO').toUpperCase();

    const badgeEstado =
      estadoValidacion === 'EXISTE_ERP'
        ? '<span class="badge rounded-pill text-bg-warning px-3 py-2">YA EXISTE EN PRESEA</span>'
        : '<span class="badge rounded-pill text-bg-success px-3 py-2">NUEVO</span>';

    const tr =
      document.createElement('tr');

    tr.dataset.idDetalleProducto =
      String(idDetalle ?? '');

    if (esPrincipal) {
      tr.classList.add(
        'alta-row-principal'
      );

      tr.dataset.idFamiliaPrincipal =
        String(idDetalle ?? '');

    } else {
      tr.classList.add(
        'alta-row-hijo',
        'd-none'
      );

      if (
        idPadreVisual !== null &&
        idPadreVisual !== undefined
      ) {
        tr.dataset.idPadreFamilia =
          String(idPadreVisual);
      }
    }

    if (estadoValidacion === 'EXISTE_ERP') {
      tr.classList.add(
        'alta-row-existente'
      );

      tr.title =
        fila.OBSERVACION_VALIDACION ||
        'Ya existe en Presea';
    }

    const origenFiltro =
      esPrincipal
        ? 'PRINCIPAL'
        : 'AUTOMATICO';

    const estadoFiltro =
      estadoValidacion === 'EXISTE_ERP'
        ? 'EXISTE_ERP'
        : 'NUEVO';

    tr.dataset.filtroTexto = normalizarTextoFiltro([
      fila.CODIGO_ALFA ?? fila.COD_ALFA ?? '',
      fila.DETALLE_PRODUCTO ?? fila.DETALLE ?? '',
      fila.DETALLE_COLOR ?? fila.CODIGO_COLOR ?? '',
      fila.DETALLE_CLASIFICACION ?? fila.CODIGO_CLASIFICACION ?? '',
      fila.DETALLE_MODULO ?? fila.DETALLE_TALLE ??
        fila.CODIGO_MODULO ?? fila.CODIGO_TALLE ?? ''
    ].join(' '));

    tr.dataset.filtroEstado =
      estadoFiltro;

    tr.dataset.filtroTipo =
      normalizarTipo(tipoDetalle);

    tr.dataset.filtroOrigen =
      origenFiltro;

    const badgeOrigen =
      esPrincipal
        ? '<span class="badge alta-badge-principal">PRINCIPAL</span>'
        : '<span class="badge alta-badge-auto">AUTOMÁTICO</span>';

    const detalleVisual =
      esPrincipal
        ? `<div class="fw-semibold">${escapar(fila.DETALLE_PRODUCTO ?? fila.DETALLE ?? '-')}</div>`
        : `<div class="alta-child-detail"><span class="alta-child-line"></span>${escapar(fila.DETALLE_PRODUCTO ?? fila.DETALLE ?? '-')}</div>`;

    tr.innerHTML = `
      <td class="font-monospace alta-cod-alfa">${escapar(fila.CODIGO_ALFA ?? fila.COD_ALFA ?? '-')}</td>
      <td>${detalleVisual}</td>
      <td>${escapar(fila.TIPO_PRODUCTO_DETALLE ?? fila.TIPO_PRODUCTO ?? '-')}</td>
      <td>${escapar(fila.DETALLE_CLASIFICACION ?? fila.CODIGO_CLASIFICACION ?? '-')}</td>
      <td>${escapar(fila.DETALLE_COLOR ?? fila.CODIGO_COLOR ?? '-')}</td>
      <td>${escapar(fila.DETALLE_MODULO ?? fila.DETALLE_TALLE ?? fila.CODIGO_MODULO ?? fila.CODIGO_TALLE ?? '-')}</td>
      <td>${badgeOrigen}</td>
      <td class="alta-image-cell">${htmlImagenFamilia(fila, esPrincipal)}</td>
      <td>${badgeEstado}</td>
      <td class="text-end text-nowrap">${accion}</td>`;

    tbody.appendChild(tr);

    if (esPrincipal) {
      cargarEstadoImagenFila(
        fila
      );
    }
  }

  /*
   * Cada principal se dibuja seguido de TODOS los productos automáticos
   * que forman parte de su curva. Un mismo producto puede aparecer
   * visualmente debajo de más de una familia, pero sigue existiendo
   * una sola vez en ALTAS_PRODUCTOS_DETALLE.
   */
  for (const principal of principales) {
    const idPrincipal =
      principal.ID_DETALLE ??
      principal.idDetalle;

    renderFila(
      principal,
      {
        esPrincipal: true
      }
    );

    const hijos =
      hijosPorPadre.get(
        String(idPrincipal)
      ) || [];

    for (const hijo of hijos) {
      renderFila(
        hijo,
        {
          esPrincipal: false,
          idPadreVisual: idPrincipal
        }
      );
    }
  }

  /*
   * Salvaguarda para datos históricos inconsistentes:
   * si existiera un automático sin ninguna relación, se muestra una sola
   * vez como hijo huérfano para que no quede invisible.
   */
  const idsRelacionados =
    new Set(
      [...hijosPorPadre.values()]
        .flat()
        .map(item =>
          String(
            item.ID_DETALLE ??
            item.idDetalle ??
            ''
          )
        )
    );

  for (const hijo of automaticos) {
    const idHijo =
      String(
        hijo.ID_DETALLE ??
        hijo.idDetalle ??
        ''
      );

    if (!idsRelacionados.has(idHijo)) {
      renderFila(
        hijo,
        {
          esPrincipal: false,
          idPadreVisual: null
        }
      );
    }
  }

  aplicarFiltrosProductos();
}


/* ============================================================
   FILTROS - PRODUCTOS GENERADOS
   ============================================================ */

function normalizarTextoFiltro(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}


function obtenerFiltrosProductos() {
  return {
    texto:
      normalizarTextoFiltro(
        document.getElementById('filtroProductosTexto')?.value
      ),

    estado:
      String(
        document.getElementById('filtroProductosEstado')?.value || ''
      ).trim().toUpperCase(),

    tipo:
      normalizarTipo(
        document.getElementById('filtroProductosTipo')?.value
      ),

    origen:
      String(
        document.getElementById('filtroProductosOrigen')?.value || ''
      ).trim().toUpperCase()
  };
}


function hayFiltrosProductosActivos(filtros = obtenerFiltrosProductos()) {
  return Boolean(
    filtros.texto ||
    filtros.estado ||
    filtros.tipo ||
    filtros.origen
  );
}


function restaurarFamiliasPlegadas() {
  document
    .querySelectorAll('#tablaProductosAlta tr.alta-row-hijo')
    .forEach(fila => {
      fila.classList.add('d-none');
    });

  document
    .querySelectorAll('#tablaProductosAlta .alta-family-toggle')
    .forEach(boton => {
      boton.setAttribute('aria-expanded', 'false');

      const icono =
        boton.querySelector('.alta-family-toggle-icon');

      const texto =
        boton.querySelector('.alta-family-toggle-text');

      const cantidad =
        Number(boton.dataset.cantidadHijos || 0);

      if (icono) {
        icono.textContent = '▸';
      }

      if (texto) {
        texto.textContent =
          `Ver familia (${cantidad})`;
      }

      boton.title =
        'Mostrar productos automáticos de esta familia';
    });
}


function aplicarFiltrosProductos() {
  const tbody =
    document.getElementById('tablaProductosAlta');

  if (!tbody) return;

  const filas =
    [...tbody.querySelectorAll('tr')].filter(
      fila =>
        fila.dataset.filtroTexto !== undefined
    );

  if (!filas.length) {
    const resultado =
      document.getElementById('resultadoFiltrosProductos');

    if (resultado) {
      resultado.textContent = '';
    }

    return;
  }

  const filtros =
    obtenerFiltrosProductos();

  const activos =
    hayFiltrosProductosActivos(filtros);

  tbody.classList.toggle(
    'alta-filtros-activos',
    activos
  );

  if (!activos) {
    for (const fila of filas) {
      fila.classList.remove('alta-filter-hidden');
    }

    restaurarFamiliasPlegadas();

    const principales =
      filas.filter(
        fila =>
          fila.dataset.filtroOrigen === 'PRINCIPAL'
      ).length;

    const resultado =
      document.getElementById('resultadoFiltrosProductos');

    if (resultado) {
      resultado.textContent =
        `${principales} familia(s)`;
    }

    return;
  }

  /*
    Con filtros activos mostramos las coincidencias reales,
    incluidos productos automáticos. Así el filtro Origen
    "Automático" tiene utilidad aunque las familias normalmente
    estén plegadas.
  */
  const automaticosMostrados =
    new Set();

  for (const fila of filas) {
    fila.classList.remove('d-none');

    const coincideTexto =
      !filtros.texto ||
      String(fila.dataset.filtroTexto || '')
        .includes(filtros.texto);

    const coincideEstado =
      !filtros.estado ||
      fila.dataset.filtroEstado === filtros.estado;

    const coincideTipo =
      !filtros.tipo ||
      fila.dataset.filtroTipo === filtros.tipo;

    const coincideOrigen =
      !filtros.origen ||
      fila.dataset.filtroOrigen === filtros.origen;

    let visible =
      coincideTexto &&
      coincideEstado &&
      coincideTipo &&
      coincideOrigen;

    /*
     * Un automático compartido puede tener varias filas visuales
     * (una por familia), pero con filtros debe contarse/mostrarse
     * una sola vez porque físicamente es un único producto.
     */
    if (
      visible &&
      fila.dataset.filtroOrigen === 'AUTOMATICO'
    ) {
      const idProducto =
        fila.dataset.idDetalleProducto || '';

      if (
        idProducto &&
        automaticosMostrados.has(idProducto)
      ) {
        visible = false;
      } else if (idProducto) {
        automaticosMostrados.add(idProducto);
      }
    }

    fila.classList.toggle(
      'alta-filter-hidden',
      !visible
    );
  }

  const visibles =
    filas.filter(
      fila =>
        !fila.classList.contains('alta-filter-hidden')
    ).length;

  const resultado =
    document.getElementById('resultadoFiltrosProductos');

  if (resultado) {
    resultado.textContent =
      visibles === 1
        ? '1 coincidencia'
        : `${visibles} coincidencias`;
  }
}


function limpiarFiltrosProductos() {
  const ids = [
    'filtroProductosTexto',
    'filtroProductosEstado',
    'filtroProductosTipo',
    'filtroProductosOrigen'
  ];

  for (const id of ids) {
    const control =
      document.getElementById(id);

    if (control) {
      control.value = '';
    }
  }

  aplicarFiltrosProductos();

  document
    .getElementById('filtroProductosTexto')
    ?.focus();
}


function alternarFamilia(boton) {
  /*
    El modo filtro muestra coincidencias individuales.
    Al usar "Ver familia", volvemos a la navegación normal
    para evitar mezclar ambos modos de visibilidad.
  */
  if (hayFiltrosProductosActivos()) {
    limpiarFiltrosProductos();
  }

  const idPadre =
    String(
      boton.dataset.idPadre || ''
    );

  if (!idPadre) return;

  const filas =
    document.querySelectorAll(
      '#tablaProductosAlta tr[data-id-padre-familia]'
    );

  const filasFamilia =
    [...filas].filter(
      fila =>
        String(fila.dataset.idPadreFamilia || '') === idPadre
    );

  if (!filasFamilia.length) return;

  const estaAbierta =
    boton.getAttribute('aria-expanded') === 'true';

  const abrir =
    !estaAbierta;

  for (const fila of filasFamilia) {
    fila.classList.toggle(
      'd-none',
      !abrir
    );
  }

  boton.setAttribute(
    'aria-expanded',
    abrir ? 'true' : 'false'
  );

  const cantidad =
    Number(
      boton.dataset.cantidadHijos || filasFamilia.length
    );

  const icono =
    boton.querySelector(
      '.alta-family-toggle-icon'
    );

  const texto =
    boton.querySelector(
      '.alta-family-toggle-text'
    );

  if (icono) {
    icono.textContent =
      abrir ? '▾' : '▸';
  }

  if (texto) {
    texto.textContent =
      abrir
        ? `Ocultar familia (${cantidad})`
        : `Ver familia (${cantidad})`;
  }

  boton.title =
    abrir
      ? 'Ocultar productos automáticos de esta familia'
      : 'Mostrar productos automáticos de esta familia';
}

function esValorVerdadero(valor) {
  return (
    valor === true ||
    valor === 1 ||
    String(valor).trim().toLowerCase() === 'true'
  );
}

async function manejarAccionesDetalle(event) {
  const botonFamilia =
    event.target.closest(
      '[data-accion="toggle-familia"]'
    );

  if (botonFamilia) {
    alternarFamilia(
      botonFamilia
    );
    return;
  }

  const botonImagen =
    event.target.closest(
      '[data-accion="guardar-imagen-familia"]'
    );

  if (botonImagen) {
    await guardarImagenFamilia(
      botonImagen
    );
    return;
  }

  const boton = event.target.closest(
    '[data-accion="eliminar-detalle"]'
  );

  if (!boton) return;

  if (estadoAlta() !== 'BORRADOR') {
    mostrarAlerta(
      `No se pueden eliminar productos porque el alta está en estado ${estadoAlta()}.`,
      'warning'
    );
    return;
  }

  const idDetalle = boton.dataset.idDetalle;
  const tipoDetalle = String(
    boton.dataset.tipoDetalle || ''
  ).toUpperCase();
  const codigoAlfa = boton.dataset.codigoAlfa || '';

  const mensaje =
    tipoDetalle === 'MODULO'
      ? (
          `Se eliminará la familia completa del módulo ${codigoAlfa}.\n\n` +
          'Esto incluye el MÓDULO y todas las PRIMERAS y SEGUNDAS ' +
          'generadas automáticamente para sus talles.\n\n' +
          '¿Continuar?'
        )
      : (
          `Se eliminará el producto ${codigoAlfa} y su familia automática.\n\n` +
          '¿Continuar?'
        );

  if (!window.confirm(mensaje)) return;

  const textoOriginal = boton.textContent;

  try {
    boton.disabled = true;
    boton.textContent = 'Eliminando...';

    await apiJson(
      `/api/altas/${ID_ALTA}/detalle/${idDetalle}`,
      {
        method: 'DELETE'
      }
    );

    mostrarAlerta(
      tipoDetalle === 'MODULO'
        ? 'Familia del módulo eliminada correctamente.'
        : 'Producto y su familia eliminados correctamente.',
      'success'
    );

    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');

    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}


function valor(id) { return document.getElementById(id).value.trim(); }

function obtenerCampo(objeto, candidatos) {
  for (const campo of candidatos) {
    if (Object.prototype.hasOwnProperty.call(objeto, campo)) return objeto[campo];
  }
}

function camelizar(valor) {
  const partes = String(valor).toLowerCase().split('_');
  return partes.map((parte, i) => i === 0 ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)).join('');
}

let timerToastProductos = null;

function mostrarToastProductos(mensaje, tipo = 'success') {
  let contenedor =
    document.getElementById('toastProductosContainer');

  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toastProductosContainer';
    contenedor.className = 'alta-toast-container';
    document.body.appendChild(contenedor);
  }

  let toast =
    document.getElementById('toastProductos');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastProductos';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    contenedor.appendChild(toast);
  }

  if (timerToastProductos) {
    clearTimeout(timerToastProductos);
    timerToastProductos = null;
  }

  const iconos = {
    success: '✓',
    danger: '!',
    warning: '!',
    info: 'i'
  };

  toast.className =
    `alta-toast alta-toast-${tipo}`;

  toast.innerHTML = `
    <span class="alta-toast-icon" aria-hidden="true">
      ${iconos[tipo] || 'i'}
    </span>

    <span class="alta-toast-message">
      ${escapar(mensaje)}
    </span>

    <button
      type="button"
      class="alta-toast-close"
      aria-label="Cerrar"
    >
      ×
    </button>
  `;

  toast
    .querySelector('.alta-toast-close')
    ?.addEventListener(
      'click',
      () => {
        toast.classList.remove('is-visible');
      },
      { once: true }
    );

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  const duracionPorTipo = {
    success: 3800,
    info: 4200,
    warning: 5200,
    danger: 6500
  };

  timerToastProductos =
    setTimeout(() => {
      toast.classList.remove('is-visible');
    }, duracionPorTipo[tipo] || 4200);
}


function mostrarAlerta(mensaje, tipo = 'info') {
  /*
   * Mensajes transitorios de control:
   * success / warning / danger / info
   *
   * Se muestran como toast flotante para no alterar la posición
   * de trabajo del usuario dentro de la pantalla.
   */
  mostrarToastProductos(
    mensaje,
    tipo
  );

  /*
   * Compatibilidad:
   * si quedó visible la antigua alerta superior por una versión
   * anterior del front, la ocultamos sin mover el scroll.
   */
  const alerta =
    document.getElementById('alertaProductos');

  if (alerta) {
    alerta.className =
      'alert d-none';

    alerta.textContent =
      '';
  }
}

function ocultarAlerta() {
  const alerta =
    document.getElementById('alertaProductos');

  if (alerta) {
    alerta.className =
      'alert d-none';

    alerta.textContent =
      '';
  }

  const toast =
    document.getElementById(
      'toastProductos'
    );

  toast?.classList.remove(
    'is-visible'
  );

  if (timerToastProductos) {
    clearTimeout(
      timerToastProductos
    );

    timerToastProductos =
      null;
  }
}

function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");
}


/* ============================================================
   CIERRE DEL ALTA
   VALIDAR -> PREVIEW -> EXPORTAR DBI
   ============================================================ */

function estadoAlta() {
  return String(altaActual?.ESTADO || '').trim().toUpperCase();
}

function detalleActual() {
  if (Array.isArray(altaActual?.detalle)) return altaActual.detalle;
  if (Array.isArray(altaActual?.DETALLE)) return altaActual.DETALLE;
  return [];
}

function actualizarControlesEstado() {
  const estado = estadoAlta();
  const cantidad = detalleActual().length;

  const btnAgregar = document.getElementById('btnAgregarProducto');
  const btnGuardarBorrador = document.getElementById('btnGuardarBorrador');
  const btnAnular = document.getElementById('btnAnularAlta');
  const btnBorradorExcel = document.getElementById('btnBorradorExcel');
  const btnValidar = document.getElementById('btnValidarAlta');
  const btnPreview = document.getElementById('btnPreviewAlta');
  const btnExportar = document.getElementById('btnExportarAlta');
  const btnSeguimiento = document.getElementById('btnSeguimientoAlta');
  const panelForm = document.getElementById('formProducto');
  const mensajeEstado = document.getElementById('mensajeEstadoAlta');
  const archivo = document.getElementById('archivoExportadoAlta');
  const panelCargaProductos = document.getElementById('panelCargaProductos');
  const panelMotivoAnulacion = document.getElementById('panelMotivoAnulacion');
  const motivoAnulacionAlta = document.getElementById('motivoAnulacionAlta');

  const esBorrador = estado === 'BORRADOR';
  const esValidado = estado === 'VALIDADO';
  const esAnulado = estado === 'ANULADO';
  const esSinNovedadesERP = estado === 'SIN_NOVEDADES_ERP';
  const esExportado = ['EXPORTADO', 'PARCIAL_ERP', 'GENERADO_OK_EN_ERP'].includes(estado);

  /*
   * Fuera de BORRADOR la carga queda cerrada también visualmente.
   * No alcanza con deshabilitar inputs/buttons porque los maestros
   * personalizados (Modelo, Grupo, Subgrupo, etc.) se renderizan como
   * listas HTML y todavía podían seleccionarse visualmente.
   *
   * En VALIDADO / EXPORTADO / PARCIAL_ERP / GENERADO_OK_EN_ERP / ANULADO
   * ocultamos todo el panel de selección. El detalle generado permanece
   * visible para consulta, filtros, familias e imágenes existentes.
   */
  if (panelCargaProductos) {
    panelCargaProductos.classList.toggle(
      'd-none',
      !esBorrador
    );
  }

  if (panelMotivoAnulacion) {
    panelMotivoAnulacion.classList.toggle('d-none', !esAnulado);

    if (esAnulado && motivoAnulacionAlta) {
      motivoAnulacionAlta.textContent =
        String(
          altaActual?.MOTIVO_ANULACION ??
          altaActual?.motivoAnulacion ??
          'Sin motivo informado.'
        ).trim() || 'Sin motivo informado.';
    }
  }

  if (panelForm) {
    panelForm.querySelectorAll('input, select, button').forEach(control => {
      if (control.id === 'btnActualizarAlta') return;

      control.disabled = !esBorrador;
    });
  }

  if (btnAgregar) btnAgregar.disabled = !esBorrador;

  if (btnGuardarBorrador) {
    btnGuardarBorrador.disabled = !esBorrador;
    btnGuardarBorrador.classList.toggle('d-none', !esBorrador);
  }

  if (btnAnular) {
    btnAnular.disabled = !esBorrador;
    btnAnular.classList.toggle('d-none', !esBorrador);
  }

  if (btnBorradorExcel) {
    const tieneModulos =
      detalleActual().some(
        item =>
          String(
            item?.TIPO_PRODUCTO_DETALLE ??
            altaActual?.TIPO_PRODUCTO ??
            ''
          )
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_') === 'MODULO'
      );

    btnBorradorExcel.disabled =
      !esBorrador ||
      !tieneModulos;

    btnBorradorExcel.classList.toggle(
      'd-none',
      !esBorrador ||
      !tieneModulos
    );
  }

  if (btnValidar) {
    btnValidar.disabled = !esBorrador || cantidad === 0;
    btnValidar.classList.toggle('d-none', !esBorrador);
  }

  if (btnPreview) {
    btnPreview.disabled = !esValidado;
    btnPreview.classList.toggle('d-none', !esValidado);
  }

  if (btnExportar) {
    btnExportar.disabled = !esValidado;
    btnExportar.classList.toggle('d-none', !esValidado);
  }

  if (btnSeguimiento) {
    btnSeguimiento.classList.toggle(
      'd-none',
      !['EXPORTADO', 'PARCIAL_ERP', 'GENERADO_OK_EN_ERP', 'SIN_NOVEDADES_ERP'].includes(estado)
    );
  }

  if (mensajeEstado) {
    if (esBorrador) {
      mensajeEstado.className = 'alert alert-info mb-3';
      mensajeEstado.textContent =
        cantidad === 0
          ? 'Agregá productos al lote. Cuando haya productos, podrás validar el alta.'
          : 'El lote está en BORRADOR. Podés agregar productos, eliminar familias o validarlo para cerrar definitivamente la edición.';
    } else if (esValidado) {
      mensajeEstado.className = 'alert alert-success mb-3';
      mensajeEstado.textContent =
        'Alta VALIDADA. La carga de productos quedó bloqueada. Revisá el Preview y luego exportá el DBI.';
    } else if (esSinNovedadesERP) {
      mensajeEstado.className = 'alert alert-info mb-3';
      mensajeEstado.textContent =
        'Alta cerrada SIN NOVEDADES ERP. Todos los productos ya existian en Presea; no se genero ningun DBI ni queda sincronizacion pendiente.';
    } else if (esExportado) {
      mensajeEstado.className = 'alert alert-primary mb-3';
      mensajeEstado.textContent =
        'Alta exportada. El lote ya no admite modificaciones.';
    } else if (esAnulado) {
      mensajeEstado.className = 'alert alert-danger mb-3';
      mensajeEstado.textContent =
        'Alta ANULADA. El lote queda disponible únicamente para consulta.';
    } else {
      mensajeEstado.className = 'alert alert-secondary mb-3';
      mensajeEstado.textContent = `Estado actual: ${estado || '-'}.`;
    }
  }

  if (archivo) {
    const nombre = altaActual?.ARCHIVO_EXPORTADO;
    archivo.textContent = nombre || '-';
  }

  document.getElementById('estadoAltaCabecera').className =
    `badge ${claseEstado(estado)}`;
}

function claseEstado(estado) {
  switch (estado) {
    case 'BORRADOR': return 'text-bg-secondary';
    case 'VALIDADO': return 'text-bg-success';
    case 'EXPORTADO': return 'text-bg-primary';
    case 'PARCIAL_ERP': return 'text-bg-warning';
    case 'GENERADO_OK_EN_ERP': return 'text-bg-success';
    case 'SIN_NOVEDADES_ERP': return 'text-bg-info';
    case 'ANULADO': return 'text-bg-danger';
    default: return 'text-bg-secondary';
  }
}

function usuarioOperacion() {
  const valorUsuario =
    document.getElementById('usuarioProducto')?.value?.trim().toUpperCase();

  return valorUsuario || altaActual?.USUARIO_CREACION || 'SISTEMA';
}


async function anularAlta() {
  if (estadoAlta() !== 'BORRADOR') {
    mostrarAlerta(
      `El alta no puede anularse desde el estado ${estadoAlta()}.`,
      'warning'
    );
    return;
  }

  const aceptar = window.confirm(
    'Se anulará esta Alta.\n\n' +
    'Los productos permanecerán registrados como histórico y las imágenes físicas no se eliminarán.\n\n' +
    '¿Continuar?'
  );

  if (!aceptar) return;

  const motivo = window.prompt(
    'Ingresá el motivo de la anulación:',
    ''
  );

  if (motivo === null) return;

  const motivoLimpio = String(motivo).trim();

  if (!motivoLimpio) {
    mostrarAlerta(
      'Debés indicar un motivo para anular el Alta.',
      'warning'
    );
    return;
  }

  if (motivoLimpio.length > 500) {
    mostrarAlerta(
      'El motivo de anulación no puede superar los 500 caracteres.',
      'warning'
    );
    return;
  }

  const btn = document.getElementById('btnAnularAlta');
  const textoOriginal = btn?.textContent || 'Anular Alta';

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Anulando...';
    }

    await apiJson(
      `/api/altas/${ID_ALTA}/anular`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usuario: usuarioOperacion(),
          motivo: motivoLimpio
        })
      }
    );

    mostrarAlerta(
      'Alta anulada correctamente.',
      'success'
    );

    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');

    if (btn) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }
}


async function guardarBorrador() {
  ocultarAlerta();

  const btn =
    document.getElementById('btnGuardarBorrador');

  try {
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    /*
      La cabecera y cada detalle ya se persisten en SQL al momento
      de crearlos/eliminarlos. Recargamos desde la API para confirmar
      que el estado siga siendo BORRADOR antes de salir.
    */
    await cargarAlta();

    if (estadoAlta() !== 'BORRADOR') {
      throw new Error(
        `El alta ya no está en BORRADOR. Estado actual: ${estadoAlta()}.`
      );
    }

    const cantidad = detalleActual().length;

    window.location.href =
      `/altas?guardado=${encodeURIComponent(ID_ALTA)}` +
      `&productos=${encodeURIComponent(cantidad)}`;

  } catch (error) {
    mostrarAlerta(error.message, 'danger');

    btn.disabled = false;
    btn.textContent = 'Guardar borrador';
  }
}

async function validarAlta() {
  if (estadoAlta() !== 'BORRADOR') {
    mostrarAlerta(`El alta no puede validarse desde el estado ${estadoAlta()}.`, 'warning');
    return;
  }

  const detalle = detalleActual();
  const cantidad = detalle.length;

  const cantidadExistentesERP =
    detalle.filter(
      item =>
        String(item.ESTADO_VALIDACION || '').toUpperCase() === 'EXISTE_ERP'
    ).length;

  const cantidadAExportar =
    cantidad - cantidadExistentesERP;

  if (!cantidad) {
    mostrarAlerta('El alta no contiene productos para validar.', 'warning');
    return;
  }

  const mensajeConfirmacion =
    cantidadAExportar === 0
      ? (
          `Productos del lote: ${cantidad}\n` +
          `Ya existen en Presea: ${cantidadExistentesERP}\n` +
          'Nuevos / a exportar: 0\n\n' +
          'Todos los productos del lote ya existen en Presea.\n' +
          'Esta Alta se cerrara como SIN_NOVEDADES_ERP, no generara archivos DBI y no quedara pendiente de sincronizacion.\n\n' +
          'Despues de cerrar ya no podras agregar ni quitar productos de este lote.\n\n' +
          '¿Cerrar el Alta?'
        )
      : (
          `Productos del lote: ${cantidad}\n` +
          `Ya existen en Presea: ${cantidadExistentesERP}\n` +
          `Nuevos / a exportar: ${cantidadAExportar}\n\n` +
          'Despues de validar ya no podras agregar ni quitar productos de este lote.\n\n' +
          '¿Continuar?'
        );

  const aceptar = window.confirm(
    mensajeConfirmacion
  );

  if (!aceptar) return;

  const btn = document.getElementById('btnValidarAlta');

  try {
    btn.disabled = true;
    btn.textContent = 'Validando...';

    const respuesta = extraerDatos(await apiJson(
      `/api/altas/${ID_ALTA}/validar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuarioOperacion() })
      }
    ));

    const cantidadValidada =
      respuesta?.cantidadProductos ??
      cantidad;

    const existentes =
      respuesta?.cantidadExistentesERP ??
      cantidadExistentesERP;

    const exportables =
      respuesta?.cantidadAExportar ??
      (cantidadValidada - existentes);

    const estadoFinal =
      String(
        respuesta?.estadoFinal ??
        respuesta?.alta?.ESTADO ??
        ''
      ).trim().toUpperCase();

    if (estadoFinal === 'SIN_NOVEDADES_ERP') {
      mostrarAlerta(
        `Alta cerrada sin novedades ERP. ` +
        `${cantidadValidada} productos ya existen en Presea. ` +
        'No se genero ningun DBI y no queda sincronizacion pendiente.',
        'success'
      );
    } else {
      mostrarAlerta(
        `Alta validada correctamente. ` +
        `${cantidadValidada} productos en el lote: ` +
        `${exportables} nuevos para exportar y ` +
        `${existentes} ya existentes en Presea.`,
        'success'
      );
    }

    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.textContent = 'Validar Alta';
    actualizarControlesEstado();
  }
}

async function exportarBorradorExcel() {

  if (
    estadoAlta() !==
    'BORRADOR'
  ) {
    mostrarAlerta(
      'El Excel BORRADOR solamente está disponible mientras el Alta está en BORRADOR.',
      'warning'
    );

    return;
  }


  const btn =
    document.getElementById(
      'btnBorradorExcel'
    );


  try {

    if (btn) {
      btn.disabled =
        true;

      btn.textContent =
        'Generando BORRADOR...';
    }


    const respuesta =
      await fetch(
        `/api/altas/${ID_ALTA}/borrador-excel`,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        }
      );


    if (
      !respuesta.ok
    ) {

      let mensaje =
        `No se pudo generar el BORRADOR (${respuesta.status}).`;


      try {

        const errorJson =
          await respuesta.json();


        mensaje =
          errorJson?.mensaje ||
          errorJson?.message ||
          mensaje;

      } catch (_) {
        // La respuesta puede no ser JSON.
      }


      throw new Error(
        mensaje
      );
    }


    const blob =
      await respuesta.blob();


    let nombreArchivo =
      `BORRADOR_ALTA_${ID_ALTA}.xlsx`;


    const disposicion =
      respuesta.headers.get(
        'content-disposition'
      ) || '';


    const coincidencia =
      disposicion.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i
      );


    if (
      coincidencia?.[1]
    ) {

      try {

        nombreArchivo =
          decodeURIComponent(
            coincidencia[1]
              .replace(
                /^"+|"+$/g,
                ''
              )
              .trim()
          );

      } catch (_) {

        nombreArchivo =
          coincidencia[1]
            .replace(
              /^"+|"+$/g,
              ''
            )
            .trim();
      }
    }


    const url =
      URL.createObjectURL(
        blob
      );


    const enlace =
      document.createElement(
        'a'
      );


    enlace.href =
      url;

    enlace.download =
      nombreArchivo;


    document.body
      .appendChild(
        enlace
      );


    enlace.click();
    enlace.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),

      1000
    );


    mostrarAlerta(
      `BORRADOR generado: ${nombreArchivo}`,
      'success'
    );

  } catch (error) {

    mostrarAlerta(
      error.message,
      'danger'
    );

  } finally {

    if (btn) {
      btn.disabled =
        false;

      btn.textContent =
        'Descargar BORRADOR Excel';
    }


    actualizarControlesEstado();
  }
}


async function obtenerPreviewAlta() {
  return extraerDatos(
    await apiJson(`/api/altas/${ID_ALTA}/exportacion/preview`)
  );
}

async function mostrarPreview() {
  if (estadoAlta() !== 'VALIDADO') {
    mostrarAlerta('El Preview solamente está disponible para un alta VALIDADA.', 'warning');
    return;
  }

  const btn = document.getElementById('btnPreviewAlta');

  try {
    btn.disabled = true;
    btn.textContent = 'Preparando...';

    const preview = await obtenerPreviewAlta();
    pintarPreview(preview);

    const modalElemento = document.getElementById('modalPreviewExportacion');

    // Mantener el modal directamente bajo <body> evita que un stacking
    // context de la pantalla deje el backdrop por encima e intercepte
    // los clicks de X / Cerrar / Exportar a Excel.
    if (modalElemento && modalElemento.parentElement !== document.body) {
      document.body.appendChild(modalElemento);
    }

    // El Preview debe quedar siempre por encima del backdrop.
    // En algunas combinaciones de layout/Bootstrap el backdrop puede
    // interceptar los clicks aunque el modal sea visible.
    modalElemento.style.zIndex = '2000';
    modalElemento.style.pointerEvents = 'auto';

    const modalDialog = modalElemento.querySelector('.modal-dialog');
    const modalContent = modalElemento.querySelector('.modal-content');

    if (modalDialog) {
      modalDialog.style.pointerEvents = 'auto';
    }

    if (modalContent) {
      modalContent.style.pointerEvents = 'auto';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalElemento);

    modalElemento.addEventListener(
      'shown.bs.modal',
      () => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        const backdrop = backdrops[backdrops.length - 1];

        if (backdrop) {
          backdrop.style.zIndex = '1990';
        }
      },
      { once: true }
    );

    modal.show();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.textContent = 'Preview DBI';
    actualizarControlesEstado();
  }
}

function pintarPreview(preview) {
  document.getElementById('previewCodigoAlta').textContent =
    preview?.codigoAlta ?? '-';

  document.getElementById('previewCantidadDetalles').textContent =
    preview?.cantidadDetalles ?? 0;

  document.getElementById('previewCantidadExistentesERP').textContent =
    preview?.cantidadExistentesERP ?? 0;

  document.getElementById('previewCantidadRegistros').textContent =
    preview?.cantidadAExportar ??
    preview?.cantidadRegistros ??
    0;

  document.getElementById('previewCantidadCampos').textContent =
    preview?.cantidadCampos ?? 0;

  const campos = Array.isArray(preview?.campos)
    ? preview.campos
    : [];

  const registros = Array.isArray(preview?.registros)
    ? preview.registros
    : [];

  const tbody = document.getElementById('tablaPreviewExportacion');

  /*
   * No dependemos de modificar productos.hbs.
   * Tomamos el THEAD de la misma tabla que contiene el tbody actual.
   * Así este fix funciona sobre el template estable que ya usa el proyecto.
   */
  const thead =
    tbody?.closest('table')?.querySelector('thead') || null;

  if (!thead || !tbody) {
    throw new Error(
      'No se encontró la tabla del Preview DBI.'
    );
  }

  /*
   * El backend devuelve preview.campos en el MISMO ORDEN utilizado
   * por camposERP para escribir el DBF/DBI.
   *
   * El preview visual debe respetar exactamente esa estructura,
   * por eso ya no mostramos un subconjunto fijo de columnas.
   */
  thead.innerHTML = '';

  const trHead = document.createElement('tr');

  const thNumero = document.createElement('th');
  thNumero.textContent = '#';
  trHead.appendChild(thNumero);

  for (const campo of campos) {
    const th = document.createElement('th');
    th.textContent = campo?.nombre ?? '';
    th.title =
      `${campo?.tipo ?? ''}` +
      (campo?.largo ? `(${campo.largo}${campo?.decimales ? `,${campo.decimales}` : ''})` : '');
    trHead.appendChild(th);
  }

  thead.appendChild(trHead);

  tbody.innerHTML = '';

  if (!registros.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');

    td.colSpan = Math.max(1, campos.length + 1);
    td.className = 'text-center text-secondary py-4';
    td.textContent = 'Sin registros.';

    tr.appendChild(td);
    tbody.appendChild(tr);

    document.getElementById('previewAvisoLimite').textContent =
      'No hay registros exportables.';
    return;
  }

  const limite = Math.min(registros.length, 100);

  for (let i = 0; i < limite; i++) {
    const registro = registros[i];
    const tr = document.createElement('tr');

    const tdNumero = document.createElement('td');
    tdNumero.textContent = String(i + 1);
    tr.appendChild(tdNumero);

    for (const campo of campos) {
      const nombre = campo?.nombre ?? '';
      const td = document.createElement('td');

      if (nombre === 'COD_ALFA') {
        td.classList.add('font-monospace');
      }

      const valor = registro?.[nombre];

      td.textContent =
        valor === null ||
        valor === undefined
          ? ''
          : String(valor);

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  document.getElementById('previewAvisoLimite').textContent =
    registros.length > limite
      ? `Mostrando los primeros ${limite} de ${registros.length} registros. ` +
        `${campos.length} campos ERP en el orden real del DBI.`
      : `Mostrando ${registros.length} registros. ` +
        `${campos.length} campos ERP en el orden real del DBI.`;
}


async function exportarPreviewExcel() {
  if (estadoAlta() !== 'VALIDADO') {
    mostrarAlerta(
      'El Excel del Preview solamente está disponible para un alta VALIDADA.',
      'warning'
    );
    return;
  }

  const btn = document.getElementById('btnExportarPreviewExcel');

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generando Excel...';
    }

    const respuesta = await fetch(
      `/api/altas/${ID_ALTA}/exportacion/preview-excel`,
      {
        method: 'GET',
        headers: {
          'Accept':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      }
    );

    if (!respuesta.ok) {
      let mensaje =
        `No se pudo generar el Excel del Preview (${respuesta.status}).`;

      try {
        const errorJson = await respuesta.json();
        mensaje =
          errorJson?.mensaje ||
          errorJson?.message ||
          mensaje;
      } catch (_) {
        // La respuesta puede no ser JSON.
      }

      throw new Error(mensaje);
    }

    const blob = await respuesta.blob();

    let nombreArchivo =
      `PREVIEW_DBI_ALTA_${ID_ALTA}.xlsx`;

    const disposicion =
      respuesta.headers.get('content-disposition') || '';

    const coincidencia =
      disposicion.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i
      );

    if (coincidencia?.[1]) {
      try {
        nombreArchivo =
          decodeURIComponent(
            coincidencia[1]
              .replace(/^"+|"+$/g, '')
              .trim()
          );
      } catch (_) {
        nombreArchivo =
          coincidencia[1]
            .replace(/^"+|"+$/g, '')
            .trim();
      }
    }

    const url =
      URL.createObjectURL(blob);

    const enlace =
      document.createElement('a');

    enlace.href = url;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    mostrarAlerta(
      `Preview exportado a Excel: ${nombreArchivo}`,
      'success'
    );

  } catch (error) {
    mostrarAlerta(
      error.message,
      'danger'
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Exportar a Excel';
    }
  }
}


async function exportarAlta() {
  if (estadoAlta() !== 'VALIDADO') {
    mostrarAlerta('El alta debe estar VALIDADA antes de exportar.', 'warning');
    return;
  }

  let preview;

  try {
    preview = await obtenerPreviewAlta();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
    return;
  }

  const cantidad = preview?.cantidadRegistros ?? 0;

  const aceptar = window.confirm(
    `Se generará el DBI principal con ${cantidad} registros.\n\n` +
    'Si el lote contiene módulos, también se generarán RELFORMU y RELACION.\n' +
    'Todos los archivos requeridos se enviarán automáticamente al FTP de Presea.\n' +
    'El Alta cambiará a EXPORTADO solamente si todos los envíos finalizan correctamente.\n\n' +
    '¿Generar y enviar archivos?'
  );

  if (!aceptar) return;

  const btn = document.getElementById('btnExportarAlta');

  try {
    btn.disabled = true;
    btn.textContent = 'Exportando...';

    const resultado = extraerDatos(await apiJson(
      `/api/altas/${ID_ALTA}/exportar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuarioOperacion() })
      }
    ));

    const archivo = resultado?.archivo ?? '-';
    const cant = resultado?.cantidadRegistros ?? cantidad;

    const archivos =
      Array.isArray(resultado?.archivos)
        ? resultado.archivos
        : [];

    document.getElementById('resultadoArchivo').textContent =
      archivos.length
        ? archivos.map(item => item.archivo).join(' | ')
        : archivo;

    document.getElementById('resultadoRuta').textContent =
      archivos.length
        ? archivos.map(item => item.ruta).join(' | ')
        : (resultado?.ruta ?? '-');

    document.getElementById('resultadoRegistros').textContent = cant;

    const ftp = resultado?.ftp || {};
    const archivosFtp =
      Array.isArray(ftp?.archivos)
        ? ftp.archivos
        : [];

    const resultadoFtpEstado =
      document.getElementById('resultadoFtpEstado');

    const resultadoFtpRuta =
      document.getElementById('resultadoFtpRuta');

    if (resultadoFtpEstado) {
      resultadoFtpEstado.textContent =
        archivosFtp.length
          ? `${archivosFtp.length} ARCHIVOS ENVIADOS OK`
          : (
              ftp?.enviado
                ? 'ENVIADO OK'
                : 'NO ENVIADO'
            );
    }

    if (resultadoFtpRuta) {
      resultadoFtpRuta.textContent =
        archivosFtp.length
          ? archivosFtp.map(item => item.rutaRemota).join(' | ')
          : (ftp?.rutaRemota ?? '-');
    }

    document.getElementById('panelResultadoExportacion').classList.remove('d-none');

    const nombresFTP =
      archivosFtp.length
        ? archivosFtp.map(item => item.archivoFTP).join(', ')
        : (ftp?.archivoFTP ?? 'ALTAS_PRODUCTOS.DBI');

    mostrarAlerta(
      `Exportación correcta: ${resultado?.cantidadArchivos ?? 1} archivo(s) DBI. ` +
      `${cant} productos en el DBI principal. FTP: ${nombresFTP}.`,
      'success'
    );

    await cargarAlta();

    document.getElementById('panelResultadoExportacion')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (error) {
    mostrarAlerta(
      error.message +
      ' Si los DBI locales ya fueron generados, podés volver a presionar Exportar DBI para reintentar el envío.',
      'danger'
    );
  } finally {
    btn.textContent = 'Exportar DBI';
    actualizarControlesEstado();
  }
}
