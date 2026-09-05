document.addEventListener('DOMContentLoaded', iniciarNuevoPedido);

let altas = [];
let contextoUsuario = null;
let idEmpresaPedido = null;
let accesoEmpresaPedido = null;
let idsAltasSeleccionadas = new Set();
let modalModelosAlta = null;

async function iniciarNuevoPedido() {
  document.getElementById('altasPedidoSelector').addEventListener('change', cambiarAlta);
  document.getElementById('altasPedidoSelector').addEventListener('click', event => {
    const boton = event.target.closest('[data-ver-modelos-alta]');
    if (!boton) return;
    event.preventDefault();
    event.stopPropagation();
    mostrarModelosAlta(Number(boton.dataset.verModelosAlta));
  });
  document.getElementById('codigoProveedor').addEventListener('change', actualizarResumen);
  document.getElementById('numeroOrden').addEventListener('input', actualizarResumen);
  document.getElementById('moneda').addEventListener('change', actualizarResumen);
  document.getElementById('formNuevoPedido').addEventListener('submit', crearPedido);
  document.getElementById('selectorEmpresaPedido')?.addEventListener('change', cambiarEmpresaPedido);
  ['filtroTemporadaAlta', 'filtroAnoAlta', 'filtroRubroAlta'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderizarAltasFiltradas);
  });
  document.getElementById('limpiarFiltrosAltas').addEventListener('click', limpiarFiltrosAltas);

  actualizarResumen();

  try {
    const listo = await cargarContextoPedido();
    if (listo) await cargarAltas();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  }
}

async function api(url, opciones) {
  const configuracion = {
    ...(opciones || {})
  };

  if (
    idEmpresaPedido &&
    url !== '/api/auth/me'
  ) {
    configuracion.headers = {
      ...(configuracion.headers || {}),
      'x-id-empresa': String(idEmpresaPedido)
    };
  }

  const response = await fetch(url, configuracion);

  let data = null;
  try {
    data = await response.json();
  } catch {}

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.mensaje ||
      `Error HTTP ${response.status}`
    );
  }

  return data;
}

async function cargarContextoPedido() {
  const data = await api('/api/auth/me');
  contextoUsuario = data?.usuario || null;

  if (!contextoUsuario) {
    throw new Error('Debe iniciar sesión.');
  }

  const empresas = Array.isArray(contextoUsuario.empresas) ? contextoUsuario.empresas : [];
  if (!empresas.length) {
    throw new Error('El usuario no tiene empresas habilitadas.');
  }

  const select = document.getElementById('selectorEmpresaPedido');
  const guardada = Number(
    sessionStorage.getItem('app.idEmpresa') ||
    sessionStorage.getItem('pedidos.idEmpresa')
  );
  const guardadaValida = empresas.some(x => Number(x.idEmpresa) === guardada);

  if (empresas.length === 1) {
    idEmpresaPedido = Number(empresas[0].idEmpresa);
  } else if (guardadaValida) {
    idEmpresaPedido = guardada;
  } else {
    idEmpresaPedido = null;
  }

  if (select) {
    select.innerHTML =
      '<option value="">Seleccionar empresa...</option>' +
      empresas.map(x =>
        `<option value="${esc(x.idEmpresa)}">${esc(x.empresa || x.codigoEmpresa || x.idEmpresa)}</option>`
      ).join('');

    select.classList.toggle('d-none', empresas.length <= 1);
    select.value = idEmpresaPedido ? String(idEmpresaPedido) : '';
  }

  if (!idEmpresaPedido) {
    bloquearFormulario(true);
    actualizarPermisosVisuales();
    mostrarAlerta('Seleccione una empresa para crear el Pedido.', 'info');
    return false;
  }

  accesoEmpresaPedido =
    empresas.find(x => Number(x.idEmpresa) === Number(idEmpresaPedido)) || null;

  sessionStorage.setItem('pedidos.idEmpresa', String(idEmpresaPedido));
  sessionStorage.setItem('app.idEmpresa', String(idEmpresaPedido));
  actualizarPermisosVisuales();

  if (!puedeEscribirPedido()) {
    bloquearFormulario(true);
    mostrarAlerta('Su rol es de consulta y no permite crear Pedidos.', 'warning');
    return false;
  }

  bloquearFormulario(false);
  return true;
}

