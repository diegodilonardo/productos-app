document.addEventListener('DOMContentLoaded', iniciarSeguimiento);

let altasSeguimiento = [];
let productosSeguimientoEan = [];
let gruposSeguimientoEan = [];
let seleccionEan = new Set();
let clavesEanVisibles = [];
let familiasEanAbiertas = new Set();
let asociacionesUrlsGs1 = [];
let idEmpresaSeguimiento = null;
let vistaSeguimiento = sessionStorage.getItem('seguimiento.vista') === 'tabla' ? 'tabla' : 'tarjetas';
let paginaSeguimientoEan = 1;
const PRODUCTOS_POR_PAGINA_EAN = 50;

function claveSesionSeleccionEan() {
  return idEmpresaSeguimiento ? `seguimiento.ean.seleccion.${idEmpresaSeguimiento}` : '';
}

function cargarSeleccionEan() {
  const clave = claveSesionSeleccionEan();
  if (!clave) return new Set();
  try {
    const guardadas = JSON.parse(sessionStorage.getItem(clave) || '[]');
    return new Set(Array.isArray(guardadas) ? guardadas.map(String).filter(Boolean) : []);
  } catch (_) {
    return new Set();
  }
}

function guardarSeleccionEan() {
  const clave = claveSesionSeleccionEan();
  if (clave) sessionStorage.setItem(clave, JSON.stringify([...seleccionEan]));
}

async function iniciarSeguimiento() {
  window.addEventListener(
    'app:empresa-cambiada',
    actualizarEmpresaSeguimiento
  );

  idEmpresaSeguimiento =
    obtenerEmpresaActivaSeguimiento();
  seleccionEan = cargarSeleccionEan();

  document
    .getElementById('btnActualizarSeguimiento')
    .addEventListener('click', cargarTodo);

  document.getElementById('btnVistaTarjetasSeguimiento')?.addEventListener('click', () => aplicarVistaSeguimiento('tarjetas'));
  document.getElementById('btnVistaTablaSeguimiento')?.addEventListener('click', () => aplicarVistaSeguimiento('tabla'));
  aplicarVistaSeguimiento(vistaSeguimiento);

  document.getElementById('mostrarAnuladasSeguimiento')?.addEventListener(
    'change',
    cambiarVisibilidadAnuladasSeguimiento
  );

  const filtroEstado =
    document.getElementById('filtroEstadoSeguimiento');

  if (filtroEstado) {
    const existeSinNovedades =
      [...filtroEstado.options].some(
        option => option.value === 'SIN_NOVEDADES_ERP'
      );

    if (!existeSinNovedades) {
      const option = document.createElement('option');
      option.value = 'SIN_NOVEDADES_ERP';
      option.textContent = 'SIN_NOVEDADES_ERP';
      filtroEstado.appendChild(option);
    }

    filtroEstado.addEventListener(
      'change',
      pintarAltasFiltradas
    );
  }

  document.getElementById('buscarSeguimientoEan')?.addEventListener('input', reiniciarPaginaSeguimientoEan);
  for (const id of ['filtroEstadoEan', 'filtroTemporadaEan', 'filtroAnoEan', 'filtroRubroEan']) {
    document.getElementById(id)?.addEventListener('change', reiniciarPaginaSeguimientoEan);
  }
  document.getElementById('paginacionSeguimientoEan')?.addEventListener('click', cambiarPaginaSeguimientoEan);
  document.getElementById('btnExportarPendientesEan')?.addEventListener('click', prepararDescargaEan);
  document.getElementById('tablaSeguimientoEan')?.addEventListener('click', alternarFamiliaEan);
  document.getElementById('tablaSeguimientoEan')?.addEventListener('change', cambiarSeleccionEan);
  document.getElementById('seleccionarTodosEan')?.addEventListener('change', seleccionarTodosEan);
  document.getElementById('btnDescargarImagenesEan')?.addEventListener('click', descargarImagenesEan);
  document.getElementById('btnImportarUrlsTemporalesEan')?.addEventListener('click', () => {
    if (seleccionEan.size) document.getElementById('archivoUrlsTemporalesEan')?.click();
  });
  document.getElementById('archivoUrlsTemporalesEan')?.addEventListener('change', importarUrlsTemporalesEan);
  document.getElementById('btnGenerarArchivoGs1')?.addEventListener('click', generarArchivoGs1);
  document.getElementById('btnImportarCodigosEanGs1')?.addEventListener('click', () => document.getElementById('archivoCodigosEanGs1')?.click());
  document.getElementById('archivoCodigosEanGs1')?.addEventListener('change', importarCodigosEanGs1);
  document.getElementById('btnExportarGtinDbi')?.addEventListener('click', exportarGtinDbi);
  document.getElementById('btnEnviarGtinPresea')?.addEventListener('click', enviarGtinPresea);
  document.getElementById('btnImprimirEtiquetasEan')?.addEventListener('click', imprimirEtiquetasEan);

  await cargarTodo();
}

function obtenerEmpresaActivaSeguimiento() {
  const idEmpresa =
    Number(
      sessionStorage.getItem(
        'app.idEmpresa'
      ) ||
      sessionStorage.getItem(
        'pedidos.idEmpresa'
      )
    );

  return Number.isInteger(idEmpresa) &&
    idEmpresa > 0
    ? idEmpresa
    : null;
}

function actualizarEmpresaSeguimiento(event) {
  event.preventDefault();

  idEmpresaSeguimiento =
    Number(
      event.detail?.idEmpresa
    ) || null;

  altasSeguimiento = [];
  productosSeguimientoEan = [];
  gruposSeguimientoEan = [];
  seleccionEan = cargarSeleccionEan();
  asociacionesUrlsGs1 = [];
  familiasEanAbiertas.clear();
  paginaSeguimientoEan = 1;
  actualizarBotonImagenesEan();
  cargarTodo();
}

