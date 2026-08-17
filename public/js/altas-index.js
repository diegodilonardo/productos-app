let altasCargadas = [];

document.addEventListener('DOMContentLoaded', iniciarPantallaAltas);

async function iniciarPantallaAltas() {
  document
    .getElementById('btnActualizarAltas')
    .addEventListener('click', cargarAltas);

  document
    .getElementById('buscarAlta')
    .addEventListener('input', pintarAltasFiltradas);

  document
    .getElementById('filtroEstadoAlta')
    .addEventListener('change', pintarAltasFiltradas);

  mostrarMensajeGuardado();
  await cargarAltas();
}

async function cargarAltas() {
  ocultarAlerta();

  const btn =
    document.getElementById('btnActualizarAltas');

  try {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    const response =
      await fetch('/api/altas');

    let data = null;

    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(
        data?.mensaje ||
        `Error HTTP ${response.status}.`
      );
    }

    altasCargadas =
      normalizarListaAltas(data);

    pintarContadores();
    pintarAltasFiltradas();

  } catch (error) {
    mostrarAlerta(
      error.message,
      'danger'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar';
  }
}

function normalizarListaAltas(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.resultado)) {
    return data.resultado;
  }

  if (Array.isArray(data?.datos)) {
    return data.datos;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.resultado?.altas)) {
    return data.resultado.altas;
  }

  return [];
}

function pintarContadores() {
  const estado = item =>
    String(
      item.ESTADO ||
      item.estado ||
      ''
    ).toUpperCase();

  const borradores =
    altasCargadas.filter(
      item => estado(item) === 'BORRADOR'
    ).length;

  const validados =
    altasCargadas.filter(
      item => estado(item) === 'VALIDADO'
    ).length;

  const exportados =
    altasCargadas.filter(
      item =>
        [
          'EXPORTADO',
          'PARCIAL_ERP',
          'GENERADO_OK_EN_ERP'
        ].includes(estado(item))
    ).length;

  setTexto(
    'contadorBorradores',
    borradores
  );

  setTexto(
    'contadorValidados',
    validados
  );

  setTexto(
    'contadorExportados',
    exportados
  );

  setTexto(
    'contadorTotal',
    altasCargadas.length
  );
}