async function cambiarEmpresaPedido() {
  const select = document.getElementById('selectorEmpresaPedido');
  idEmpresaPedido = Number(select?.value || 0) || null;
  altas = [];
  idsAltasSeleccionadas.clear();

  if (!idEmpresaPedido) {
    sessionStorage.removeItem('pedidos.idEmpresa');
    accesoEmpresaPedido = null;
    bloquearFormulario(true);
    actualizarPermisosVisuales();
    mostrarAlerta('Seleccione una empresa para crear el Pedido.', 'info');
    return;
  }

  accesoEmpresaPedido =
    (contextoUsuario?.empresas || []).find(
      x => Number(x.idEmpresa) === Number(idEmpresaPedido)
    ) || null;

  sessionStorage.setItem('pedidos.idEmpresa', String(idEmpresaPedido));
  sessionStorage.setItem('app.idEmpresa', String(idEmpresaPedido));
  actualizarPermisosVisuales();

  if (!puedeEscribirPedido()) {
    bloquearFormulario(true);
    mostrarAlerta('Su rol es de consulta y no permite crear Pedidos.', 'warning');
    return;
  }

  bloquearFormulario(false);
  ocultarAlerta();
  await cargarAltas();
}

function puedeEscribirPedido() {
  if (contextoUsuario?.superAdmin) return true;

  return ['SUPER_ADMIN','ADMIN','OPERADOR'].includes(
    String(accesoEmpresaPedido?.rol || '').trim().toUpperCase()
  );
}

function actualizarPermisosVisuales() {
  const badge = document.getElementById('rolPedido');
  if (!badge) return;

  const rol = contextoUsuario?.superAdmin
    ? 'SUPER_ADMIN'
    : String(accesoEmpresaPedido?.rol || '').toUpperCase();

  badge.textContent = rol ? `Rol: ${rol}` : '';
  badge.classList.toggle('d-none', !rol);
}

function bloquearFormulario(bloquear) {
  const form = document.getElementById('formNuevoPedido');
  if (!form) return;

  form.querySelectorAll('input, select, textarea, button').forEach(control => {
    control.disabled = Boolean(bloquear);
  });
}

function opcionesEmpresa(opciones = {}) {
  if (!idEmpresaPedido) {
    throw new Error('Debe seleccionar una empresa.');
  }

  return {
    ...opciones,
    headers: {
      ...(opciones.headers || {}),
      'x-id-empresa': String(idEmpresaPedido)
    }
  };
}

async function cargarAltas() {
  try {
    const data =
      await api(
        '/api/pedidos/altas-disponibles',
        opcionesEmpresa()
      );

    altas =
      Array.isArray(data?.datos)
        ? data.datos
        : [];

    cargarOpcionesFiltrosAltas();
    renderizarAltasFiltradas();

    const selectorAlta = document.getElementById('altasPedidoSelector');

    const preseleccionada =
      document
        .getElementById('nuevoPedidoApp')
        .dataset
        .alta;

    if (
      preseleccionada &&
      altas.some(
        alta =>
          String(alta.ID_ALTA) ===
          String(preseleccionada)
      )
    ) {
      idsAltasSeleccionadas.add(Number(preseleccionada));
      const control = selectorAlta.querySelector(`input[value="${CSS.escape(String(preseleccionada))}"]`);
      if (control) control.checked = true;

      await cambiarAlta();
    } else {
      actualizarResumen();
    }

  } catch (error) {
    mostrarAlerta(
      error.message,
      'danger'
    );
  }
}

function cargarOpcionesFiltrosAltas() {
  completarFiltroAlta(
    'filtroTemporadaAlta',
    altas.map(alta => ({
      valor: String(alta.CODIGO_TEMPORADA || alta.DETALLE_TEMPORADA || ''),
      etiqueta: String(alta.DETALLE_TEMPORADA || alta.CODIGO_TEMPORADA || '')
    })),
    'Todas'
  );
  completarFiltroAlta(
    'filtroAnoAlta',
    altas.map(alta => ({ valor: String(alta.CODIGO_ANO || ''), etiqueta: String(alta.CODIGO_ANO || '') })),
    'Todos'
  );
  completarFiltroAlta(
    'filtroRubroAlta',
    altas.map(alta => ({
      valor: String(alta.CODIGO_RUBRO || alta.DETALLE_RUBRO || ''),
      etiqueta: String(alta.DETALLE_RUBRO || alta.CODIGO_RUBRO || '')
    })),
    'Todos'
  );
}