async function cargarTodo() {
  ocultarAlerta();
  pintarCargaSeguimiento();

  const btn = document.getElementById('btnActualizarSeguimiento');

  try {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    const [resumenData, altasData, eanData] = await Promise.all([
      apiSeguimiento('/api/seguimiento/resumen'),
      apiSeguimiento('/api/seguimiento/altas'),
      apiSeguimiento('/api/seguimiento/ean')
    ]);

    const resumen = extraerResultado(resumenData) || {};
    altasSeguimiento = normalizarLista(extraerResultado(altasData));
    const seguimientoEan = extraerResultado(eanData) || {};
    productosSeguimientoEan = Array.isArray(seguimientoEan.productos)
      ? seguimientoEan.productos
      : [];
    gruposSeguimientoEan = Array.isArray(seguimientoEan.grupos)
      ? seguimientoEan.grupos
      : productosSeguimientoEan.map((producto, indice) => ({
          tipo: 'PRIMERA', clave: `producto-${indice}`, principal: producto, primeras: []
        }));

    const clavesDisponibles = new Set(productosSeguimientoEan.map(claveProductoEan));
    seleccionEan = new Set([...seleccionEan].filter(clave => clavesDisponibles.has(clave)));
    guardarSeleccionEan();

    poblarFiltrosSeguimientoEan();

    pintarResumen(resumen);
    pintarAltasFiltradas();
    pintarResumenEan(seguimientoEan.resumen || {});
    pintarSeguimientoEan();
    actualizarBotonImagenesEan();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar';
  }
}

