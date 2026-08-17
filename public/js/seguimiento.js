document.addEventListener('DOMContentLoaded', iniciarSeguimiento);

let altasSeguimiento = [];

async function iniciarSeguimiento() {
  document
    .getElementById('btnActualizarSeguimiento')
    .addEventListener('click', cargarTodo);

  document
    .getElementById('filtroEstadoSeguimiento')
    .addEventListener('change', pintarAltasFiltradas);

  await cargarTodo();
}

async function cargarTodo() {
  ocultarAlerta();

  const btn = document.getElementById('btnActualizarSeguimiento');

  try {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    const [resumenData, altasData] = await Promise.all([
      apiSeguimiento('/api/seguimiento/resumen'),
      apiSeguimiento('/api/seguimiento/altas')
    ]);

    const resumen = extraerResultado(resumenData) || {};
    altasSeguimiento = normalizarLista(extraerResultado(altasData));

    pintarResumen(resumen);
    pintarAltasFiltradas();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar';
  }
}

async function apiSeguimiento(url) {
  const response = await fetch(url);

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

  const filas = estadoFiltro
    ? altasSeguimiento.filter(item =>
        String(item.ESTADO ?? item.estado ?? '').toUpperCase() === estadoFiltro
      )
    : altasSeguimiento;

  pintarAltas(filas);
}

function pintarAltas(filas) {
  const tbody = document.getElementById('tablaSeguimientoAltas');
  tbody.innerHTML = '';

  if (!filas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-secondary">
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

function claseEstado(estado) {
  switch (String(estado).toUpperCase()) {
    case 'EXPORTADO': return 'text-bg-primary';
    case 'PARCIAL_ERP': return 'text-bg-warning';
    case 'GENERADO_OK_EN_ERP': return 'text-bg-success';
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