function completarFiltroAlta(id, opciones, etiquetaTodas) {
  const select = document.getElementById(id);
  const valorActual = select.value;
  const unicas = [...new Map(
    opciones.filter(item => item.valor).map(item => [item.valor, item])
  ).values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));

  select.innerHTML = `<option value="">${esc(etiquetaTodas)}</option>` +
    unicas.map(item => `<option value="${esc(item.valor)}">${esc(item.etiqueta)}</option>`).join('');
  select.value = unicas.some(item => item.valor === valorActual) ? valorActual : '';
}

function obtenerAltasFiltradas() {
  const temporada = document.getElementById('filtroTemporadaAlta').value;
  const ano = document.getElementById('filtroAnoAlta').value;
  const rubro = document.getElementById('filtroRubroAlta').value;

  return altas.filter(alta =>
    (!temporada || String(alta.CODIGO_TEMPORADA || alta.DETALLE_TEMPORADA || '') === temporada) &&
    (!ano || String(alta.CODIGO_ANO || '') === ano) &&
    (!rubro || String(alta.CODIGO_RUBRO || alta.DETALLE_RUBRO || '') === rubro)
  );
}

function renderizarAltasFiltradas() {
  const filtradas = obtenerAltasFiltradas();
  const selectorAlta = document.getElementById('altasPedidoSelector');
  selectorAlta.innerHTML =
    filtradas
      .map(alta => {
          const campana = [
            alta.DETALLE_TEMPORADA || alta.CODIGO_TEMPORADA,
            alta.CODIGO_ANO
          ].filter(Boolean).join('/');

          const cantidadProductos =
            Number(alta.CANTIDAD_PRODUCTOS_PEDIDO || 0);

          const etiquetaProductos =
            `${cantidadProductos} ${cantidadProductos === 1 ? 'producto' : 'productos'}`;

          return `<div class="pedido-alta-option">` +
            `<label class="pedido-alta-option-main">` +
            `<input class="form-check-input" type="checkbox" name="idsAltas" value="${esc(alta.ID_ALTA)}"${idsAltasSeleccionadas.has(Number(alta.ID_ALTA)) ? ' checked' : ''}>` +
            `<span><strong>${esc(alta.CODIGO_ALTA || `Alta ${alta.ID_ALTA}`)}</strong>` +
            `<small>${esc(alta.DETALLE_MARCA)} · ${esc(alta.DETALLE_RUBRO)} · ` +
            `${esc(campana)} · ${esc(formatearTipo(alta.TIPO_PRODUCTO))} · ${esc(etiquetaProductos)}</small></span>` +
            `</label>` +
            `<button class="btn btn-sm btn-outline-primary pedido-alta-modelos-btn" type="button" data-ver-modelos-alta="${esc(alta.ID_ALTA)}">Ver modelos</button>` +
            `</div>`;
      })
      .join('') || '<div class="text-secondary small p-3">No hay Altas que coincidan con los filtros.</div>';

  setTexto(
    'infoFiltroAltas',
    `${filtradas.length} de ${altas.length} Alta${altas.length === 1 ? '' : 's'} disponible${altas.length === 1 ? '' : 's'}`
  );
}