function pintarCargaSeguimiento() {
  for (const id of [
    'resTotalExportados',
    'resConfirmados',
    'resPendientes',
    'resErrores'
  ]) {
    setTexto(id, '—');
  }

  setTexto(
    'cantidadSeguimientoVisible',
    ''
  );

  const tbody =
    document.getElementById(
      'tablaSeguimientoAltas'
    );

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4">
          <span class="seguimiento-loading-state">Actualizando seguimiento</span>
        </td>
      </tr>
    `;
  }

  const tarjetas = document.getElementById('tarjetasSeguimiento');
  if (tarjetas) tarjetas.innerHTML = '<div class="seguimiento-cards-loading">Actualizando seguimiento</div>';
  for (const id of ['eanTotal', 'eanPendientesGs1', 'eanAsignados', 'eanPendientesErp', 'eanConfirmadosErp', 'eanSinEan']) setTexto(id, '—');
  const tablaEan = document.getElementById('tablaSeguimientoEan');
  if (tablaEan) tablaEan.innerHTML = '<tr><td colspan="7" class="text-center py-4">Actualizando seguimiento EAN...</td></tr>';
}

function pintarResumenEan(resumen) {
  setTexto('eanTotal', resumen.total ?? 0);
  setTexto('eanPendientesGs1', resumen.pendientesGs1 ?? 0);
  setTexto('eanAsignados', resumen.asignados ?? 0);
  setTexto('eanPendientesErp', resumen.pendientesErp ?? 0);
  setTexto('eanConfirmadosErp', resumen.confirmadosErp ?? 0);
  setTexto('eanSinEan', resumen.sinEan ?? 0);
  const aviso = document.getElementById('eanAvisoGs1');
  const pendientes = numero(resumen.pendientesGs1);
  if (aviso) {
    aviso.classList.toggle('d-none', pendientes === 0);
    aviso.textContent = pendientes === 1
      ? 'Hay 1 producto con EAN provisorio. Se debe gestionar su código definitivo en GS1.'
      : `Hay ${pendientes} productos con EAN provisorio. Se deben gestionar sus códigos definitivos en GS1.`;
  }
}

function pintarSeguimientoEan() {
  const tbody = document.getElementById('tablaSeguimientoEan');
  if (!tbody) return;
  const busqueda = String(document.getElementById('buscarSeguimientoEan')?.value || '').trim().toUpperCase();
  const estado = document.getElementById('filtroEstadoEan')?.value || '';
  const temporada = document.getElementById('filtroTemporadaEan')?.value || '';
  const ano = document.getElementById('filtroAnoEan')?.value || '';
  const rubro = document.getElementById('filtroRubroEan')?.value || '';
  const coincide = producto => {
    if (estado && producto.ESTADO_EAN !== estado) return false;
    if (temporada && claveTemporadaEan(producto) !== temporada) return false;
    if (ano && normalizarFiltroEan(producto.CODIGO_ANO) !== ano) return false;
    if (rubro && claveRubroEan(producto) !== rubro) return false;
    if (!busqueda) return true;
    return [producto.CODIGO_ALTA, producto.COD_ALFA, producto.CODIGO_ERP,
      producto.CODIGO_MODELO, producto.DETALLE_MODELO, producto.CODIGO_COLOR,
      producto.DETALLE_COLOR, producto.EAN_ERP, producto.DETALLE_MARCA,
      producto.DETALLE_RUBRO, producto.LICENCIA_ALTA]
      .some(valor => String(valor ?? '').toUpperCase().includes(busqueda));
  };
  const grupos = gruposSeguimientoEan.map(grupo => {
    const miembros = [grupo.principal, ...(grupo.primeras || [])];
    const visibles = miembros.filter(coincide);
    return { ...grupo, visibles };
  }).filter(grupo => grupo.visibles.length > 0);
  const cantidadProductos = grupos.reduce((total, grupo) => total + grupo.visibles.length, 0);
  const paginas = paginarGruposSeguimientoEan(grupos);
  const totalPaginas = Math.max(1, paginas.length);
  paginaSeguimientoEan = Math.min(Math.max(1, paginaSeguimientoEan), totalPaginas);
  const gruposPagina = paginas[paginaSeguimientoEan - 1] || [];
  clavesEanVisibles = [...new Set(grupos.flatMap(grupo =>
    grupo.visibles.map(producto => claveProductoEan(producto))
  ))];
  setTexto('cantidadEanVisible', `${grupos.length} familias · ${cantidadProductos} productos · ${seleccionEan.size} seleccionados`);
  pintarPaginacionSeguimientoEan(paginas, cantidadProductos);
  if (!grupos.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">No hay productos para mostrar.</td></tr>';
    return;
  }
  tbody.innerHTML = gruposPagina.map((grupo, indice) => {
    const principalVisible = grupo.visibles.includes(grupo.principal);
    const principal = principalVisible ? grupo.principal : grupo.visibles[0];
    const esModulo = grupo.tipo === 'MODULO';
    const clave = `ean-familia-${paginaSeguimientoEan}-${indice}`;
    const primerasVisibles = esModulo
      ? (grupo.primeras || []).filter(producto => grupo.visibles.includes(producto))
      : [];
    const resumenFamilia = esModulo
      ? `<div class="seguimiento-ean-family-summary">1 módulo · ${grupo.primeras.length} primeras</div>`
      : '';
    const familiaAbierta = familiasEanAbiertas.has(clave);
    const boton = esModulo && primerasVisibles.length
      ? `<button type="button" class="btn btn-sm btn-outline-secondary seguimiento-ean-toggle" data-ean-family="${clave}" aria-expanded="${familiaAbierta}">${familiaAbierta ? 'Ocultar primeras' : `Ver primeras (${primerasVisibles.length})`}</button>`
      : '';
    const clavesFamilia = esModulo
      ? [grupo.principal, ...(grupo.primeras || [])].map(claveProductoEan)
      : [claveProductoEan(principal)];
    return pintarFilaEan(principal, { resumenFamilia, boton, clavesSeleccion: clavesFamilia }) +
      primerasVisibles.map(producto => pintarFilaEan(producto, { claseFila: `${clave} ${familiaAbierta ? '' : 'd-none'} seguimiento-ean-child`, prefijo: '↳ Primera' })).join('');
  }).join('');
  actualizarChecksSeleccionEan();
  actualizarSelectorTodosEan();
}

function normalizarFiltroEan(valor) {
  return String(valor ?? '').trim().toUpperCase();
}

function claveTemporadaEan(producto) {
  return normalizarFiltroEan(producto.DETALLE_TEMPORADA || producto.CODIGO_TEMPORADA);
}

function claveRubroEan(producto) {
  return normalizarFiltroEan(producto.DETALLE_RUBRO || producto.CODIGO_RUBRO);
}

function poblarFiltrosSeguimientoEan() {
  poblarSelectSeguimientoEan('filtroTemporadaEan', 'Todas las temporadas', productosSeguimientoEan.map(producto => ({
    valor: claveTemporadaEan(producto),
    etiqueta: producto.DETALLE_TEMPORADA || producto.CODIGO_TEMPORADA
  })));
  poblarSelectSeguimientoEan('filtroAnoEan', 'Todos los años', productosSeguimientoEan.map(producto => ({
    valor: normalizarFiltroEan(producto.CODIGO_ANO),
    etiqueta: producto.CODIGO_ANO
  })));
  poblarSelectSeguimientoEan('filtroRubroEan', 'Todos los rubros', productosSeguimientoEan.map(producto => ({
    valor: claveRubroEan(producto),
    etiqueta: producto.DETALLE_RUBRO || producto.CODIGO_RUBRO
  })));
}

function poblarSelectSeguimientoEan(id, etiquetaTodos, opciones) {
  const select = document.getElementById(id);
  if (!select) return;
  const seleccionActual = select.value;
  const unicas = new Map();
  opciones.forEach(({ valor, etiqueta }) => {
    if (valor && etiqueta != null && !unicas.has(valor)) unicas.set(valor, String(etiqueta).trim());
  });
  const ordenadas = [...unicas.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true }));
  select.innerHTML = `<option value="">${escapar(etiquetaTodos)}</option>` + ordenadas
    .map(([valor, etiqueta]) => `<option value="${escapar(valor)}">${escapar(etiqueta)}</option>`)
    .join('');
  if (unicas.has(seleccionActual)) select.value = seleccionActual;
}

function paginarGruposSeguimientoEan(grupos) {
  const paginas = [];
  let pagina = [];
  let productos = 0;
  grupos.forEach(grupo => {
    const cantidad = grupo.visibles.length;
    if (pagina.length && productos + cantidad > PRODUCTOS_POR_PAGINA_EAN) {
      paginas.push(pagina);
      pagina = [];
      productos = 0;
    }
    pagina.push(grupo);
    productos += cantidad;
  });
  if (pagina.length) paginas.push(pagina);
  return paginas;
}

function reiniciarPaginaSeguimientoEan() {
  paginaSeguimientoEan = 1;
  familiasEanAbiertas.clear();
  pintarSeguimientoEan();
}

function cambiarPaginaSeguimientoEan(event) {
  const boton = event.target.closest('[data-ean-page]');
  if (!boton || boton.disabled) return;
  paginaSeguimientoEan = Number(boton.dataset.eanPage) || 1;
  familiasEanAbiertas.clear();
  pintarSeguimientoEan();
  document.getElementById('listadoProductosEan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pintarPaginacionSeguimientoEan(paginas, cantidadProductos) {
  const contenedor = document.getElementById('paginacionSeguimientoEan');
  if (!contenedor) return;
  const totalPaginas = Math.max(1, paginas.length);
  contenedor.classList.toggle('d-none', totalPaginas <= 1);
  if (totalPaginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  const anteriores = paginas.slice(0, paginaSeguimientoEan - 1)
    .reduce((total, pagina) => total + pagina.reduce((subtotal, grupo) => subtotal + grupo.visibles.length, 0), 0);
  const cantidadPagina = (paginas[paginaSeguimientoEan - 1] || [])
    .reduce((total, grupo) => total + grupo.visibles.length, 0);
  const desde = anteriores + 1;
  const hasta = anteriores + cantidadPagina;
  contenedor.innerHTML = `<span class="text-secondary">Mostrando ${desde}–${hasta} de ${cantidadProductos}</span><div class="btn-group" role="group" aria-label="Cambiar página"><button class="btn btn-outline-secondary" type="button" data-ean-page="${paginaSeguimientoEan - 1}" ${paginaSeguimientoEan === 1 ? 'disabled' : ''}>Anterior</button><span class="btn btn-light disabled">Página ${paginaSeguimientoEan} de ${totalPaginas}</span><button class="btn btn-outline-secondary" type="button" data-ean-page="${paginaSeguimientoEan + 1}" ${paginaSeguimientoEan === totalPaginas ? 'disabled' : ''}>Siguiente</button></div>`;
}

function pintarFilaEan(producto, { resumenFamilia = '', boton = '', claseFila = '', prefijo = '', clavesSeleccion = null } = {}) {
    const estadoEan = producto.ESTADO_EAN || 'SIN_EAN';
    const etiqueta = estadoEan === 'PENDIENTE_GS1' ? 'GESTIONAR EN GS1'
      : estadoEan === 'EAN_ASIGNADO' ? 'EAN ASIGNADO'
      : estadoEan === 'PENDIENTE_ERP' ? 'ENVIADO · PENDIENTE ERP'
      : estadoEan === 'CONFIRMADO_ERP' ? 'CONFIRMADO EN ERP' : 'SIN EAN';
    const clase = estadoEan === 'PENDIENTE_GS1' ? 'text-bg-warning'
      : estadoEan === 'EAN_ASIGNADO' ? 'text-bg-info'
      : estadoEan === 'PENDIENTE_ERP' ? 'text-bg-warning'
      : estadoEan === 'CONFIRMADO_ERP' ? 'text-bg-success' : 'text-bg-danger';
    const estadoUrl = producto.URL_IMAGEN_GS1
      ? '<span class="badge seguimiento-ean-url-badge">URL GS1 ASOCIADA</span>'
      : '<span class="badge seguimiento-ean-url-pending">URL PENDIENTE</span>';
    const idAlta = producto.ID_ALTA;
    const claves = clavesSeleccion || [claveProductoEan(producto)];
    const checked = claves.every(clave => seleccionEan.has(clave));
    return `<tr class="${claseFila}">
      <td><div class="seguimiento-ean-image-cell"><input class="form-check-input seguimiento-ean-check" type="checkbox" data-ean-selection="${escapar(claves.join(';;'))}" ${checked ? 'checked' : ''} aria-label="Seleccionar ${escapar(producto.COD_ALFA)}"><img class="seguimiento-ean-image" src="${escapar(producto.URL_IMAGEN)}" alt="" loading="lazy" onerror="this.classList.add('d-none');this.nextElementSibling.classList.remove('d-none')"><span class="seguimiento-ean-no-image d-none">Sin foto</span></div></td>
      <td><strong>${prefijo ? `<span class="seguimiento-ean-child-label">${prefijo}</span> ` : ''}${escapar(producto.COD_ALFA || '-')}</strong><div class="small text-secondary">ERP ${escapar(producto.CODIGO_ERP || '-')}</div>${resumenFamilia}</td>
      <td><strong>${escapar(producto.DETALLE_MODELO || producto.CODIGO_MODELO || '-')}</strong><div class="small text-secondary">${escapar(producto.DETALLE_COLOR || producto.CODIGO_COLOR || '-')}</div></td>
      <td>${escapar(producto.TALLE_CURVA || '-')}</td>
      <td class="font-monospace fw-semibold">${escapar(producto.EAN_MOSTRADO || producto.EAN_ERP || '-')}</td>
      <td><div class="seguimiento-ean-statuses"><span class="badge ${clase}">${etiqueta}</span>${estadoUrl}</div></td>
      <td><a href="/altas/${encodeURIComponent(idAlta)}/productos">${escapar(producto.CODIGO_ALTA || '-')}</a>${boton ? `<div class="mt-2">${boton}</div>` : ''}</td>
    </tr>`;
}

function claveProductoEan(producto) {
  return `${producto.ID_ALTA}|${producto.COD_ALFA}`;
}

function cambiarSeleccionEan(event) {
  const checkbox = event.target.closest('[data-ean-selection]');
  if (!checkbox) return;
  String(checkbox.dataset.eanSelection || '').split(';;').filter(Boolean).forEach(clave => {
    if (checkbox.checked) seleccionEan.add(clave);
    else seleccionEan.delete(clave);
  });
  guardarSeleccionEan();
  pintarSeguimientoEan();
  actualizarBotonImagenesEan();
}

function seleccionarTodosEan(event) {
  clavesEanVisibles.forEach(clave => {
    if (event.target.checked) seleccionEan.add(clave);
    else seleccionEan.delete(clave);
  });
  guardarSeleccionEan();
  pintarSeguimientoEan();
  actualizarBotonImagenesEan();
}

function actualizarChecksSeleccionEan() {
  document.querySelectorAll('[data-ean-selection]').forEach(checkbox => {
    const claves = String(checkbox.dataset.eanSelection || '').split(';;').filter(Boolean);
    const seleccionadas = claves.filter(clave => seleccionEan.has(clave)).length;
    checkbox.checked = claves.length > 0 && seleccionadas === claves.length;
    checkbox.indeterminate = seleccionadas > 0 && seleccionadas < claves.length;
  });
}

function actualizarSelectorTodosEan() {
  const checkbox = document.getElementById('seleccionarTodosEan');
  if (!checkbox) return;
  const seleccionados = clavesEanVisibles.filter(clave => seleccionEan.has(clave)).length;
  checkbox.checked = clavesEanVisibles.length > 0 && seleccionados === clavesEanVisibles.length;
  checkbox.indeterminate = seleccionados > 0 && seleccionados < clavesEanVisibles.length;
}

function actualizarBotonImagenesEan(cargando = false) {
  const boton = document.getElementById('btnDescargarImagenesEan');
  if (!boton) return;
  const pendientesGs1 = productosSeleccionadosEan('PENDIENTE_GS1');
  const clavesPendientesGs1 = pendientesGs1.map(claveProductoEan);
  boton.disabled = cargando || pendientesGs1.length === 0;
  boton.textContent = cargando ? 'Preparando imágenes...' : `Descargar imágenes (${pendientesGs1.length})`;
  const importar = document.getElementById('btnImportarUrlsTemporalesEan');
  if (importar) importar.disabled = cargando || pendientesGs1.length === 0;
  sincronizarAsociacionesRegistradas();
  const generar = document.getElementById('btnGenerarArchivoGs1');
  if (generar) generar.disabled = cargando || asociacionesUrlsGs1.length === 0;
  const importarEan = document.getElementById('btnImportarCodigosEanGs1');
  if (importarEan) importarEan.disabled = cargando || pendientesGs1.length === 0;
  const exportarDbi = document.getElementById('btnExportarGtinDbi');
  const asignados = productosSeleccionadosEan('EAN_ASIGNADO')
    .filter(producto => producto.EAN_GS1 && producto.CODIGO_ERP);
  if (exportarDbi) {
    exportarDbi.disabled = cargando || asignados.length === 0;
    exportarDbi.textContent = `Descargar GTIN.DBI (${asignados.length})`;
  }
  const enviarPresea = document.getElementById('btnEnviarGtinPresea');
  if (enviarPresea) {
    enviarPresea.disabled = cargando || asignados.length === 0;
    enviarPresea.textContent = `Enviar GTIN a Presea (${asignados.length})`;
  }
  const imprimirEtiquetas = document.getElementById('btnImprimirEtiquetasEan');
  const confirmados = productosSeleccionadosEan('CONFIRMADO_ERP').length;
  if (imprimirEtiquetas) {
    imprimirEtiquetas.disabled = cargando || confirmados === 0;
    imprimirEtiquetas.textContent = `Imprimir etiquetas (${confirmados})`;
  }
  const descargarPendientes = document.getElementById('btnExportarPendientesEan');
  if (descargarPendientes) {
    const deshabilitado = cargando || clavesPendientesGs1.length === 0;
    descargarPendientes.classList.toggle('disabled', deshabilitado);
    descargarPendientes.setAttribute('aria-disabled', String(deshabilitado));
    descargarPendientes.tabIndex = deshabilitado ? -1 : 0;
  }
  actualizarSelectorTodosEan();
}

function productosSeleccionadosEan(...estados) {
  const permitidos = new Set(estados.flat().filter(Boolean));
  return productosSeguimientoEan.filter(producto =>
    seleccionEan.has(claveProductoEan(producto)) &&
    (!permitidos.size || permitidos.has(producto.ESTADO_EAN))
  );
}

function sincronizarAsociacionesRegistradas() {
  const actuales = new Map(asociacionesUrlsGs1.map(item => [item.claveProducto, item]));
  asociacionesUrlsGs1 = productosSeguimientoEan
    .filter(producto => seleccionEan.has(claveProductoEan(producto)) && producto.ESTADO_EAN === 'PENDIENTE_GS1')
    .map(producto => {
      const claveProducto = `${producto.ID_ALTA}|${producto.COD_ALFA}`;
      return actuales.get(claveProducto) || (producto.URL_IMAGEN_GS1 ? {
        claveProducto,
        idAlta: producto.ID_ALTA,
        codigoAlfa: producto.COD_ALFA,
        nombreImagen: producto.NOMBRE_IMAGEN_GS1,
        urlImagen: producto.URL_IMAGEN_GS1,
      } : null);
    })
    .filter(Boolean);
}

async function importarUrlsTemporalesEan(event) {
  const archivo = event.target.files?.[0];
  const clavesPendientes = productosSeleccionadosEan('PENDIENTE_GS1').map(claveProductoEan);
  if (!archivo || !idEmpresaSeguimiento || !clavesPendientes.length) return;
  const boton = document.getElementById('btnImportarUrlsTemporalesEan');
  const resultado = document.getElementById('resultadoUrlsTemporalesEan');
  boton.disabled = true;
  boton.textContent = 'Asociando URLs...';
  resultado?.classList.add('d-none');
  try {
    if (archivo.size > 10 * 1024 * 1024) throw new Error('El archivo supera el máximo de 10 MB.');
    const datos = await archivo.arrayBuffer();
    const bytes = new Uint8Array(datos);
    let binario = '';
    for (let inicio = 0; inicio < bytes.length; inicio += 32768) {
      binario += String.fromCharCode(...bytes.subarray(inicio, inicio + 32768));
    }
    const respuesta = await fetch(`/api/seguimiento/ean/urls-temporales?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ archivoBase64: btoa(binario), clavesProducto: clavesPendientes })
    });
    const data = await respuesta.json();
    if (!respuesta.ok || !data.ok) throw new Error(data.mensaje || `Error HTTP ${respuesta.status}.`);
    const resumen = data.resultado?.resumen || {};
    asociacionesUrlsGs1 = Array.isArray(data.resultado?.asociados) ? data.resultado.asociados : [];
    const asociadasPorClave = new Map(asociacionesUrlsGs1.map(item => [item.claveProducto, item]));
    productosSeguimientoEan.forEach(producto => {
      const asociacion = asociadasPorClave.get(`${producto.ID_ALTA}|${producto.COD_ALFA}`);
      if (asociacion) {
        producto.NOMBRE_IMAGEN_GS1 = asociacion.nombreImagen;
        producto.URL_IMAGEN_GS1 = asociacion.urlImagen;
      }
    });
    const generar = document.getElementById('btnGenerarArchivoGs1');
    if (generar) generar.disabled = asociacionesUrlsGs1.length === 0;
    if (resultado) {
      resultado.innerHTML = `<strong>URLs de GS1 procesadas.</strong> ${numero(resumen.productosAsociados)} de ${numero(resumen.productosSeleccionados)} productos asociados. `
        + `${numero(resumen.productosSinUrl)} sin URL y ${numero(resumen.urlsSinProducto)} URLs sin producto seleccionado. `
        + `${numero(resumen.urlsInsertadas)} registradas y ${numero(resumen.urlsActualizadas)} actualizadas.`;
      resultado.classList.remove('d-none');
    }
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    event.target.value = '';
    boton.textContent = 'Importar URLs GS1';
    actualizarBotonImagenesEan(false);
  }
}

