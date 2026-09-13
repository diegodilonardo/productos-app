document.addEventListener('DOMContentLoaded', iniciarReportePedidos);

let filasReportePedidos = [];
let idEmpresaReporte = null;
let tipoReporteActivo = 'resumen';

async function iniciarReportePedidos() {
  window.addEventListener('app:empresa-cambiada', async event => {
    idEmpresaReporte = Number(event.detail?.idEmpresa) || null;
    if (idEmpresaReporte) {
      sessionStorage.setItem('pedidos.idEmpresa', String(idEmpresaReporte));
      await cargarCatalogosReporte();
      await cargarReportePedidos(false);
    }
  });
  ['reporteEstado', 'reporteProveedor', 'reporteRubro', 'reporteTemporada', 'reporteAno'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => cargarReportePedidos(false));
  });
  document.getElementById('verReporteResumen').addEventListener('click', () => cambiarTipoReporte('resumen'));
  document.getElementById('verReporteDetalle').addEventListener('click', () => cambiarTipoReporte('detalle'));
  document.getElementById('exportarReporteExcel').addEventListener('click', exportarReporteExcel);
  const contexto = await apiReporte('/api/auth/me', false);
  const empresas = Array.isArray(contexto?.usuario?.empresas) ? contexto.usuario.empresas : [];
  const guardada = Number(sessionStorage.getItem('pedidos.idEmpresa'));
  idEmpresaReporte = empresas.some(e => Number(e.idEmpresa) === guardada)
    ? guardada
    : (empresas.length === 1 ? Number(empresas[0].idEmpresa) : null);
  if (!idEmpresaReporte) {
    mostrarAlertaReporte('Seleccione una empresa desde la barra superior.');
    return;
  }
  await cargarCatalogosReporte();
  await cargarReportePedidos(false);
}

async function apiReporte(url, incluirEmpresa = true) {
  const response = await fetch(url, { headers: incluirEmpresa && idEmpresaReporte ? { 'x-id-empresa': String(idEmpresaReporte) } : {} });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.mensaje || `Error HTTP ${response.status}`);
  return data;
}

function parametrosReporte() {
  const params = new URLSearchParams();
  params.set('estado', document.getElementById('reporteEstado').value);
  ['Proveedor', 'Rubro', 'Temporada', 'Ano'].forEach(nombre => {
    const valor = document.getElementById(`reporte${nombre}`).value;
    if (valor) params.set(nombre.toLowerCase(), valor);
  });
  return params;
}

async function cargarReportePedidos(inicial = false) {
  ocultarAlertaReporte();
  try {
    if (tipoReporteActivo === 'detalle') {
      await cargarReporteDetallePedidos();
      return;
    }
    const data = await apiReporte(`/api/pedidos/reportes/resumen?${parametrosReporte()}`);
    filasReportePedidos = Array.isArray(data?.datos) ? data.datos : [];
    if (inicial) completarFiltrosReporte(filasReportePedidos);
    renderizarReportePedidos();
  } catch (error) {
    mostrarAlertaReporte(error.message);
  }
}

async function cambiarTipoReporte(tipo) {
  tipoReporteActivo = tipo;
  const detalle = tipo === 'detalle';
  document.getElementById('panelReporteResumen').classList.toggle('d-none', detalle);
  document.getElementById('panelReporteDetalle').classList.toggle('d-none', !detalle);
  document.getElementById('verReporteResumen').className = `btn ${detalle ? 'btn-outline-primary' : 'btn-primary'}`;
  document.getElementById('verReporteDetalle').className = `btn ${detalle ? 'btn-primary' : 'btn-outline-primary'}`;
  await cargarReportePedidos(false);
}

async function cargarReporteDetallePedidos() {
  const tbody = document.getElementById('reporteDetalleTabla');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-secondary">Cargando detalle...</td></tr>';
  const data = await apiReporte(`/api/pedidos/reportes/detalle?${parametrosReporte()}`);
  const filas = Array.isArray(data?.datos) ? data.datos : [];
  tbody.innerHTML = filas.map(f => `<tr>
    <td><img class="pedido-img" src="${escReporte(f.URL_IMAGEN)}" alt="${escReporte(`${f.MODELO} ${f.COLOR}`)}" loading="lazy" onerror="this.style.display='none'"></td>
    <td><strong>${escReporte(f.PROVEEDOR)}</strong><div class="pedido-muted">${escReporte(f.ORDEN)}</div></td>
    <td><strong>${escReporte(f.MODELO)}</strong><div class="pedido-muted">${escReporte(f.CODIGO_MODELO || '')}</div></td>
    <td>${escReporte(f.COLOR)}</td><td>${escReporte(f.TALLE || '-')}</td>
    <td class="text-end">${escReporte(f.MONEDA)} ${dineroReporte(f.PRECIO_UNITARIO)}</td>
    <td class="text-end fw-semibold">${numeroReporte(f.CANTIDAD)}</td>
    <td class="text-end fw-semibold">${escReporte(f.MONEDA)} ${dineroReporte(f.PRECIO_POR_CANTIDAD)}</td>
  </tr>`).join('') || '<tr><td colspan="8" class="text-center py-5 text-secondary">No hay productos para los filtros seleccionados.</td></tr>';
  document.getElementById('reporteDetalleCantidad').textContent = `${filas.length} producto${filas.length === 1 ? '' : 's'}`;
}

