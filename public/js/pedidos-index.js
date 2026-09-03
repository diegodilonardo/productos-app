document.addEventListener('DOMContentLoaded', iniciarPedidos);
let pedidos = [];
let contextoUsuario = null;
let idEmpresaPedido = null;
let accesoEmpresaPedido = null;
let vistaPedidos = sessionStorage.getItem('pedidos.vista') === 'tabla' ? 'tabla' : 'tarjetas';

async function iniciarPedidos() {
  window.addEventListener(
    'app:empresa-cambiada',
    actualizarEmpresaPedidos
  );

  document.getElementById('btnActualizarPedidos')?.addEventListener('click', cargarPedidos);
  document.getElementById('buscarPedido')?.addEventListener('input', pintarPedidosFiltrados);
  document.getElementById('filtroEstadoPedido')?.addEventListener('change', pintarPedidosFiltrados);
  document.getElementById('filtroExportacionPedido')?.addEventListener('change', pintarPedidosFiltrados);
  document.getElementById('mostrarAnuladosPedido')?.addEventListener('change', cambiarVisibilidadAnuladosPedido);
  document.getElementById('selectorEmpresaPedido')?.addEventListener('change', cambiarEmpresaPedido);
  document.getElementById('btnVistaTarjetasPedidos')?.addEventListener('click', () => aplicarVistaPedidos('tarjetas'));
  document.getElementById('btnVistaTablaPedidos')?.addEventListener('click', () => aplicarVistaPedidos('tabla'));
  aplicarVistaPedidos(vistaPedidos);

  try {
    const listo = await cargarContextoPedido();
    if (listo) await cargarPedidos();
  } catch (e) {
    mostrarAlerta(e.message, 'danger');
  }
}

async function actualizarEmpresaPedidos(event) {
  event.preventDefault();

  idEmpresaPedido =
    Number(
      event.detail?.idEmpresa
    ) || null;

  accesoEmpresaPedido =
    (contextoUsuario?.empresas || []).find(
      item =>
        Number(item.idEmpresa) ===
        idEmpresaPedido
    ) || null;

  const selector =
    document.getElementById(
      'selectorEmpresaPedido'
    );

  if (selector) {
    selector.value =
      idEmpresaPedido
        ? String(idEmpresaPedido)
        : '';
  }

  if (!idEmpresaPedido) {
    return;
  }

  sessionStorage.setItem(
    'pedidos.idEmpresa',
    String(idEmpresaPedido)
  );

  pedidos = [];
  pintarMetricas();
  pintarPedidosFiltrados();
  actualizarPermisosVisuales();

  await cargarPedidos();
}

async function api(url, opciones) {
  const r = await fetch(url, opciones);
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok || d?.ok === false) throw new Error(d?.mensaje || `Error HTTP ${r.status}`);
  return d;
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
  const guardada = Number(sessionStorage.getItem('pedidos.idEmpresa'));
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
    pedidos = [];
    pintarMetricas();
    pintarPedidosFiltrados();
    mostrarAlerta('Seleccione una empresa para consultar Pedidos.', 'info');
    actualizarPermisosVisuales();
    return false;
  }

  accesoEmpresaPedido = empresas.find(x => Number(x.idEmpresa) === Number(idEmpresaPedido)) || null;
  sessionStorage.setItem('pedidos.idEmpresa', String(idEmpresaPedido));
  actualizarPermisosVisuales();
  return true;
}

async function cambiarEmpresaPedido() {
  const select = document.getElementById('selectorEmpresaPedido');
  idEmpresaPedido = Number(select?.value || 0) || null;

  if (!idEmpresaPedido) {
    sessionStorage.removeItem('pedidos.idEmpresa');
    accesoEmpresaPedido = null;
    pedidos = [];
    pintarMetricas();
    pintarPedidosFiltrados();
    actualizarPermisosVisuales();
    mostrarAlerta('Seleccione una empresa para consultar Pedidos.', 'info');
    return;
  }

  accesoEmpresaPedido =
    (contextoUsuario?.empresas || []).find(
      x => Number(x.idEmpresa) === Number(idEmpresaPedido)
    ) || null;

  sessionStorage.setItem('pedidos.idEmpresa', String(idEmpresaPedido));
  actualizarPermisosVisuales();
  await cargarPedidos();
}

function puedeEscribirPedido() {
  if (contextoUsuario?.superAdmin) return true;
  return ['SUPER_ADMIN','ADMIN','OPERADOR'].includes(
    String(accesoEmpresaPedido?.rol || '').trim().toUpperCase()
  );
}