async function generarArchivoGs1() {
  if (!asociacionesUrlsGs1.length || !idEmpresaSeguimiento) return;
  const boton = document.getElementById('btnGenerarArchivoGs1');
  boton.disabled = true;
  boton.textContent = 'Generando archivo...';
  try {
    const respuesta = await fetch(`/api/seguimiento/ean/archivo-gs1.xlsx?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      body: JSON.stringify({ asociaciones: asociacionesUrlsGs1 })
    });
    if (!respuesta.ok) {
      let mensaje = `Error HTTP ${respuesta.status}.`;
      try { mensaje = (await respuesta.json()).mensaje || mensaje; } catch {}
      throw new Error(mensaje);
    }
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `ALTA_GS1_${new Date().toISOString().slice(0, 10)}.xlsx`;
    enlace.click();
    URL.revokeObjectURL(url);
    mostrarAlerta('Archivo para registrar los productos en GS1 generado correctamente.', 'success');
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    boton.textContent = 'Generar archivo GS1';
    boton.disabled = asociacionesUrlsGs1.length === 0;
  }
}

async function importarCodigosEanGs1(event) {
  const archivo = event.target.files?.[0]; if (!archivo || !idEmpresaSeguimiento) return;
  const boton = document.getElementById('btnImportarCodigosEanGs1'); boton.disabled = true; boton.textContent = 'Importando EAN...';
  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer()); let binario = '';
    for (let i=0;i<bytes.length;i+=32768) binario += String.fromCharCode(...bytes.subarray(i,i+32768));
    const respuesta = await fetch(`/api/seguimiento/ean/importar-codigos?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({archivoBase64:btoa(binario),nombreArchivo:archivo.name})
    });
    const data=await respuesta.json(); if(!respuesta.ok||!data.ok) throw new Error(data.mensaje||`Error HTTP ${respuesta.status}.`);
    const r=data.resultado.resumen;
    mostrarAlerta(`EAN importados: ${numero(r.validos)}. Nuevos: ${numero(r.insertados)}. Actualizados: ${numero(r.actualizados)}. Rechazados: ${numero(r.rechazados)}.`, r.rechazados ? 'warning':'success');
    await cargarTodo();
  } catch(error) { mostrarAlerta(error.message,'danger'); }
  finally { event.target.value=''; boton.textContent='Importar EAN definitivos'; actualizarBotonImagenesEan(false); }
}