function limpiarFiltrosAltas() {
  ['filtroTemporadaAlta', 'filtroAnoAlta', 'filtroRubroAlta'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderizarAltasFiltradas();
}

async function mostrarModelosAlta(idAlta) {
  const alta = altas.find(item => Number(item.ID_ALTA) === Number(idAlta));
  if (!alta) return;

  modalModelosAlta ||= new bootstrap.Modal(document.getElementById('modalModelosAlta'));
  setTexto('tituloModelosAlta', alta.CODIGO_ALTA || `Alta ${idAlta}`);
  setTexto('cantidadModelosAlta', '');
  document.getElementById('estadoModelosAlta').classList.remove('d-none');
  document.getElementById('estadoModelosAlta').textContent = 'Cargando modelos...';
  document.getElementById('contenidoModelosAlta').classList.add('d-none');
  document.getElementById('tablaModelosAlta').innerHTML = '';
  modalModelosAlta.show();

  try {
    const data = await api(
      `/api/pedidos/altas/${encodeURIComponent(idAlta)}/resumen-modelos`,
      opcionesEmpresa()
    );
    const filas = Array.isArray(data?.datos) ? data.datos : [];
    const tbody = document.getElementById('tablaModelosAlta');

    if (!filas.length) {
      document.getElementById('estadoModelosAlta').textContent = 'El Alta no tiene modelos disponibles.';
      return;
    }

    tbody.innerHTML = filas.map(fila => `
      <tr>
        <td><strong>${esc(fila.DETALLE_MODELO || fila.CODIGO_MODELO || '-')}</strong><div class="pedido-muted">${esc(fila.CODIGO_MODELO || '')}</div></td>
        <td>${esc(fila.DETALLE_COLOR || fila.CODIGO_COLOR || '-')}</td>
        <td>${esc(fila.CURVA_TALLE || '-')}</td>
        <td>${esc(formatearTipo(fila.TIPO_PRODUCTO_DETALLE))}</td>
        <td><strong>${Number(fila.CANTIDAD_REFERENCIA || 0).toLocaleString('es-AR')} ${esc(fila.UNIDAD_REFERENCIA || '')}</strong></td>
      </tr>`).join('');

    document.getElementById('estadoModelosAlta').classList.add('d-none');
    document.getElementById('contenidoModelosAlta').classList.remove('d-none');
    setTexto('cantidadModelosAlta', `${filas.length} combinación${filas.length === 1 ? '' : 'es'}`);
  } catch (error) {
    document.getElementById('estadoModelosAlta').textContent = error.message;
  }
}

async function cambiarAlta(event) {
  ocultarAlerta();

  const controlCambiado = event?.target?.matches?.('input[name="idsAltas"]')
    ? event.target
    : null;
  if (controlCambiado) {
    const idAlta = Number(controlCambiado.value);
    if (controlCambiado.checked) idsAltasSeleccionadas.add(idAlta);
    else idsAltasSeleccionadas.delete(idAlta);
  } else {
    document.querySelectorAll('#altasPedidoSelector input[name="idsAltas"]:checked').forEach(control => {
      idsAltasSeleccionadas.add(Number(control.value));
    });
  }
  const idsAltas = [...idsAltasSeleccionadas];

  const selectProveedor =
    document
      .getElementById('codigoProveedor');

  const altasElegidas = obtenerAltasSeleccionadas();

  document
    .getElementById('infoAlta')
    .textContent =
      altasElegidas.length
        ? `${altasElegidas.length} Alta(s) seleccionada(s) · ${altasElegidas.reduce((suma, alta) => suma + Number(alta.CANTIDAD_PRODUCTOS_PEDIDO || 0), 0)} productos`
        : 'Solo se muestran Altas confirmadas en ERP.';

  if (!idsAltas.length) {
    selectProveedor.disabled = true;
    selectProveedor.innerHTML =
      '<option value="">Seleccione primero un Alta...</option>';

    actualizarResumen();
    return;
  }

  try {
    selectProveedor.disabled = true;
    selectProveedor.innerHTML =
      '<option value="">Cargando proveedores...</option>';

    const data =
      await api(
        '/api/pedidos/altas/proveedores',
        opcionesEmpresa({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idsAltas })
        })
      );

    const proveedores =
      Array.isArray(data?.datos)
        ? data.datos
        : [];

    selectProveedor.innerHTML =
      '<option value="">Seleccionar proveedor...</option>' +
      proveedores
        .map(
          proveedor =>
            `<option value="${esc(proveedor.CODIGO_PROVEEDOR)}">` +
            `${esc(proveedor.DETALLE_PROVEEDOR)} ` +
            `(${esc(proveedor.CODIGO_PROVEEDOR)})` +
            `</option>`
        )
        .join('');

    selectProveedor.disabled = false;

  } catch (error) {
    selectProveedor.innerHTML =
      '<option value="">Sin proveedores</option>';

    mostrarAlerta(
      error.message,
      'danger'
    );
  }

  actualizarResumen();
}

function obtenerAltasSeleccionadas() {
  return altas.filter(alta => idsAltasSeleccionadas.has(Number(alta.ID_ALTA)));
}

