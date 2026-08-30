let altasCargadas = [];

document.addEventListener('DOMContentLoaded', iniciarPantallaAltas);

async function iniciarPantallaAltas() {
  window.addEventListener(
    'app:empresa-cambiada',
    actualizarEmpresaAltas
  );

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

function actualizarEmpresaAltas(event) {
  event.preventDefault();

  altasCargadas = [];
  pintarContadores();
  pintarAltasFiltradas();
  cargarAltas();
}

async function cargarAltas() {
  ocultarAlerta();

  const btn =
    document.getElementById('btnActualizarAltas');

  try {
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    const idEmpresa =
      obtenerEmpresaActivaAltas();

    if (!idEmpresa) {
      throw new Error(
        'Debe seleccionar una empresa desde la barra superior.'
      );
    }

    const response =
      await fetch(
        '/api/altas',
        {
          headers: {
            Accept: 'application/json',
            'x-id-empresa': String(idEmpresa)
          }
        }
      );

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

function obtenerEmpresaActivaAltas() {
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
        item.CODIGO_TEMPORADA,
        item.LICENCIA_ALTA,
        item.LICENCIA,
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
        <td colspan="9" class="text-center py-5 text-secondary">
          <div class="altas-empty">
            <div class="altas-empty-icon">ALT</div>
            <strong>No hay altas para mostrar</strong>
            <span>Probá cambiando la búsqueda o el filtro de estado.</span>
            <a href="/altas/nueva" class="btn btn-sm btn-outline-primary mt-2">
              Crear nueva Alta
            </a>
          </div>
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

    const licencia =
      normalizarLicenciaAlta(
        alta
      );

    const temporada =
      alta.DETALLE_TEMPORADA ??
      alta.CODIGO_TEMPORADA ??
      '-';

    const tr =
      document.createElement('tr');

    tr.className =
      `altas-row altas-row-${estado.toLowerCase().replaceAll('_', '-')}`;

    tr.innerHTML = `
      <td class="alta-cell">
        <div class="altas-code">
          ${escapar(
            alta.CODIGO_ALTA ??
            '-'
          )}
        </div>

        <div class="altas-id">
          ID ${escapar(
            id ??
            '-'
          )}
        </div>
      </td>

      <td>
        <div class="altas-primary-text">
          ${escapar(
            alta.DETALLE_MARCA ??
            '-'
          )}
        </div>

        <div class="altas-secondary-text">
          ${escapar(
            alta.DETALLE_RUBRO ??
            '-'
          )}
        </div>
      </td>

      <td>
        <span class="altas-type">
          ${escapar(
            alta.TIPO_PRODUCTO ??
            '-'
          )}
        </span>
      </td>

      <td>
        <div class="altas-primary-text">
          ${escapar(
            alta.CODIGO_ANO ??
            '-'
          )}
        </div>

        <div class="altas-secondary-text">
          ${escapar(
            temporada
          )}
        </div>
      </td>

      <td>
        ${badgeLicencia(
          licencia
        )}
      </td>

      <td class="text-center">
        <span class="altas-product-count">
          ${escapar(
            cantidad
          )}
        </span>
      </td>

      <td>
        <span class="badge ${claseEstado(estado)}">
          ${escapar(
            estado
          )}
        </span>

        ${
          estado === 'ANULADO'
            ? `
                <div
                  class="altas-cancel-reason"
                  title="${escapar(alta.MOTIVO_ANULACION ?? alta.motivoAnulacion ?? '')}"
                >
                  ${escapar(alta.MOTIVO_ANULACION ?? alta.motivoAnulacion ?? 'Sin motivo informado')}
                </div>
              `
            : ''
        }
      </td>

      <td class="text-nowrap">
        <div class="altas-date">
          ${escapar(
            formatearFecha(
              alta.FECHA_CREACION
            )
          )}
        </div>
      </td>

      <td class="text-end">
        ${botonAccion(
          id,
          estado
        )}
      </td>
    `;

    tbody.appendChild(
      tr
    );
  }
}


function normalizarLicenciaAlta(alta) {
  const valor =
    alta.LICENCIA_ALTA ??
    alta.LICENCIA ??
    alta.licenciaAlta ??
    alta.licencia;

  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    const cantidad =
      Number(
        alta.CANTIDAD_PRODUCTOS ??
        alta.cantidadProductos ??
        0
      );

    return cantidad > 0
      ? 'SIN LICENCIA'
      : 'SIN DEFINIR';
  }

  const texto =
    String(
      valor
    ).trim();

  if (
    texto ===
    '__SIN_LICENCIA__'
  ) {
    return 'SIN LICENCIA';
  }

  return texto;
}


function badgeLicencia(valor) {
  const texto =
    String(
      valor ||
      'SIN DEFINIR'
    );

  if (
    texto ===
    'SIN DEFINIR'
  ) {
    return `
      <span class="altas-license altas-license-muted">
        Sin definir
      </span>
    `;
  }

  if (
    texto ===
    'SIN LICENCIA'
  ) {
    return `
      <span class="altas-license altas-license-neutral">
        Sin licencia
      </span>
    `;
  }

  return `
    <span
      class="altas-license"
      title="${escapar(texto)}"
    >
      ${escapar(texto)}
    </span>
  `;
}


function botonAccion(id, estado) {
  if (!id) {
    return '-';
  }

  const hrefProductos =
    `/altas/${encodeURIComponent(id)}/productos`;

  if (
    [
      'BORRADOR',
      'VALIDADO'
    ].includes(
      estado
    )
  ) {
    return `
      <a
        href="${hrefProductos}"
        class="btn btn-sm btn-primary altas-action-btn"
        title="Abrir lote, productos e imágenes"
      >
        Abrir
      </a>
    `;
  }

  if (
    [
      'EXPORTADO',
      'PARCIAL_ERP',
      'GENERADO_OK_EN_ERP'
    ].includes(
      estado
    )
  ) {
    return `
      <div class="d-flex justify-content-end gap-1">
        <a
          href="${hrefProductos}"
          class="btn btn-sm btn-outline-secondary altas-action-btn"
          title="Ver productos e imágenes"
        >
          Ver
        </a>

        <a
          href="/seguimiento/${encodeURIComponent(id)}"
          class="btn btn-sm btn-outline-success altas-action-btn"
          title="Abrir seguimiento ERP"
        >
          ERP
        </a>
      </div>
    `;
  }

  return `
    <a
      href="${hrefProductos}"
      class="btn btn-sm btn-outline-secondary altas-action-btn"
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
