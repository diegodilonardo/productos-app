const paginaSeguimiento =
  document.getElementById('paginaSeguimientoDetalle');

const ID_ALTA_SEGUIMIENTO =
  Number(paginaSeguimiento.dataset.idAlta);

let productosSeguimiento = [];

document.addEventListener('DOMContentLoaded', iniciarDetalleSeguimiento);

async function iniciarDetalleSeguimiento() {
  document
    .getElementById('btnActualizarDetalleSeguimiento')
    .addEventListener('click', cargarDetalleSeguimiento);

  document
    .getElementById('filtroProductoERP')
    .addEventListener('change', pintarProductosFiltrados);

  await cargarDetalleSeguimiento();
}

async function cargarDetalleSeguimiento() {
  ocultarAlerta();

  const btn = document.getElementById('btnActualizarDetalleSeguimiento');

  try {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    const response = await fetch(
      `/api/seguimiento/altas/${ID_ALTA_SEGUIMIENTO}`
    );

    let data = null;
    try { data = await response.json(); } catch {}

    if (!response.ok) {
      throw new Error(data?.mensaje || `Error HTTP ${response.status}.`);
    }

    const resultado =
      data?.resultado ??
      data?.datos ??
      data?.data ??
      data;

    pintarCabecera(resultado?.alta ?? {});
    pintarResumen(resultado?.seguimientoErp ?? {});
    productosSeguimiento =
      Array.isArray(resultado?.productos)
        ? resultado.productos
        : [];

    pintarProductosFiltrados();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar';
  }
}

function pintarCabecera(alta) {
  const estado = alta.ESTADO ?? '-';

  setTexto('detIdAlta', alta.ID_ALTA ?? ID_ALTA_SEGUIMIENTO);
  setTexto('detMarca', alta.DETALLE_MARCA ?? '-');
  setTexto('detRubro', alta.DETALLE_RUBRO ?? '-');
  setTexto('detTipo', alta.TIPO_PRODUCTO ?? '-');
  setTexto('detArchivo', alta.ARCHIVO_EXPORTADO ?? '-');
  setTexto('codigoAltaSeguimiento', alta.CODIGO_ALTA ?? '-');

  const badge = document.getElementById('detEstado');
  badge.textContent = estado;
  badge.className = `badge ${claseEstadoAlta(estado)}`;
}

function pintarResumen(seguimiento) {
  const total = numero(seguimiento.total);
  const confirmados = numero(seguimiento.confirmados);
  const pendientes = numero(seguimiento.pendientes);
  const errores = numero(seguimiento.errores);
  const porcentaje = Math.max(
    0,
    Math.min(100, numero(seguimiento.porcentajeConfirmado))
  );

  setTexto('detTotal', total);
  setTexto('detConfirmados', confirmados);
  setTexto('detPendientes', pendientes);
  setTexto('detErrores', errores);
  setTexto('detPorcentaje', `${porcentaje}%`);

  const barra = document.getElementById('barraSeguimientoERP');
  barra.style.width = `${porcentaje}%`;
  barra.textContent = `${porcentaje}%`;
  barra.setAttribute('aria-valuenow', porcentaje);

  const mensaje = document.getElementById('mensajeSeguimientoERP');

  if (total === 0) {
    mensaje.className = 'alert alert-secondary';
    mensaje.textContent =
      'Todavía no hay registros exportados asociados a esta alta.';
  } else if (errores > 0) {
    mensaje.className = 'alert alert-danger';
    mensaje.textContent =
      `Hay ${errores} producto(s) con error de conciliación ERP.`;
  } else if (confirmados === total) {
    mensaje.className = 'alert alert-success';
    mensaje.textContent =
      'Todos los productos fueron confirmados correctamente en Presea.';
  } else if (confirmados > 0) {
    mensaje.className = 'alert alert-warning';
    mensaje.textContent =
      `${confirmados} de ${total} productos fueron confirmados. Quedan ${pendientes} pendientes.`;
  } else {
    mensaje.className = 'alert alert-info';
    mensaje.textContent =
      `El archivo fue exportado y los ${pendientes || total} productos están pendientes de confirmación en Presea.`;
  }
}

function pintarProductosFiltrados() {
  const filtro = document.getElementById('filtroProductoERP').value;

  const filas = filtro
    ? productosSeguimiento.filter(item =>
        String(item.ESTADO_ERP ?? '').toUpperCase() === filtro
      )
    : productosSeguimiento;

  pintarProductos(filas);
}

function pintarProductos(filas) {
  const tbody = document.getElementById('tablaProductosSeguimientoERP');
  tbody.innerHTML = '';

  if (!filas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-secondary">
          No hay productos para mostrar.
        </td>
      </tr>
    `;
    return;
  }

  for (const fila of filas) {
    const estado = fila.ESTADO_ERP ?? '-';

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td class="font-monospace">
        ${escapar(fila.COD_ALFA ?? '-')}
      </td>

      <td class="font-monospace">
        ${escapar(fila.CODIGO_ERP ?? '-')}
      </td>

      <td class="font-monospace">
        ${escapar(fila.EAN_ERP ?? '-')}
      </td>

      <td>
        <span class="badge ${claseEstadoProducto(estado)}">
          ${escapar(estado)}
        </span>
      </td>

      <td>
        ${escapar(formatearFecha(fila.FECHA_CONFIRMACION_ERP))}
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function claseEstadoAlta(estado) {
  switch (String(estado).toUpperCase()) {
    case 'EXPORTADO': return 'text-bg-primary';
    case 'PARCIAL_ERP': return 'text-bg-warning';
    case 'GENERADO_OK_EN_ERP': return 'text-bg-success';
    default: return 'text-bg-secondary';
  }
}

function claseEstadoProducto(estado) {
  switch (String(estado).toUpperCase()) {
    case 'PENDIENTE_ERP': return 'text-bg-secondary';
    case 'GENERADO_OK_EN_ERP': return 'text-bg-success';
    case 'ERROR_ERP': return 'text-bg-danger';
    default: return 'text-bg-secondary';
  }
}

function formatearFecha(valor) {
  if (!valor) return '-';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return fecha.toLocaleString('es-AR');
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function setTexto(id, valor) {
  document.getElementById(id).textContent = valor;
}

function mostrarAlerta(mensaje, tipo) {
  const el = document.getElementById('alertaSeguimientoDetalle');
  el.className = `alert alert-${tipo}`;
  el.textContent = mensaje;
}

function ocultarAlerta() {
  const el = document.getElementById('alertaSeguimientoDetalle');
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