async function exportarGtinDbi() {
  const clavesAsignadas = productosSeleccionadosEan('EAN_ASIGNADO').map(claveProductoEan);
  if (!clavesAsignadas.length || !idEmpresaSeguimiento) return;
  const boton=document.getElementById('btnExportarGtinDbi'); boton.disabled=true; boton.textContent='Generando GTIN.DBI...';
  try {
    const respuesta=await fetch(`/api/seguimiento/ean/exportar-gtin.dbi?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clavesProducto:clavesAsignadas})
    });
    if(!respuesta.ok){let m=`Error HTTP ${respuesta.status}.`;try{m=(await respuesta.json()).mensaje||m}catch{}throw new Error(m)}
    const blob=await respuesta.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='GTIN.DBI';a.click();URL.revokeObjectURL(url);
    mostrarAlerta('GTIN.DBI generado correctamente para Presea.','success');
  } catch(error){mostrarAlerta(error.message,'danger')} finally {actualizarBotonImagenesEan(false)}
}

async function enviarGtinPresea() {
  const clavesAsignadas = productosSeleccionadosEan('EAN_ASIGNADO').map(claveProductoEan);
  if (!clavesAsignadas.length || !idEmpresaSeguimiento) return;
  const boton=document.getElementById('btnEnviarGtinPresea'); boton.disabled=true; boton.textContent='Enviando a Presea...';
  try {
    const respuesta=await fetch(`/api/seguimiento/ean/enviar-gtin-presea?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clavesProducto:clavesAsignadas})
    });
    const data=await respuesta.json(); if(!respuesta.ok||!data.ok) throw new Error(data.mensaje||`Error HTTP ${respuesta.status}.`);
    mostrarAlerta(`GTIN.DBI enviado correctamente a Presea con ${numero(data.resultado.registros)} registros.`,'success');
  } catch(error){mostrarAlerta(error.message,'danger')} finally {actualizarBotonImagenesEan(false)}
}

