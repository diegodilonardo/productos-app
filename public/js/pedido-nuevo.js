document.addEventListener('DOMContentLoaded', iniciarNuevoPedido);

let altas = [];

async function iniciarNuevoPedido() {
  document.getElementById('idAlta').addEventListener('change', cambiarAlta);
  document.getElementById('codigoProveedor').addEventListener('change', actualizarResumen);
  document.getElementById('numeroOrden').addEventListener('input', actualizarResumen);
  document.getElementById('moneda').addEventListener('change', actualizarResumen);
  document.getElementById('formNuevoPedido').addEventListener('submit', crearPedido);

  actualizarResumen();
  await cargarAltas();
}

async function api(url, opciones) {
  const response = await fetch(url, opciones);

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

async function cargarAltas() {
  try {
    const data =
      await api(
        '/api/pedidos/altas-disponibles'
      );

    altas =
      Array.isArray(data?.datos)
        ? data.datos
        : [];

    const selectAlta =
      document.getElementById('idAlta');

    selectAlta.innerHTML =
      '<option value="">Seleccionar Alta...</option>' +
      altas
        .map(
          alta =>
            `<option value="${esc(alta.ID_ALTA)}">` +
            `${esc(alta.CODIGO_ALTA)} · ` +
            `${esc(alta.DETALLE_MARCA)} · ` +
            `${esc(alta.DETALLE_RUBRO)} · ` +
            `${esc(alta.DETALLE_TEMPORADA || alta.CODIGO_TEMPORADA || '-')} / ` +
            `${esc(alta.CODIGO_ANO || '-')} · ` +
            `${esc(alta.LICENCIA_ALTA || 'SIN LICENCIA')} · ` +
            `${esc(formatearTipo(alta.TIPO_PRODUCTO))}` +
            `</option>`
        )
        .join('');

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
      selectAlta.value =
        preseleccionada;

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

async function cambiarAlta() {
  ocultarAlerta();

  const idAlta =
    document
      .getElementById('idAlta')
      .value;

  const selectProveedor =
    document
      .getElementById('codigoProveedor');

  const alta =
    obtenerAltaSeleccionada();

  document
    .getElementById('infoAlta')
    .textContent =
      alta
        ? (
            `${alta.DETALLE_MARCA} · ` +
            `${alta.DETALLE_RUBRO} · ` +
            `${formatearTipo(alta.TIPO_PRODUCTO)} · ` +
            `${alta.DETALLE_TEMPORADA || alta.CODIGO_TEMPORADA || '-'} / ${alta.CODIGO_ANO || '-'} · ` +
            `${alta.LICENCIA_ALTA || 'SIN LICENCIA'}`
          )
        : 'Solo se muestran Altas confirmadas en ERP.';

  if (!idAlta) {
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
        `/api/pedidos/altas/${encodeURIComponent(idAlta)}/proveedores`
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

function obtenerAltaSeleccionada() {
  const idAlta =
    document
      .getElementById('idAlta')
      .value;

  return altas.find(
    alta =>
      String(alta.ID_ALTA) ===
      String(idAlta)
  ) || null;
}

function actualizarResumen() {
  const alta =
    obtenerAltaSeleccionada();

  const contenedorVacio =
    document
      .getElementById('pedidoResumenVacio');

  const contenedorDatos =
    document
      .getElementById('pedidoResumenDatos');

  if (!alta) {
    contenedorVacio.classList.remove('d-none');
    contenedorDatos.classList.add('d-none');
    return;
  }

  contenedorVacio.classList.add('d-none');
  contenedorDatos.classList.remove('d-none');

  setTexto(
    'resumenAlta',
    alta.CODIGO_ALTA || '-'
  );

  setTexto(
    'resumenMarcaRubro',
    [
      alta.DETALLE_MARCA,
      alta.DETALLE_RUBRO
    ]
      .filter(Boolean)
      .join(' · ') || '-'
  );

  setTexto(
    'resumenTipo',
    formatearTipo(
      alta.TIPO_PRODUCTO
    )
  );

  setTexto(
    'resumenCampana',
    [
      alta.DETALLE_TEMPORADA ||
        alta.CODIGO_TEMPORADA,
      alta.CODIGO_ANO
    ]
      .filter(Boolean)
      .join(' / ') || '-'
  );

  setTexto(
    'resumenLicencia',
    alta.LICENCIA_ALTA || 'SIN LICENCIA'
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

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const boton =
    document
      .getElementById('btnCrearPedido');

  const payload = {
    idAlta:
      Number(
        document
          .getElementById('idAlta')
          .value
      ),

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
        .trim(),

    usuario:
      'SISTEMA'
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
