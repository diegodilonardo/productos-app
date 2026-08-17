const pagina = document.getElementById('paginaProductosAlta');
const ID_ALTA = Number(pagina.dataset.idAlta);
let altaActual = null;
let colores = [];

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  try {
    await cargarAlta();
    configurarTipoProducto();
    await cargarMaestros();
    configurarEventos();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  }
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
}

function pintarCabecera() {
  document.getElementById('infoIdAlta').textContent = altaActual.ID_ALTA ?? ID_ALTA;
  document.getElementById('codigoAltaCabecera').textContent = altaActual.CODIGO_ALTA ?? '-';
  document.getElementById('estadoAltaCabecera').textContent = altaActual.ESTADO ?? '-';
  document.getElementById('infoMarca').textContent = altaActual.DETALLE_MARCA ?? altaActual.CODIGO_MARCA ?? '-';
  document.getElementById('infoRubro').textContent = altaActual.DETALLE_RUBRO ?? altaActual.CODIGO_RUBRO ?? '-';
  document.getElementById('infoTipo').textContent = altaActual.TIPO_PRODUCTO ?? '-';
  document.getElementById('infoAno').textContent = altaActual.CODIGO_ANO ?? '-';
  document.getElementById('infoTemporada').textContent = altaActual.DETALLE_TEMPORADA ?? altaActual.CODIGO_TEMPORADA ?? '-';
  document.getElementById('estadoLote').textContent = altaActual.ESTADO ?? '-';
}

function normalizarTipo(valor) {
  return String(valor || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/-+/g, '_');
}

function configurarTipoProducto() {
  const tipo = normalizarTipo(altaActual.TIPO_PRODUCTO);
  const clas = document.getElementById('contenedorClasificacion');
  const mod = document.getElementById('contenedorModulo');
  const talle = document.getElementById('contenedorTalle');

  if (tipo === 'MODULO') {
    clas.classList.remove('d-none');
    mod.classList.remove('d-none');
    talle.classList.add('d-none');
    document.getElementById('codigoClasificacion').required = true;
    document.getElementById('codigoModulo').required = true;
    document.getElementById('codigoTalle').required = false;
  } else {
    clas.classList.add('d-none');
    mod.classList.add('d-none');
    talle.classList.remove('d-none');
    document.getElementById('codigoClasificacion').required = false;
    document.getElementById('codigoModulo').required = false;
    document.getElementById('codigoTalle').required = true;
  }
}