async function imprimirEtiquetasEan() {
  const clavesConfirmadas = productosSeleccionadosEan('CONFIRMADO_ERP').map(claveProductoEan);
  if (!clavesConfirmadas.length || !idEmpresaSeguimiento) return;
  ocultarAlerta();
  const ventana = window.open('', '_blank');
  if (!ventana) {
    mostrarAlerta('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para esta aplicación.', 'warning');
    return;
  }
  ventana.document.write('<p style="font-family:Arial;padding:24px">Preparando etiquetas...</p>');
  try {
    const respuesta = await fetch(`/api/seguimiento/ean/etiquetas?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/html' },
      body: JSON.stringify({ clavesProducto: clavesConfirmadas }),
    });
    if (!respuesta.ok) {
      let mensaje = `Error HTTP ${respuesta.status}.`;
      try { mensaje = (await respuesta.json()).mensaje || mensaje; } catch {}
      throw new Error(mensaje);
    }
    const html = await respuesta.text();
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  } catch (error) {
    ventana.close();
    mostrarAlerta(error.message, 'danger');
  }
}

async function descargarImagenesEan() {
  const clavesPendientes = productosSeleccionadosEan('PENDIENTE_GS1').map(claveProductoEan);
  if (!clavesPendientes.length || !idEmpresaSeguimiento) return;
  ocultarAlerta();
  actualizarBotonImagenesEan(true);
  try {
    const respuesta = await fetch(`/api/seguimiento/ean/imagenes.zip?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/zip' },
      body: JSON.stringify({ clavesProducto: clavesPendientes })
    });
    if (!respuesta.ok) {
      let mensaje = `Error HTTP ${respuesta.status}.`;
      try { mensaje = (await respuesta.json()).mensaje || mensaje; } catch {}
      throw new Error(mensaje);
    }
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'IMAGENES_GS1_400X400.zip';
    enlace.click();
    URL.revokeObjectURL(url);
    mostrarAlerta('Imágenes preparadas correctamente en tamaño mínimo 400 × 400.', 'success');
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    actualizarBotonImagenesEan(false);
  }
}

function alternarFamiliaEan(event) {
  const boton = event.target.closest('[data-ean-family]');
  if (!boton) return;
  const filas = document.querySelectorAll(`.${boton.dataset.eanFamily}`);
  const abrir = boton.getAttribute('aria-expanded') !== 'true';
  if (abrir) familiasEanAbiertas.add(boton.dataset.eanFamily);
  else familiasEanAbiertas.delete(boton.dataset.eanFamily);
  filas.forEach(fila => fila.classList.toggle('d-none', !abrir));
  boton.setAttribute('aria-expanded', String(abrir));
  const cantidad = filas.length;
  boton.textContent = abrir ? 'Ocultar primeras' : `Ver primeras (${cantidad})`;
}

function prepararDescargaEan(event) {
  if (event.currentTarget.getAttribute('aria-disabled') === 'true') {
    event.preventDefault();
    return;
  }
  if (!idEmpresaSeguimiento) {
    event.preventDefault();
    mostrarAlerta('Debe seleccionar una empresa.', 'danger');
    return;
  }
  event.currentTarget.href = `/api/seguimiento/ean/pendientes.xlsx?idEmpresa=${encodeURIComponent(idEmpresaSeguimiento)}`;
}

async function apiSeguimiento(url) {
  const response = await fetch(
    url,
    idEmpresaSeguimiento
      ? {
          headers: {
            Accept: 'application/json',
            'x-id-empresa':
              String(idEmpresaSeguimiento)
          }
        }
      : undefined
  );

  let data = null;
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(data?.mensaje || `Error HTTP ${response.status}.`);
  }

  return data;
}

function extraerResultado(data) {
  if (Array.isArray(data)) return data;
  return data?.resultado ?? data?.datos ?? data?.data ?? data;
}

function normalizarLista(valor) {
  if (Array.isArray(valor)) return valor;
  if (Array.isArray(valor?.altas)) return valor.altas;
  return [];
}