function actualizarResumen() {
  const altasElegidas = obtenerAltasSeleccionadas();
  const alta = altasElegidas[0];

  const contenedorVacio =
    document
      .getElementById('pedidoResumenVacio');

  const contenedorDatos =
    document
      .getElementById('pedidoResumenDatos');

  if (!altasElegidas.length) {
    contenedorVacio.classList.remove('d-none');
    contenedorDatos.classList.add('d-none');
    return;
  }

  contenedorVacio.classList.add('d-none');
  contenedorDatos.classList.remove('d-none');

  setTexto(
    'resumenAlta',
    altasElegidas.map(item => item.CODIGO_ALTA || `Alta ${item.ID_ALTA}`).join(' · ')
  );

  setTexto(
    'resumenMarcaRubro',
    [
      ...new Set(altasElegidas.flatMap(item => [item.DETALLE_MARCA, item.DETALLE_RUBRO]).filter(Boolean))
    ]
      .filter(Boolean)
      .join(' · ') || '-'
  );

  setTexto(
    'resumenTipo',
    [...new Set(altasElegidas.map(item => formatearTipo(item.TIPO_PRODUCTO)))].join(' · ')
  );

  setTexto(
    'resumenProductos',
    `${altasElegidas.reduce((suma, item) => suma + Number(item.CANTIDAD_PRODUCTOS_PEDIDO || 0), 0)} productos`
  );

  setTexto(
    'resumenCampana',
    [
      ...new Set(altasElegidas.map(item => `${item.DETALLE_TEMPORADA || item.CODIGO_TEMPORADA || '-'} / ${item.CODIGO_ANO || '-'}`))
    ]
      .filter(Boolean)
      .join(' / ') || '-'
  );

  const selectProveedor =
    document
      .getElementById('codigoProveedor');

  const proveedorTexto =
    selectProveedor.value
      ? (
          selectProveedor
            .selectedOptions?.[0]
            ?.textContent
            ?.trim() || 'Pendiente'
        )
      : 'Pendiente';

  setTexto(
    'resumenProveedor',
    proveedorTexto
  );

  setTexto(
    'resumenOrden',
    document
      .getElementById('numeroOrden')
      .value
      .trim() || 'Pendiente'
  );

  setTexto(
    'resumenMoneda',
    document
      .getElementById('moneda')
      .value || 'USD'
  );
}

async function crearPedido(event) {
  event.preventDefault();
  ocultarAlerta();

  const form =
    event.currentTarget;

  if (!idsAltasSeleccionadas.size) {
    mostrarAlerta('Debe seleccionar al menos un Alta.', 'warning');
    return;
  }

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const boton =
    document
      .getElementById('btnCrearPedido');

  const payload = {
    idsAltas: [...idsAltasSeleccionadas],

    codigoProveedor:
      document
        .getElementById('codigoProveedor')
        .value,

    numeroOrden:
      document
        .getElementById('numeroOrden')
        .value
        .trim(),

    moneda:
      document
        .getElementById('moneda')
        .value,

    observaciones:
      document
        .getElementById('observaciones')
        .value
        .trim()
  };

  try {
    boton.disabled = true;
    boton.textContent =
      'Creando...';

    const data =
      await api(
        '/api/pedidos',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(
              payload
            )
        }
      );

    window.location.href =
      `/pedidos/${encodeURIComponent(
        data.resultado.ID_PEDIDO
      )}`;

  } catch (error) {
    mostrarAlerta(
      error.message,
      'danger'
    );

    boton.disabled = false;
    boton.textContent =
      'Crear Pedido y continuar';
  }
}

function formatearTipo(valor) {
  const texto =
    String(valor || '')
      .trim()
      .toUpperCase();

  if (texto === 'MODULO') {
    return 'MÓDULO';
  }

  if (texto === 'PAR_SUELTO') {
    return 'PAR SUELTO';
  }

  return valor || '-';
}

function setTexto(id, valor) {
  const elemento =
    document.getElementById(id);

  if (elemento) {
    elemento.textContent =
      valor ?? '-';
  }
}

function esc(valor) {
  return String(
    valor ?? ''
  )
    .replace(
      /[&<>'"]/g,
      caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[caracter]
    );
}

function mostrarAlerta(
  mensaje,
  tipo
) {
  const elemento =
    document
      .getElementById(
        'alertaNuevoPedido'
      );

  elemento.className =
    `alert alert-${tipo}`;

  elemento.textContent =
    mensaje;
}

function ocultarAlerta() {
  const elemento =
    document
      .getElementById(
        'alertaNuevoPedido'
      );

  elemento.className =
    'alert d-none';

  elemento.textContent =
    '';
}