function pintarAltasFiltradas() {
  const texto =
    document
      .getElementById('buscarAlta')
      .value
      .trim()
      .toUpperCase();

  const estadoFiltro =
    document
      .getElementById('filtroEstadoAlta')
      .value
      .trim()
      .toUpperCase();

  const filtradas =
    altasCargadas.filter(item => {
      const estado =
        String(
          item.ESTADO ||
          item.estado ||
          ''
        ).toUpperCase();

      if (
        estadoFiltro &&
        estado !== estadoFiltro
      ) {
        return false;
      }

      if (!texto) {
        return true;
      }

      const bolsa = [
        item.CODIGO_ALTA,
        item.DETALLE_MARCA,
        item.DETALLE_RUBRO,
        item.TIPO_PRODUCTO,
        item.CODIGO_ANO,
        item.DETALLE_TEMPORADA,
        item.USUARIO_CREACION
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();

      return bolsa.includes(texto);
    });

  pintarTablaAltas(filtradas);
}

function pintarTablaAltas(filas) {
  const tbody =
    document.getElementById('tablaAltas');

  tbody.innerHTML = '';

  if (!filas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4 text-secondary">
          No hay altas para mostrar.
        </td>
      </tr>
    `;

    return;
  }

  for (const alta of filas) {
    const id =
      alta.ID_ALTA ??
      alta.idAlta;

    const estado =
      String(
        alta.ESTADO ||
        alta.estado ||
        '-'
      ).toUpperCase();

    const cantidad =
      alta.CANTIDAD_PRODUCTOS ??
      alta.cantidadProductos ??
      0;

    const tr =
      document.createElement('tr');

    tr.innerHTML = `
      <td>
        <div class="fw-semibold font-monospace">
          ${escapar(alta.CODIGO_ALTA ?? '-')}
        </div>
        <div class="small text-secondary">
          ID ${escapar(id ?? '-')}
        </div>
      </td>

      <td>${escapar(alta.DETALLE_MARCA ?? '-')}</td>
      <td>${escapar(alta.DETALLE_RUBRO ?? '-')}</td>
      <td>${escapar(alta.TIPO_PRODUCTO ?? '-')}</td>
      <td>${escapar(alta.CODIGO_ANO ?? '-')}</td>
      <td>${escapar(alta.DETALLE_TEMPORADA ?? alta.CODIGO_TEMPORADA ?? '-')}</td>
      <td class="text-center">${escapar(cantidad)}</td>

      <td>
        <span class="badge ${claseEstado(estado)}">
          ${escapar(estado)}
        </span>
      </td>

      <td class="text-nowrap">
        ${escapar(formatearFecha(alta.FECHA_CREACION))}
      </td>

      <td class="text-end">
        ${botonAccion(id, estado)}
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function botonAccion(id, estado) {
  if (!id) {
    return '-';
  }

  if (estado === 'BORRADOR') {
    return `
      <a
        href="/altas/${encodeURIComponent(id)}/productos"
        class="btn btn-sm btn-primary"
      >
        Continuar edición
      </a>
    `;
  }

  if (estado === 'VALIDADO') {
    return `
      <a
        href="/altas/${encodeURIComponent(id)}/productos"
        class="btn btn-sm btn-outline-primary"
      >
        Ver / Exportar
      </a>
    `;
  }

  if (
    [
      'EXPORTADO',
      'PARCIAL_ERP',
      'GENERADO_OK_EN_ERP'
    ].includes(estado)
  ) {
    return `
      <a
        href="/seguimiento/${encodeURIComponent(id)}"
        class="btn btn-sm btn-outline-success"
      >
        Seguimiento ERP
      </a>
    `;
  }

  return `
    <a
      href="/altas/${encodeURIComponent(id)}/productos"
      class="btn btn-sm btn-outline-secondary"
    >
      Ver
    </a>
  `;
}

function mostrarMensajeGuardado() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const id =
    params.get('guardado');

  if (!id) {
    return;
  }

  const productos =
    params.get('productos');

  mostrarAlerta(
    productos !== null
      ? (
          `Borrador ID ${id} guardado correctamente. ` +
          `${productos} producto(s) permanecen en el lote y podés retomarlo cuando quieras.`
        )
      : (
          `Borrador ID ${id} guardado correctamente.`
        ),
    'success'
  );

  /*
    Limpiamos la URL para que el aviso no reaparezca
    al refrescar la pantalla.
  */
  window.history.replaceState(
    {},
    document.title,
    '/altas'
  );
}

function claseEstado(estado) {
  switch (estado) {
    case 'BORRADOR':
      return 'text-bg-secondary';

    case 'VALIDADO':
      return 'text-bg-info';

    case 'EXPORTADO':
      return 'text-bg-primary';

    case 'PARCIAL_ERP':
      return 'text-bg-warning';

    case 'GENERADO_OK_EN_ERP':
      return 'text-bg-success';

    case 'ANULADO':
      return 'text-bg-danger';

    default:
      return 'text-bg-secondary';
  }
}

function formatearFecha(valor) {
  if (!valor) {
    return '-';
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return valor;
  }

  return fecha.toLocaleString(
    'es-AR'
  );
}

function setTexto(id, valor) {
  document
    .getElementById(id)
    .textContent = valor;
}

function mostrarAlerta(mensaje, tipo) {
  const el =
    document.getElementById('alertaAltas');

  el.className =
    `alert alert-${tipo}`;

  el.textContent =
    mensaje;
}

function ocultarAlerta() {
  const el =
    document.getElementById('alertaAltas');

  el.className =
    'alert d-none';

  el.textContent =
    '';
}

function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