function pintarResumen(resumen) {
  const erp = resumen?.erp ?? resumen?.ERP ?? resumen;

  setTexto('resTotalExportados',
    erp?.totalExportados ??
    erp?.TOTAL_EXPORTADOS ??
    0
  );

  setTexto('resConfirmados',
    erp?.confirmados ??
    erp?.CONFIRMADOS ??
    0
  );

  setTexto('resPendientes',
    erp?.pendientes ??
    erp?.PENDIENTES ??
    0
  );

  setTexto('resErrores',
    erp?.errores ??
    erp?.ERRORES ??
    0
  );
}

function pintarAltasFiltradas() {
  const estadoFiltro =
    document.getElementById('filtroEstadoSeguimiento').value;
  const mostrarAnuladas =
    document.getElementById('mostrarAnuladasSeguimiento')?.checked === true;

  const filas = altasSeguimiento.filter(item => {
    const estado = String(item.ESTADO ?? item.estado ?? '').toUpperCase();
    if (estado === 'ANULADO' && !mostrarAnuladas) return false;
    return !estadoFiltro || estado === estadoFiltro;
  });

  setTexto(
    'cantidadSeguimientoVisible',
    `${filas.length} de ${altasSeguimiento.length}`
  );

  pintarTarjetasSeguimiento(filas);
  pintarAltas(filas);
}

function cambiarVisibilidadAnuladasSeguimiento() {
  const mostrar = document.getElementById('mostrarAnuladasSeguimiento')?.checked === true;
  const filtro = document.getElementById('filtroEstadoSeguimiento');
  const opcionAnulado = filtro?.querySelector('option[value="ANULADO"]');
  if (opcionAnulado) opcionAnulado.disabled = !mostrar;
  if (!mostrar && filtro?.value === 'ANULADO') filtro.value = '';
  pintarAltasFiltradas();
}

function aplicarVistaSeguimiento(vista) {
  vistaSeguimiento = vista === 'tabla' ? 'tabla' : 'tarjetas';
  sessionStorage.setItem('seguimiento.vista', vistaSeguimiento);
  const tarjetas = vistaSeguimiento === 'tarjetas';
  document.getElementById('tarjetasSeguimiento')?.classList.toggle('d-none', !tarjetas);
  document.getElementById('vistaTablaSeguimiento')?.classList.toggle('d-none', tarjetas);
  const btnTarjetas = document.getElementById('btnVistaTarjetasSeguimiento');
  const btnTabla = document.getElementById('btnVistaTablaSeguimiento');
  btnTarjetas?.classList.toggle('is-active', tarjetas);
  btnTabla?.classList.toggle('is-active', !tarjetas);
  btnTarjetas?.setAttribute('aria-pressed', String(tarjetas));
  btnTabla?.setAttribute('aria-pressed', String(!tarjetas));
}

function resumenErpFila(fila) {
  const seguimiento = fila.seguimientoErp ?? fila.SEGUIMIENTO_ERP ?? {};
  const total = numero(seguimiento.total ?? seguimiento.TOTAL ?? fila.TOTAL_EXPORTADOS ?? fila.totalExportados ?? fila.CANTIDAD_EXPORTADOS ?? fila.cantidadExportados ?? fila.TOTAL ?? fila.total ?? 0);
  const confirmados = numero(seguimiento.confirmados ?? seguimiento.CONFIRMADOS ?? fila.CONFIRMADOS ?? fila.confirmados ?? fila.CANTIDAD_CONFIRMADOS_ERP ?? fila.CANTIDAD_CONFIRMADOS ?? fila.cantidadConfirmados ?? 0);
  let porcentaje = seguimiento.porcentajeConfirmado ?? seguimiento.PORCENTAJE_CONFIRMADO ?? fila.PORCENTAJE_CONFIRMADO ?? fila.porcentajeConfirmado ?? fila.PORCENTAJE ?? fila.porcentaje;
  if (porcentaje === undefined || porcentaje === null) porcentaje = total > 0 ? (confirmados / total) * 100 : 0;
  return { total, confirmados, porcentaje: Math.round(Math.max(0, Math.min(100, numero(porcentaje)))) };
}

function pintarTarjetasSeguimiento(filas) {
  const contenedor = document.getElementById('tarjetasSeguimiento');
  if (!contenedor) return;
  if (!filas.length) {
    contenedor.innerHTML = '<div class="seguimiento-card-empty">No hay altas para mostrar.</div>';
    return;
  }
  contenedor.innerHTML = filas.map(fila => {
    const id = fila.ID_ALTA ?? fila.idAlta;
    const estado = String(fila.ESTADO ?? fila.estado ?? '-').toUpperCase();
    const erp = resumenErpFila(fila);
    return `<article class="seguimiento-summary-card seguimiento-summary-${estado.toLowerCase().replaceAll('_', '-')}">
      <div class="seguimiento-summary-top"><div class="seguimiento-summary-title"><strong>${escapar(fila.CODIGO_ALTA ?? fila.codigoAlta ?? '-')}</strong><span>ID ${escapar(id ?? '-')}</span></div><span class="badge ${claseEstado(estado)}">${escapar(estado)}</span></div>
      <div class="seguimiento-summary-brand"><strong>${escapar(fila.DETALLE_MARCA ?? fila.marca ?? '-')}</strong><span>${escapar(fila.DETALLE_RUBRO ?? fila.rubro ?? '-')}</span></div>
      <div class="seguimiento-summary-meta"><div><span>Campaña</span>${formatearAnoTemporada(fila)}</div><div><span>Tipo</span><strong>${escapar(fila.TIPO_PRODUCTO ?? fila.tipoProducto ?? '-')}</strong></div><div><span>Licencia</span>${badgeLicencia(fila.LICENCIA_ALTA ?? fila.licenciaAlta)}</div><div><span>ERP</span><strong>${erp.confirmados} / ${erp.total}</strong></div></div>
      <div class="seguimiento-summary-progress"><div><span>Avance ERP</span><strong>${erp.porcentaje}%</strong></div><div class="progress" role="progressbar" aria-valuenow="${erp.porcentaje}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${erp.porcentaje}%"></div></div></div>
      <div class="seguimiento-summary-file" title="${escapar(fila.ARCHIVO_EXPORTADO ?? fila.archivoExportado ?? '-')}">${escapar(fila.ARCHIVO_EXPORTADO ?? fila.archivoExportado ?? 'Sin archivo informado')}</div>
      <div class="seguimiento-summary-footer"><span>Conciliación ERP</span><a href="/seguimiento/${encodeURIComponent(id)}" class="btn btn-sm btn-outline-primary">Ver detalle</a></div>
    </article>`;
  }).join('');
}