function actualizarPermisosVisuales() {
  const botonNuevo = document.getElementById('btnNuevoPedido');
  if (botonNuevo) {
    botonNuevo.classList.toggle('d-none', !idEmpresaPedido || !puedeEscribirPedido());
  }

  const badge = document.getElementById('rolPedido');
  if (badge) {
    const rol = contextoUsuario?.superAdmin
      ? 'SUPER_ADMIN'
      : String(accesoEmpresaPedido?.rol || '').toUpperCase();

    badge.textContent = rol ? `Rol: ${rol}` : '';
    badge.classList.toggle('d-none', !rol);
  }
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

async function cargarPedidos() {
  ocultarAlerta();
  pintarCargaPedidos();
  const btn = document.getElementById('btnActualizarPedidos');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    const data = await api('/api/pedidos', opcionesEmpresa());
    pedidos = Array.isArray(data?.datos) ? data.datos : [];
    pintarMetricas();
    pintarPedidosFiltrados();
  } catch (e) { mostrarAlerta(e.message, 'danger'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Actualizar'; } }
}

function pintarCargaPedidos() {
  for (const id of [
    'metTotal',
    'metBorrador',
    'metValidado',
    'metAnulado'
  ]) {
    setTexto(id, '—');
  }

  const cantidad =
    document.getElementById(
      'cantidadPedidosVisible'
    );

  if (cantidad) {
    cantidad.textContent = '';
  }

  const tbody =
    document.getElementById(
      'tablaPedidos'
    );

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4">
          <span class="pedidos-loading-state">Actualizando pedidos</span>
        </td>
      </tr>
    `;
  }

  const tarjetas = document.getElementById('tarjetasPedidos');
  if (tarjetas) tarjetas.innerHTML = '<div class="pedidos-cards-loading">Actualizando pedidos</div>';
}

function pintarMetricas() {
  setTexto('metTotal', pedidos.length);
  setTexto('metBorrador', pedidos.filter(x => estado(x)==='BORRADOR').length);
  setTexto('metValidado', pedidos.filter(x => estado(x)==='VALIDADO').length);
  setTexto('metAnulado', pedidos.filter(x => estado(x)==='ANULADO').length);
}

function pintarPedidosFiltrados() {
  const q = (document.getElementById('buscarPedido')?.value || '').trim().toUpperCase();
  const e = document.getElementById('filtroEstadoPedido')?.value || '';
  const ex = document.getElementById('filtroExportacionPedido')?.value || '';
  const mostrarAnulados = document.getElementById('mostrarAnuladosPedido')?.checked === true;
  const lista = pedidos.filter(p => {
    const texto = [p.CODIGO_PEDIDO,p.CODIGO_ALTA,p.CODIGO_PROVEEDOR,p.DETALLE_PROVEEDOR,p.NUMERO_ORDEN,p.DETALLE_RUBRO,p.CODIGO_ANO,p.DETALLE_TEMPORADA].join(' ').toUpperCase();
    return (mostrarAnulados || estado(p) !== 'ANULADO') && (!q || texto.includes(q)) && (!e || estado(p)===e) && (!ex || estadoExportacion(p)===ex);
  });
  setTexto(
    'cantidadPedidosVisible',
    `${lista.length} de ${pedidos.length}`
  );
  pintarTarjetas(lista);
  pintarTabla(lista);
}

function cambiarVisibilidadAnuladosPedido(event) {
  const mostrar = event.currentTarget.checked;
  const filtro = document.getElementById('filtroEstadoPedido');
  const opcionAnulado = filtro?.querySelector('option[value="ANULADO"]');

  if (opcionAnulado) opcionAnulado.disabled = !mostrar;
  if (!mostrar && filtro?.value === 'ANULADO') filtro.value = '';

  pintarPedidosFiltrados();
}

function aplicarVistaPedidos(vista) {
  vistaPedidos = vista === 'tabla' ? 'tabla' : 'tarjetas';
  sessionStorage.setItem('pedidos.vista', vistaPedidos);
  const tarjetas = vistaPedidos === 'tarjetas';
  document.getElementById('tarjetasPedidos')?.classList.toggle('d-none', !tarjetas);
  document.getElementById('vistaTablaPedidos')?.classList.toggle('d-none', tarjetas);
  const btnTarjetas = document.getElementById('btnVistaTarjetasPedidos');
  const btnTabla = document.getElementById('btnVistaTablaPedidos');
  btnTarjetas?.classList.toggle('is-active', tarjetas);
  btnTabla?.classList.toggle('is-active', !tarjetas);
  btnTarjetas?.setAttribute('aria-pressed', String(tarjetas));
  btnTabla?.setAttribute('aria-pressed', String(!tarjetas));
}

function pintarTarjetas(lista) {
  const contenedor = document.getElementById('tarjetasPedidos');
  if (!contenedor) return;
  if (!lista.length) {
    contenedor.innerHTML = '<div class="pedidos-card-empty">No hay pedidos para mostrar.</div>';
    return;
  }
  contenedor.innerHTML = lista.map(p => {
    const est = estado(p);
    return `<article class="pedido-summary-card pedido-summary-${est.toLowerCase()}">
      <div class="pedido-summary-top"><div class="pedido-summary-title"><div class="pedido-code">${esc(p.CODIGO_PEDIDO || '-')}</div><div class="pedido-muted">Alta ${esc(p.CODIGO_ALTA || '-')}</div></div><span class="badge ${claseEstado(est)}">${esc(est)}</span></div>
      <div class="pedido-summary-provider"><strong>${esc(p.DETALLE_PROVEEDOR || '-')}</strong><span>${esc(p.CODIGO_PROVEEDOR || '')} · Orden ${esc(p.NUMERO_ORDEN || '-')}</span></div>
      <div class="pedido-summary-meta"><div><span>Rubro</span><strong>${esc(p.DETALLE_RUBRO || p.CODIGO_RUBRO || '-')}</strong></div><div><span>Año / Temporada</span><strong>${esc(p.CODIGO_ANO || '-')} · ${esc(p.DETALLE_TEMPORADA || p.CODIGO_TEMPORADA || '-')}</strong></div><div><span>Productos</span><strong>${num(p.CANTIDAD_PRODUCTOS)}</strong></div><div class="pedido-summary-emphasis"><span>Pares</span><strong>${num(p.TOTAL_PARES)}</strong></div><div class="pedido-summary-emphasis"><span>Total</span><strong>${esc(p.MONEDA || 'USD')} ${dinero(p.TOTAL_PEDIDO)}</strong></div><div><span>Exportación</span>${badgeExportacion(p)}</div></div>
      ${est === 'ANULADO' && p.MOTIVO_ANULACION ? `<div class="pedido-summary-cancel">${esc(p.MOTIVO_ANULACION)}</div>` : ''}
      <div class="pedido-summary-footer"><span>Creado ${fecha(p.FECHA_CREACION)}</span><a class="btn btn-sm btn-outline-primary" href="/pedidos/${encodeURIComponent(p.ID_PEDIDO)}">Ver pedido</a></div>
    </article>`;
  }).join('');
}

function pintarTabla(lista) {
  const tbody = document.getElementById('tablaPedidos');
  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-5 text-secondary">No hay pedidos para mostrar.</td></tr>';
    return;
  }
  for (const p of lista) {
    const tr = document.createElement('tr');
    if (estado(p)==='ANULADO') tr.classList.add('opacity-75');
    tr.innerHTML = `
      <td><div class="pedido-code">${esc(p.CODIGO_PEDIDO || '-')}</div><div class="pedido-muted">ID ${esc(p.ID_PEDIDO)}</div></td>
      <td>${esc(p.CODIGO_ALTA || '-')}</td>
      <td><div class="fw-semibold">${esc(p.DETALLE_PROVEEDOR || '-')}</div><div class="pedido-muted">${esc(p.CODIGO_PROVEEDOR || '')}</div></td>
      <td>${esc(p.NUMERO_ORDEN || '-')}</td>
      <td>${num(p.CANTIDAD_PRODUCTOS)}</td>
      <td>${num(p.TOTAL_PARES)}</td>
      <td>${esc(p.MONEDA || 'USD')} ${dinero(p.TOTAL_PEDIDO)}</td>
      <td><span class="badge ${claseEstado(estado(p))}">${esc(estado(p))}</span>${estado(p)==='ANULADO' && p.MOTIVO_ANULACION ? `<div class="pedido-muted mt-1" title="${esc(p.MOTIVO_ANULACION)}">${esc(p.MOTIVO_ANULACION)}</div>`:''}</td>
      <td>${badgeExportacion(p)}</td>
      <td>${fecha(p.FECHA_CREACION)}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="/pedidos/${encodeURIComponent(p.ID_PEDIDO)}">Ver</a></td>`;
    tbody.appendChild(tr);
  }
}

function estado(p){return String(p?.ESTADO||'').toUpperCase();}
function estadoExportacion(p){return String(p?.ESTADO_EXPORTACION||'NO_EXPORTADO').toUpperCase();}
function badgeExportacion(p){const e=estadoExportacion(p);const clase=e==='COMPLETO'?'text-bg-success':e==='PARCIAL'?'text-bg-warning':'text-bg-secondary';const texto=e==='NO_EXPORTADO'?'NO EXPORTADO':e;const cantidad=Number(p?.CANTIDAD_EXPORTACIONES||0);const detalle=cantidad>0?`<div class="pedido-muted mt-1">${num(cantidad)} salida${cantidad===1?'':'s'}</div>`:'';return `<span class="badge ${clase}">${esc(texto)}</span>${detalle}`;}
function claseEstado(e){return e==='BORRADOR'?'text-bg-secondary':e==='VALIDADO'?'text-bg-success':e==='SINCRONIZADO'?'text-bg-primary':e==='ANULADO'?'text-bg-danger':'text-bg-secondary';}
function num(v){return Number(v||0).toLocaleString('es-AR');}
function dinero(v){return Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:4});}
function fecha(v){if(!v)return '-'; return new Date(v).toLocaleDateString('es-AR');}
function setTexto(id,v){const e=document.getElementById(id); if(e)e.textContent=v;}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function mostrarAlerta(m,t){const e=document.getElementById('alertaPedidos');e.className=`alert alert-${t}`;e.textContent=m;}
function ocultarAlerta(){const e=document.getElementById('alertaPedidos');e.className='alert d-none';e.textContent='';}