async function cargarMaestros() {
  const marca = encodeURIComponent(altaActual.CODIGO_MARCA || '');
  const rubro = encodeURIComponent(altaActual.CODIGO_RUBRO || '');
  const detalleMarca = encodeURIComponent(altaActual.DETALLE_MARCA || '');
  const detalleRubro = encodeURIComponent(altaActual.DETALLE_RUBRO || '');

  const [
    modelos, grupos, subgrupos, lineas, deportes,
    listaColores, edades, sexos, paises, clasificaciones
  ] = await Promise.all([
    obtenerListado([
      `/api/maestros/modelos?marca=${detalleMarca}&rubro=${detalleRubro}`,
      `/api/maestros/modelos?codigoMarca=${marca}&codigoRubro=${rubro}`,
      `/api/maestros/modelos?marca=${marca}&rubro=${rubro}`
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

  cargarSelect('codigoModelo', modelos, ['CODIGO_MODELO','codigoModelo'], ['DETALLE_MODELO','detalleModelo'], 'Seleccionar modelo...', fila => {
    const codigo = obtenerCampo(fila, ['CODIGO_MODELO','codigoModelo']);
    const detalle = obtenerCampo(fila, ['DETALLE_MODELO','detalleModelo']);
    const licencia = obtenerCampo(fila, ['LICENCIA','licencia']);
    return [codigo, detalle, licencia].filter(Boolean).join(' - ');
  });

  cargarSelectBasico('codigoGrupo', grupos, 'CODIGO_GRUPO', 'DETALLE_GRUPO', 'Seleccionar grupo...');
  cargarSelectBasico('codigoSubgrupo', subgrupos, 'CODIGO_SUBGRUPO', 'DETALLE_SUBGRUPO', 'Seleccionar subgrupo...');
  cargarSelectBasico('codigoLinea', lineas, 'CODIGO_LINEA', 'DETALLE_LINEA', 'Seleccionar línea...');
  cargarSelectBasico('codigoDeporte', deportes, 'CODIGO_DEPORTE', 'DETALLE_DEPORTE', 'Seleccionar deporte...');
  cargarSelectBasico('codigoEdad', edades, 'CODIGO_EDAD', 'DETALLE_EDAD', 'Seleccionar edad...');
  cargarSexo(sexos);
  cargarSelectBasico('codigoPais', paises, 'CODIGO_PAIS', 'DETALLE_PAIS', 'Seleccionar país...');
  cargarClasificaciones(clasificaciones);

  colores = listaColores;
  pintarColores(colores);

  if (normalizarTipo(altaActual.TIPO_PRODUCTO) === 'MODULO') {
    const modulos = await obtenerListado([
      '/api/maestros/talles-modulos',
      '/api/maestros/talles_modulos',
      '/api/maestros/modulos'
    ]);
    cargarSelect('codigoModulo', modulos, ['CODIGO_MODULO','codigoModulo'], ['DETALLE_MODULO','detalleModulo'], 'Seleccionar curva...', formatearModulo);
  } else {
    const talles = await obtenerListado(['/api/maestros/talles']);
    cargarSelect('codigoTalle', talles, ['DETALLE_TALLE','CODIGO_TALLE','codigoTalle'], ['DETALLE_TALLE','detalleTalle'], 'Seleccionar talle...');
  }
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
  const select = document.getElementById('sexo');
  select.innerHTML = '<option value="">Seleccionar sexo...</option>';
  for (const fila of lista) {
    const valorSexo = obtenerCampo(fila, ['SEXO','sexo']);
    if (!valorSexo) continue;
    const option = document.createElement('option');
    option.value = String(valorSexo);
    option.textContent = String(valorSexo);
    select.appendChild(option);
  }
}

function cargarClasificaciones(lista) {
  const permitidas = normalizarTipo(altaActual.TIPO_PRODUCTO) === 'MODULO'
    ? ['0','3','4','5','6','7','8','9']
    : ['1'];

  const filtradas = lista.filter(fila => {
    const codigo = String(obtenerCampo(fila, ['CODIGO_CLASIFICACION','codigoClasificacion']) ?? '');
    return permitidas.includes(codigo);
  });

  cargarSelect('codigoClasificacion', filtradas,
    ['CODIGO_CLASIFICACION','codigoClasificacion'],
    ['DETALLE_CLASIFICACION','detalleClasificacion'],
    'Seleccionar clasificación...');
}

function formatearModulo(fila) {
  const codigo = obtenerCampo(fila, ['CODIGO_MODULO','codigoModulo']);
  const detalle = obtenerCampo(fila, ['DETALLE_MODULO','detalleModulo']);
  const pares = obtenerCampo(fila, ['PARES','pares']);
  return [codigo, detalle, pares ? `${pares} pares` : null].filter(Boolean).join(' - ');
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
    input.addEventListener('change', actualizarCantidadColores);

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = detalle ? `${codigo} - ${detalle}` : String(codigo);

    div.append(input, label);
    contenedor.appendChild(div);
  }
}

function actualizarCantidadColores() {
  const cantidad = document.querySelectorAll('.color-check:checked').length;
  document.getElementById('cantidadColores').textContent = `${cantidad} seleccionado${cantidad === 1 ? '' : 's'}`;
}

function filtrarColores() {
  const texto = document.getElementById('buscarColor').value.trim().toUpperCase();
  document.querySelectorAll('.app-color-item').forEach(item => {
    item.classList.toggle('d-none', Boolean(texto) && !item.dataset.texto.includes(texto));
  });
}

function configurarEventos() {
  document.getElementById('formProducto').addEventListener('submit', agregarProducto);
  document.getElementById('buscarColor').addEventListener('input', filtrarColores);
  document.getElementById('btnActualizarAlta').addEventListener('click', cargarAlta);
  document.getElementById('btnGuardarBorrador').addEventListener('click', guardarBorrador);
  document.getElementById('btnValidarAlta').addEventListener('click', validarAlta);
  document.getElementById('btnPreviewAlta').addEventListener('click', mostrarPreview);
  document.getElementById('btnExportarAlta').addEventListener('click', exportarAlta);

  document
    .getElementById('tablaProductosAlta')
    .addEventListener('click', manejarAccionesDetalle);
}

async function agregarProducto(event) {
  event.preventDefault();
  ocultarAlerta();

  const form = event.currentTarget;
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
    codigoGrupo: valor('codigoGrupo'),
    codigoSubgrupo: valor('codigoSubgrupo'),
    codigoLinea: valor('codigoLinea'),
    codigoDeporte: valor('codigoDeporte'),
    codigoEdad: valor('codigoEdad'),
    sexo: valor('sexo'),
    codigoPais: valor('codigoPais'),
    codigosColor,
    usuario: valor('usuarioProducto').toUpperCase()
  };

  if (normalizarTipo(altaActual.TIPO_PRODUCTO) === 'MODULO') {
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

    const cantidad = resultado?.cantidad ?? resultado?.cantidadGenerados ?? resultado?.productos?.length ?? null;
    mostrarAlerta(cantidad !== null
      ? `Producto agregado correctamente. Se generaron ${cantidad} registros.`
      : 'Producto agregado correctamente.', 'success');

    document.querySelectorAll('.color-check').forEach(item => item.checked = false);
    actualizarCantidadColores();
    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Agregar producto';
  }
}

function pintarDetalle() {
  const detalle = Array.isArray(altaActual.detalle)
    ? altaActual.detalle
    : (Array.isArray(altaActual.DETALLE) ? altaActual.DETALLE : []);

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
      '<tr><td colspan="9" class="text-center py-4 text-secondary">Todavía no hay productos en esta alta.</td></tr>';
    return;
  }

  const puedeEditar = estadoAlta() === 'BORRADOR';

  for (const fila of detalle) {
    const generadoAutomatico = esValorVerdadero(fila.GENERADO_AUTOMATICO);
    const idDetalle = fila.ID_DETALLE ?? fila.idDetalle;
    const tipoDetalle = String(
      fila.TIPO_PRODUCTO_DETALLE ??
      fila.TIPO_PRODUCTO ??
      ''
    ).toUpperCase();

    /*
      Solamente se elimina desde el producto principal.
      El backend se encarga de borrar la familia completa:
      - MODULO -> módulo + PRIMERAS + SEGUNDAS automáticas
      - PAR_SUELTO manual -> PRIMERA + SEGUNDA automática
    */
    const puedeEliminar =
      puedeEditar &&
      !generadoAutomatico &&
      idDetalle;

    let accion = '<span class="text-secondary">-</span>';

    if (puedeEliminar) {
      const texto =
        tipoDetalle === 'MODULO'
          ? 'Eliminar familia'
          : 'Eliminar';

      accion = `
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

    const estadoValidacion =
      String(fila.ESTADO_VALIDACION || 'VALIDO').toUpperCase();

    const badgeEstado =
      estadoValidacion === 'EXISTE_ERP'
        ? '<span class="badge text-bg-warning">YA EXISTE EN PRESEA</span>'
        : '<span class="badge text-bg-success">NUEVO</span>';

    const tr = document.createElement('tr');

    if (estadoValidacion === 'EXISTE_ERP') {
      tr.classList.add('table-warning');
      tr.title = fila.OBSERVACION_VALIDACION || 'Ya existe en Presea';
    }

    tr.innerHTML = `
      <td class="font-monospace">${escapar(fila.CODIGO_ALFA ?? fila.COD_ALFA ?? '-')}</td>
      <td>${escapar(fila.DETALLE_PRODUCTO ?? fila.DETALLE ?? '-')}</td>
      <td>${escapar(fila.TIPO_PRODUCTO_DETALLE ?? fila.TIPO_PRODUCTO ?? '-')}</td>
      <td>${escapar(fila.DETALLE_CLASIFICACION ?? fila.CODIGO_CLASIFICACION ?? '-')}</td>
      <td>${escapar(fila.DETALLE_COLOR ?? fila.CODIGO_COLOR ?? '-')}</td>
      <td>${escapar(fila.DETALLE_MODULO ?? fila.DETALLE_TALLE ?? fila.CODIGO_MODULO ?? fila.CODIGO_TALLE ?? '-')}</td>
      <td>${generadoAutomatico ? '<span class="badge text-bg-info">Sí</span>' : '<span class="badge text-bg-secondary">No</span>'}</td>
      <td>${badgeEstado}</td>
      <td class="text-end text-nowrap">${accion}</td>`;

    tbody.appendChild(tr);
  }
}

function esValorVerdadero(valor) {
  return (
    valor === true ||
    valor === 1 ||
    String(valor).trim().toLowerCase() === 'true'
  );
}

async function manejarAccionesDetalle(event) {
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

function mostrarAlerta(mensaje, tipo) {
  const alerta = document.getElementById('alertaProductos');
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = mensaje;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ocultarAlerta() {
  const alerta = document.getElementById('alertaProductos');
  alerta.className = 'alert d-none';
  alerta.textContent = '';
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
  const btnValidar = document.getElementById('btnValidarAlta');
  const btnPreview = document.getElementById('btnPreviewAlta');
  const btnExportar = document.getElementById('btnExportarAlta');
  const btnSeguimiento = document.getElementById('btnSeguimientoAlta');
  const panelForm = document.getElementById('formProducto');
  const mensajeEstado = document.getElementById('mensajeEstadoAlta');
  const archivo = document.getElementById('archivoExportadoAlta');

  const esBorrador = estado === 'BORRADOR';
  const esValidado = estado === 'VALIDADO';
  const esExportado = ['EXPORTADO', 'PARCIAL_ERP', 'GENERADO_OK_EN_ERP'].includes(estado);

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
      !['EXPORTADO', 'PARCIAL_ERP', 'GENERADO_OK_EN_ERP'].includes(estado)
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
    } else if (esExportado) {
      mensajeEstado.className = 'alert alert-primary mb-3';
      mensajeEstado.textContent =
        'Alta exportada. El lote ya no admite modificaciones.';
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
    case 'ANULADO': return 'text-bg-danger';
    default: return 'text-bg-secondary';
  }
}

function usuarioOperacion() {
  const valorUsuario =
    document.getElementById('usuarioProducto')?.value?.trim().toUpperCase();

  return valorUsuario || altaActual?.USUARIO_CREACION || 'SISTEMA';
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

  const aceptar = window.confirm(
    `Productos del lote: ${cantidad}\n` +
    `Ya existen en Presea: ${cantidadExistentesERP}\n` +
    `Nuevos / a exportar: ${cantidadAExportar}\n\n` +
    'Después de validar ya no podrás agregar ni quitar productos de este lote.\n\n' +
    '¿Continuar?'
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

    mostrarAlerta(
      `Alta validada correctamente. ` +
      `${cantidadValidada} productos en el lote: ` +
      `${exportables} nuevos para exportar y ` +
      `${existentes} ya existentes en Presea.`,
      'success'
    );

    await cargarAlta();

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.textContent = 'Validar Alta';
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

    const modal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById('modalPreviewExportacion')
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

  const registros = Array.isArray(preview?.registros)
    ? preview.registros
    : [];

  const tbody = document.getElementById('tablaPreviewExportacion');
  tbody.innerHTML = '';

  if (!registros.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-secondary py-4">Sin registros.</td></tr>';
    return;
  }

  const limite = Math.min(registros.length, 100);

  for (let i = 0; i < limite; i++) {
    const r = registros[i];

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${escapar(r.COD_ALFA ?? '')}</td>
      <td>${escapar(r.DETALLE ?? '')}</td>
      <td>${escapar(r.NIVEL ?? '')}</td>
      <td>${escapar(r.CLASIFIC ?? '')}</td>
      <td>${escapar(r.COLORC ?? '')}</td>
      <td>${escapar(r.TALLC ?? '')}</td>
      <td>${escapar(r.PARES ?? '')}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('previewAvisoLimite').textContent =
    registros.length > limite
      ? `Mostrando los primeros ${limite} de ${registros.length} registros.`
      : `Mostrando ${registros.length} registros.`;
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
    `Se generará el archivo DBI con ${cantidad} registros.\n\n` +
    'Esta operación cambiará el estado del alta a EXPORTADO.\n\n' +
    '¿Generar archivo para Presea?'
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

    document.getElementById('resultadoArchivo').textContent = archivo;
    document.getElementById('resultadoRuta').textContent = resultado?.ruta ?? '-';
    document.getElementById('resultadoRegistros').textContent = cant;
    document.getElementById('panelResultadoExportacion').classList.remove('d-none');

    mostrarAlerta(
      `Exportación correcta: ${archivo} (${cant} registros).`,
      'success'
    );

    await cargarAlta();

    document.getElementById('panelResultadoExportacion')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (error) {
    mostrarAlerta(error.message, 'danger');
  } finally {
    btn.textContent = 'Exportar DBI';
    actualizarControlesEstado();
  }
}