function pintarAltas(filas) {
  const tbody = document.getElementById('tablaSeguimientoAltas');
  tbody.innerHTML = '';

  if (!filas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4 text-secondary">
          No hay altas para mostrar.
        </td>
      </tr>
    `;
    return;
  }

  for (const fila of filas) {
    const id = fila.ID_ALTA ?? fila.idAlta;
    const estado = fila.ESTADO ?? fila.estado ?? '-';

    /*
      El API /api/seguimiento/altas devuelve los datos ERP
      agrupados dentro de fila.seguimientoErp:

      {
        seguimientoErp: {
          total,
          confirmados,
          pendientes,
          errores,
          porcentajeConfirmado
        }
      }

      Conservamos los nombres anteriores como fallback para
      mantener compatibilidad con respuestas viejas.
    */
    const seguimiento =
      fila.seguimientoErp ??
      fila.SEGUIMIENTO_ERP ??
      {};

    const total =
      numero(
        seguimiento.total ??
        seguimiento.TOTAL ??
        fila.TOTAL_EXPORTADOS ??
        fila.totalExportados ??
        fila.CANTIDAD_EXPORTADOS ??
        fila.cantidadExportados ??
        fila.TOTAL ??
        fila.total ??
        0
      );

    const confirmados =
      numero(
        seguimiento.confirmados ??
        seguimiento.CONFIRMADOS ??
        fila.CONFIRMADOS ??
        fila.confirmados ??
        fila.CANTIDAD_CONFIRMADOS_ERP ??
        fila.CANTIDAD_CONFIRMADOS ??
        fila.cantidadConfirmados ??
        0
      );

    let porcentaje =
      seguimiento.porcentajeConfirmado ??
      seguimiento.PORCENTAJE_CONFIRMADO ??
      fila.PORCENTAJE_CONFIRMADO ??
      fila.porcentajeConfirmado ??
      fila.PORCENTAJE ??
      fila.porcentaje;

    if (porcentaje === undefined || porcentaje === null) {
      porcentaje = total > 0
        ? (confirmados / total) * 100
        : 0;
    }

    porcentaje = Math.max(0, Math.min(100, numero(porcentaje)));
    const porcentajeVisual = Math.round(porcentaje);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <div class="fw-semibold">${escapar(fila.CODIGO_ALTA ?? fila.codigoAlta ?? '-')}</div>
        <div class="small text-secondary">ID ${escapar(id ?? '-')}</div>
      </td>

      <td>${escapar(fila.DETALLE_MARCA ?? fila.marca ?? '-')}</td>
      <td>${escapar(fila.DETALLE_RUBRO ?? fila.rubro ?? '-')}</td>
      <td>${formatearAnoTemporada(fila)}</td>
      <td>${badgeLicencia(fila.LICENCIA_ALTA ?? fila.licenciaAlta)}</td>
      <td>${escapar(fila.TIPO_PRODUCTO ?? fila.tipoProducto ?? '-')}</td>

      <td>
        <span class="badge ${claseEstado(estado)}">
          ${escapar(estado)}
        </span>
      </td>

      <td class="text-nowrap">
        ${confirmados} / ${total}
      </td>

      <td>
        <div class="progress" role="progressbar" aria-valuenow="${porcentajeVisual}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width:${porcentajeVisual}%">${porcentajeVisual}%</div>
        </div>
      </td>

      <td class="small text-break">
        ${escapar(fila.ARCHIVO_EXPORTADO ?? fila.archivoExportado ?? '-')}
      </td>

      <td class="text-end">
        <a href="/seguimiento/${encodeURIComponent(id)}" class="btn btn-sm btn-outline-primary">
          Ver
        </a>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function formatearAnoTemporada(fila) {
  const ano =
    fila.DETALLE_ANO ??
    fila.DETALLE_AÑO ??
    fila.ANO ??
    fila.AÑO ??
    fila.CODIGO_ANO ??
    fila.CODIGO_AÑO ??
    '-';

  const codigoTemporada =
    fila.CODIGO_TEMPORADA ??
    fila.CODIGO_TEM ??
    fila.COD_TEM ??
    '';

  const detalleTemporada =
    fila.DETALLE_TEMPORADA ??
    fila.DETALLE_TEM ??
    fila.DCOD_TEM ??
    fila.TEMPORADA ??
    '';

  let temporada = '-';

  if (detalleTemporada && codigoTemporada) {
    temporada = `${codigoTemporada} - ${detalleTemporada}`;
  } else if (detalleTemporada) {
    temporada = detalleTemporada;
  } else if (codigoTemporada) {
    temporada = codigoTemporada;
  }

  return `
    <div class="d-flex flex-wrap gap-1">
      <span class="badge text-bg-light border">${escapar(ano)}</span>
      <span class="badge text-bg-light border">${escapar(temporada)}</span>
    </div>
  `;
}


function badgeLicencia(licencia) {
  const valor =
    String(
      licencia || 'SIN DEFINIR'
    ).trim();

  const clase =
    valor.toUpperCase() === 'SIN LICENCIA'
      ? 'text-bg-secondary'
      : 'text-bg-light border text-dark';

  return `
    <span class="badge ${clase}">
      ${escapar(valor)}
    </span>
  `;
}


function claseEstado(estado) {
  switch (String(estado).toUpperCase()) {
    case 'EXPORTADO': return 'text-bg-primary';
    case 'PARCIAL_ERP': return 'text-bg-warning';
    case 'GENERADO_OK_EN_ERP': return 'text-bg-success';
    case 'SIN_NOVEDADES_ERP': return 'text-bg-info';
    case 'ERROR_ERP': return 'text-bg-danger';
    case 'ANULADO': return 'text-bg-danger';
    default: return 'text-bg-secondary';
  }
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function setTexto(id, valor) {
  document.getElementById(id).textContent = valor;
}

function mostrarAlerta(mensaje, tipo) {
  const el = document.getElementById('alertaSeguimiento');
  el.className = `alert alert-${tipo}`;
  el.textContent = mensaje;
}

function ocultarAlerta() {
  const el = document.getElementById('alertaSeguimiento');
  el.className = 'alert d-none';
  el.textContent = '';
}

function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
