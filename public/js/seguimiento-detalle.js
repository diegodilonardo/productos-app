const paginaSeguimiento =
  document.getElementById('paginaSeguimientoDetalle');

const ID_ALTA_SEGUIMIENTO =
  Number(paginaSeguimiento.dataset.idAlta);

let productosSeguimiento = [];
let estadoAltaSeguimiento = '';

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
  estadoAltaSeguimiento = String(estado).trim().toUpperCase();

  setTexto('detIdAlta', alta.ID_ALTA ?? ID_ALTA_SEGUIMIENTO);
  setTexto('detMarca', alta.DETALLE_MARCA ?? '-');
  setTexto('detRubro', alta.DETALLE_RUBRO ?? '-');

  setTexto(
    'detAno',
    alta.DETALLE_ANO ??
    alta.CODIGO_ANO ??
    '-'
  );

  const temporada =
    alta.DETALLE_TEMPORADA && alta.CODIGO_TEMPORADA
      ? `${alta.CODIGO_TEMPORADA} - ${alta.DETALLE_TEMPORADA}`
      : (
          alta.DETALLE_TEMPORADA ??
          alta.CODIGO_TEMPORADA ??
          '-'
        );

  setTexto(
    'detTemporada',
    temporada
  );

  const licencia =
    String(
      alta.LICENCIA_ALTA ||
      'SIN DEFINIR'
    ).trim();

  const badgeLicencia =
    document.getElementById(
      'detLicencia'
    );

  badgeLicencia.textContent =
    licencia;

  badgeLicencia.className =
    licencia.toUpperCase() === 'SIN LICENCIA'
      ? 'badge text-bg-secondary'
      : 'badge text-bg-light border text-dark';

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

  const esSinNovedades =
    estadoAltaSeguimiento === 'SIN_NOVEDADES_ERP';

  const pasos =
    document.querySelector('.seguimiento-steps');

  const progreso =
    document.querySelector('.seguimiento-main-progress');

  const porcentajeVisual =
    document.querySelector('.seguimiento-percent');

  if (pasos) {
    pasos.classList.toggle('d-none', esSinNovedades);
  }

  if (progreso) {
    progreso.classList.toggle('d-none', esSinNovedades);
  }

  if (porcentajeVisual) {
    porcentajeVisual.classList.toggle('d-none', esSinNovedades);
  }

  const pasoExportado = document.getElementById('seguimientoPasoExportado');
  const pasoDetectado = document.getElementById('seguimientoPasoDetectado');
  const pasoConfirmado = document.getElementById('seguimientoPasoConfirmado');
  [pasoExportado, pasoDetectado, pasoConfirmado].forEach(paso => {
    paso?.classList.remove('is-active', 'is-done', 'is-error');
  });

  if (total === 0) {
    pasoExportado?.classList.add('is-active');
  } else if (errores > 0) {
    pasoExportado?.classList.add('is-done');
    pasoDetectado?.classList.add('is-error');
    pasoConfirmado?.classList.add('is-error');
  } else if (confirmados === total) {
    pasoExportado?.classList.add('is-done');
    pasoDetectado?.classList.add('is-done');
    pasoConfirmado?.classList.add('is-done');
  } else if (confirmados > 0) {
    pasoExportado?.classList.add('is-done');
    pasoDetectado?.classList.add('is-done');
    pasoConfirmado?.classList.add('is-active');
  } else {
    pasoExportado?.classList.add('is-done');
    pasoDetectado?.classList.add('is-active');
  }

  if (esSinNovedades) {
    mensaje.className = 'alert alert-success seguimiento-status-message';
    mensaje.innerHTML =
      '<strong>Cerrado sin novedades.</strong> ' +
      'Todos los productos del Alta ya existían en Presea. ' +
      'No fue necesaria ninguna exportación ni conciliación ERP.';
    return;
  }

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
    case 'SIN_NOVEDADES_ERP': return 'text-bg-info';
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

  const texto = String(valor);
  const fecha = new Date(texto.endsWith('Z') ? texto.slice(0, -1) : texto);
  if (Number.isNaN(fecha.getTime())) return texto;

  return fecha.toLocaleString('es-AR', { hour12: false });
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