async function cargarCatalogosReporte() {
  const data = await apiReporte('/api/pedidos/reportes/resumen?estado=AMBOS');
  completarFiltrosReporte(Array.isArray(data?.datos) ? data.datos : []);
}

function completarFiltrosReporte(filas) {
  completarSelectReporte('reporteProveedor', filas.map(f => ({ valor: f.CODIGO_PROVEEDOR || f.PROVEEDOR, texto: f.PROVEEDOR })), 'Todos');
  completarSelectReporte('reporteRubro', filas.map(f => ({ valor: f.CODIGO_RUBRO || f.RUBRO, texto: f.RUBRO })), 'Todos');
  completarSelectReporte('reporteTemporada', filas.map(f => ({ valor: f.CODIGO_TEMPORADA || f.TEMPORADA, texto: f.TEMPORADA })), 'Todas');
  completarSelectReporte('reporteAno', filas.map(f => ({ valor: f.ANO, texto: f.ANO })), 'Todos');
}

async function exportarReporteExcel() {
  const boton = document.getElementById('exportarReporteExcel');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Generando Excel...';
  ocultarAlertaReporte();
  try {
    const params = parametrosReporte();
    params.set('tipo', tipoReporteActivo);
    const response = await fetch(`/api/pedidos/reportes/exportar?${params}`, { headers: { 'x-id-empresa': String(idEmpresaReporte) } });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.mensaje || `Error HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const nombre = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'REPORTE_PEDIDOS.xlsx';
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    mostrarAlertaReporte(error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

function completarSelectReporte(id, opciones, todas) {
  const select = document.getElementById(id);
  const unicas = [...new Map(opciones.filter(o => o.valor).map(o => [String(o.valor), o])).values()];
  select.innerHTML = `<option value="">${todas}</option>` + unicas.sort((a,b) => String(a.texto).localeCompare(String(b.texto), 'es', { numeric:true })).map(o => `<option value="${escReporte(o.valor)}">${escReporte(o.texto)}</option>`).join('');
}

function renderizarReportePedidos() {
  const tbody = document.getElementById('reportePedidosTabla');
  tbody.innerHTML = filasReportePedidos.map(f => `<tr><td><strong>${escReporte(f.PROVEEDOR)}</strong><div class="pedido-muted">${escReporte(f.CODIGO_PROVEEDOR || '')}</div></td><td><strong>${escReporte(f.ORDEN)}</strong><div class="pedido-muted">${escReporte(f.CODIGO_PEDIDO || '')}</div></td><td>${escReporte(f.RUBRO)}</td><td>${escReporte(f.TEMPORADA)} / ${escReporte(f.ANO)}</td><td><span class="badge ${f.ESTADO === 'VALIDADO' ? 'text-bg-success' : 'text-bg-secondary'}">${escReporte(f.ESTADO)}</span></td><td class="text-end fw-semibold">${numeroReporte(f.CANTIDAD_PARES)}</td><td class="text-end fw-semibold">${escReporte(f.MONEDA)} ${dineroReporte(f.CANTIDAD_DINERO)}</td></tr>`).join('') || '<tr><td colspan="7" class="text-center py-5 text-secondary">No hay pedidos para los filtros seleccionados.</td></tr>';
  document.getElementById('reporteCantidad').textContent = `${filasReportePedidos.length} orden${filasReportePedidos.length === 1 ? '' : 'es'}`;
  document.getElementById('reporteTotalOrdenes').textContent = numeroReporte(filasReportePedidos.length);
  document.getElementById('reporteTotalPares').textContent = numeroReporte(filasReportePedidos.reduce((s,f) => s + Number(f.CANTIDAD_PARES || 0), 0));
  const monedas = new Map();
  filasReportePedidos.forEach(f => monedas.set(f.MONEDA, (monedas.get(f.MONEDA) || 0) + Number(f.CANTIDAD_DINERO || 0)));
  document.getElementById('reporteTotalDinero').innerHTML = [...monedas].map(([m,v]) => `<div>${escReporte(m)} ${dineroReporte(v)}</div>`).join('') || '-';
}

function numeroReporte(v) { return Number(v || 0).toLocaleString('es-AR'); }
function dineroReporte(v) { return Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escReporte(v) { const d=document.createElement('div'); d.textContent=String(v ?? ''); return d.innerHTML; }
function mostrarAlertaReporte(mensaje) { const el=document.getElementById('alertaReportePedidos'); el.className='alert alert-danger'; el.textContent=mensaje; }
function ocultarAlertaReporte() { const el=document.getElementById('alertaReportePedidos'); el.className='alert d-none'; el.textContent=''; }
