let altasCargadas = [];
let vistaAltas =
  sessionStorage.getItem('altas.vista') === 'tabla'
    ? 'tabla'
    : 'tarjetas';
let modalProductosAlta = null;

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

  document
    .getElementById('mostrarAnuladasAlta')
    .addEventListener('change', cambiarVisibilidadAnuladasAlta);

  document
    .getElementById('btnVistaTarjetasAltas')
    .addEventListener('click', () => aplicarVistaAltas('tarjetas'));

  document
    .getElementById('btnVistaTablaAltas')
    .addEventListener('click', () => aplicarVistaAltas('tabla'));

  document.addEventListener('click', event => {
    const boton = event.target.closest('[data-ver-productos-alta]');
    if (!boton) return;
    event.preventDefault();
    mostrarProductosAlta(Number(boton.dataset.verProductosAlta));
  });

  mostrarMensajeGuardado();
  aplicarVistaAltas(vistaAltas);
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

  const mostrarAnuladas =
    document
      .getElementById('mostrarAnuladasAlta')
      ?.checked === true;

  const filtradas =
    altasCargadas.filter(item => {
      const estado =
        String(
          item.ESTADO ||
          item.estado ||
          ''
        ).toUpperCase();

      if (
        estado === 'ANULADO' &&
        !mostrarAnuladas
      ) {
        return false;
      }

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

  pintarTarjetasAltas(filtradas);
  pintarTablaAltas(filtradas);
}

function cambiarVisibilidadAnuladasAlta(event) {
  const mostrar = event.currentTarget.checked;
  const filtro = document.getElementById('filtroEstadoAlta');
  const opcionAnulado = filtro?.querySelector('option[value="ANULADO"]');

  if (opcionAnulado) {
    opcionAnulado.disabled = !mostrar;
  }

  if (!mostrar && filtro?.value === 'ANULADO') {
    filtro.value = '';
  }

  pintarAltasFiltradas();
}

function aplicarVistaAltas(vista) {
  vistaAltas = vista === 'tabla' ? 'tabla' : 'tarjetas';
  sessionStorage.setItem('altas.vista', vistaAltas);

  const mostrarTarjetas = vistaAltas === 'tarjetas';
  document.getElementById('tarjetasAltas').classList.toggle('d-none', !mostrarTarjetas);
  document.getElementById('vistaTablaAltas').classList.toggle('d-none', mostrarTarjetas);

  const btnTarjetas = document.getElementById('btnVistaTarjetasAltas');
  const btnTabla = document.getElementById('btnVistaTablaAltas');
  btnTarjetas.classList.toggle('is-active', mostrarTarjetas);
  btnTabla.classList.toggle('is-active', !mostrarTarjetas);
  btnTarjetas.setAttribute('aria-pressed', String(mostrarTarjetas));
  btnTabla.setAttribute('aria-pressed', String(!mostrarTarjetas));
}

function pintarTarjetasAltas(filas) {
  const contenedor = document.getElementById('tarjetasAltas');

  if (!filas.length) {
    contenedor.innerHTML = `
      <div class="altas-card-empty">
        <div class="altas-empty-icon">ALT</div>
        <strong>No hay altas para mostrar</strong>
        <span>Probá cambiando la búsqueda o el filtro de estado.</span>
        <a href="/altas/nueva" class="btn btn-sm btn-outline-primary mt-2">Crear nueva Alta</a>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = filas.map(alta => {
    const id = alta.ID_ALTA ?? alta.idAlta;
    const estado = String(alta.ESTADO || alta.estado || '-').toUpperCase();
    const cantidad = alta.CANTIDAD_PRODUCTOS ?? alta.cantidadProductos ?? 0;
    const cantidadModulos = alta.CANTIDAD_MODULOS ?? alta.cantidadModulos ?? 0;
    const temporada = alta.DETALLE_TEMPORADA ?? alta.CODIGO_TEMPORADA ?? '-';
    const motivo = alta.MOTIVO_ANULACION ?? alta.motivoAnulacion ?? 'Sin motivo informado';

    return `
      <article class="alta-summary-card alta-summary-${estado.toLowerCase().replaceAll('_', '-')}">
        <div class="alta-summary-top">
          <div class="alta-summary-title">
            <div class="altas-code">${escapar(alta.CODIGO_ALTA ?? '-')}</div>
            <div class="altas-id">ID ${escapar(id ?? '-')}</div>
          </div>
          <span class="badge ${claseEstado(estado)}">${escapar(estado)}</span>
        </div>

        <div class="alta-summary-brand">
          <strong>${escapar(alta.DETALLE_MARCA ?? '-')}</strong>
          <span>${escapar(alta.DETALLE_RUBRO ?? '-')}</span>
        </div>

        <div class="alta-summary-meta">
          <div><span>Tipo</span><strong>${escapar(alta.TIPO_PRODUCTO ?? '-')}</strong></div>
          <div><span>Campaña</span><strong>${escapar(alta.CODIGO_ANO ?? '-')} · ${escapar(temporada)}</strong></div>
          <div><span>Licencia</span>${badgeLicencia(normalizarLicenciaAlta(alta))}</div>
          <div><span>Productos</span><strong class="alta-summary-count">${escapar(cantidad)}</strong></div>
          <div><span>Módulos</span><strong class="alta-summary-count">${escapar(cantidadModulos)}</strong></div>
        </div>

        ${estado === 'ANULADO' ? `<div class="alta-summary-cancel">${escapar(motivo)}</div>` : ''}

        <div class="alta-summary-footer">
          <span>Creada ${escapar(formatearFecha(alta.FECHA_CREACION))} · ${escapar(alta.USUARIO_CREACION || 'SISTEMA')}</span>
          <div class="d-flex justify-content-end flex-wrap gap-1">
            ${botonVerProductos(id)}
            ${botonAccion(id, estado)}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function pintarTablaAltas(filas) {
  const tbody =
    document.getElementById('tablaAltas');

  tbody.innerHTML = '';

  if (!filas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-5 text-secondary">
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

    const cantidadModulos =
      alta.CANTIDAD_MODULOS ??
      alta.cantidadModulos ??
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

      <td class="text-center">
        <span class="altas-product-count">
          ${escapar(cantidadModulos)}
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
        <div class="d-flex justify-content-end flex-wrap gap-1">
          ${botonVerProductos(id)}
          ${botonAccion(id, estado)}
        </div>
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

function botonVerProductos(id) {
  if (!id) return '';
  return `
    <button
      type="button"
      class="btn btn-sm btn-outline-primary altas-action-btn"
      data-ver-productos-alta="${escapar(id)}"
      title="Ver el resumen de productos del Alta"
    >
      Ver productos
    </button>
  `;
}

async function mostrarProductosAlta(idAlta) {
  const alta = altasCargadas.find(item => Number(item.ID_ALTA ?? item.idAlta) === Number(idAlta));
  if (!alta) return;

  modalProductosAlta ||= new bootstrap.Modal(document.getElementById('modalProductosAlta'));
  setTexto('tituloProductosAlta', alta.CODIGO_ALTA || `Alta ${idAlta}`);
  setTexto('cantidadProductosAlta', '');
  document.getElementById('estadoProductosAlta').classList.remove('d-none');
  document.getElementById('estadoProductosAlta').textContent = 'Cargando productos...';
  document.getElementById('contenidoProductosAlta').classList.add('d-none');
  document.getElementById('tablaProductosAlta').innerHTML = '';
  modalProductosAlta.show();

  try {
    const response = await fetch(`/api/altas/${encodeURIComponent(idAlta)}`, {
      headers: {
        Accept: 'application/json',
        'x-id-empresa': String(obtenerEmpresaActivaAltas())
      }
    });
    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.mensaje || `Error HTTP ${response.status}.`);
    }

    const detalle = Array.isArray(data?.resultado?.detalle) ? data.resultado.detalle : [];
    const principales = detalle.filter(item =>
      item.GENERADO_AUTOMATICO === false ||
      item.GENERADO_AUTOMATICO === 0 ||
      String(item.GENERADO_AUTOMATICO || '').toLowerCase() === 'false'
    );
    const filas = principales.length ? principales : detalle;

    if (!filas.length) {
      document.getElementById('estadoProductosAlta').textContent = 'El Alta todavía no tiene productos.';
      return;
    }

    document.getElementById('tablaProductosAlta').innerHTML = filas.map(item => {
      const tipo = String(item.TIPO_PRODUCTO_DETALLE || alta.TIPO_PRODUCTO || '').trim().toUpperCase();
      const curvaTalle = tipo === 'MODULO'
        ? (item.DETALLE_MODULO || item.CODIGO_MODULO || '-')
        : (item.DETALLE_TALLE || item.CODIGO_TALLE || '-');
      const cantidad = tipo === 'MODULO'
        ? `${Number(item.PARES || 0).toLocaleString('es-AR')} pares`
        : '1 unidad';

      return `
        <tr>
          <td><strong>${escapar(item.DETALLE_MODELO || item.CODIGO_MODELO || '-')}</strong><div class="altas-secondary-text">${escapar(item.CODIGO_MODELO || '')}</div></td>
          <td>${escapar(item.DETALLE_COLOR || item.CODIGO_COLOR || '-')}</td>
          <td>${escapar(curvaTalle)}</td>
          <td>${escapar(tipo.replaceAll('_', ' ') || '-')}</td>
          <td>${escapar(item.DETALLE_CLASIFICACION || item.CODIGO_CLASIFICACION || '-')}</td>
          <td><strong>${escapar(cantidad)}</strong></td>
        </tr>
      `;
    }).join('');

    document.getElementById('estadoProductosAlta').classList.add('d-none');
    document.getElementById('contenidoProductosAlta').classList.remove('d-none');
    setTexto(
      'cantidadProductosAlta',
      `${filas.length} combinación${filas.length === 1 ? '' : 'es'} principal${filas.length === 1 ? '' : 'es'} · ${detalle.length} registro${detalle.length === 1 ? '' : 's'} total${detalle.length === 1 ? '' : 'es'}`
    );
  } catch (error) {
    document.getElementById('estadoProductosAlta').textContent = error.message;
  }
}

function mostrarMensajeGuardado() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const id =
    params.get('retorno');

  if (!id) {
    return;
  }

  const productos =
    params.get('productos');

  mostrarAlerta(
    productos !== null
      ? (
          `Volviste desde el Alta ID ${id}. ` +
          `${productos} producto(s) permanecen en el lote y podés retomarlo cuando quieras.`
        )
      : (
          `Volviste desde el Alta ID ${id}. Los cambios agregados quedaron guardados automáticamente.`
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
