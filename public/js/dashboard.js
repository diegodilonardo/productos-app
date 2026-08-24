const API_RESUMEN = '/api/seguimiento/resumen';
const API_ALTAS = '/api/seguimiento/altas';
const API_PEDIDOS = '/api/pedidos';

document.addEventListener('DOMContentLoaded', () => {
    const btnActualizar = document.getElementById('btnActualizar');
    btnActualizar?.addEventListener('click', cargarDashboard);
    cargarDashboard();
});

async function cargarDashboard() {
    ocultarError();
    const btnActualizar = document.getElementById('btnActualizar');

    if (btnActualizar) {
        btnActualizar.disabled = true;
        btnActualizar.textContent = 'Actualizando...';
    }

    try {
        const [resumenResponse, altasResponse, pedidosResponse] = await Promise.all([
            fetch(API_RESUMEN),
            fetch(API_ALTAS),
            fetch(API_PEDIDOS),
        ]);

        if (!resumenResponse.ok) throw new Error('No se pudo obtener el resumen.');
        if (!altasResponse.ok) throw new Error('No se pudo obtener el listado de altas.');
        if (!pedidosResponse.ok) throw new Error('No se pudo obtener el resumen de pedidos.');

        const [resumenJson, altasJson, pedidosJson] = await Promise.all([
            resumenResponse.json(),
            altasResponse.json(),
            pedidosResponse.json(),
        ]);

        if (!resumenJson.ok) throw new Error(resumenJson.mensaje || 'Error consultando resumen.');
        if (!altasJson.ok) throw new Error(altasJson.mensaje || 'Error consultando altas.');
        if (!pedidosJson.ok) throw new Error(pedidosJson.mensaje || 'Error consultando pedidos.');

        pintarResumen(resumenJson.resultado);
        pintarAltas(altasJson.resultado);

        const pedidos = Array.isArray(pedidosJson.datos) ? pedidosJson.datos : [];
        pintarResumenPedidos(pedidos);
        pintarPedidosRecientes(pedidos);

        const ultima = document.getElementById('ultimaActualizacion');
        if (ultima) ultima.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        mostrarError(error.message);
    } finally {
        if (btnActualizar) {
            btnActualizar.disabled = false;
            btnActualizar.textContent = 'Actualizar';
        }
    }
}

function pintarResumen(resultado) {
    setTexto('totalAltas', resultado?.altas?.total ?? 0);
    setTexto('altasOk', resultado?.altas?.generadoOkEnErp ?? 0);
    setTexto('productosPendientes', resultado?.erp?.pendientes ?? 0);
    setTexto('productosConfirmados', resultado?.erp?.confirmados ?? 0);
}

function pintarResumenPedidos(pedidos) {
    const total = pedidos.length;
    const borradores = pedidos.filter(p => estadoPedido(p) === 'BORRADOR').length;
    const validados = pedidos.filter(p => estadoPedido(p) === 'VALIDADO');
    const anulados = pedidos.filter(p => estadoPedido(p) === 'ANULADO').length;

    setTexto('pedidosTotal', total);
    setTexto('pedidosBorrador', borradores);
    setTexto('pedidosValidado', validados.length);
    setTexto('pedidosAnulado', anulados);

    const porMoneda = new Map();
    for (const p of validados) {
        const moneda = String(p.MONEDA || 'USD').trim().toUpperCase();
        porMoneda.set(moneda, (porMoneda.get(moneda) || 0) + Number(p.TOTAL_PEDIDO || 0));
    }

    const resumenImporte = [...porMoneda.entries()]
        .map(([moneda, totalMoneda]) => `${escaparHtml(moneda)} ${formatearDinero(totalMoneda)}`)
        .join(' · ');

    const importe = document.getElementById('pedidosValidadoImporte');
    if (importe) importe.innerHTML = resumenImporte || '&nbsp;';
}

function pintarPedidosRecientes(pedidos) {
    const contenedor = document.getElementById('pedidosRecientes');
    if (!contenedor) return;

    const recientes = [...pedidos]
        .sort((a, b) => Number(b.ID_PEDIDO || 0) - Number(a.ID_PEDIDO || 0))
        .slice(0, 5);

    if (!recientes.length) {
        contenedor.innerHTML = '<div class="text-center py-5 text-secondary">No existen pedidos registrados.</div>';
        return;
    }

    contenedor.innerHTML = recientes.map(p => {
        const estado = estadoPedido(p);
        const clase = claseEstadoPedido(estado);
        const total = `${escaparHtml(p.MONEDA || 'USD')} ${formatearDinero(p.TOTAL_PEDIDO)}`;

        return `
            <div class="dashboard-pedido-card ${estado === 'ANULADO' ? 'opacity-75' : ''}">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div class="min-w-0 flex-grow-1">
                        <div class="dashboard-pedido-code" title="${escaparHtml(p.CODIGO_PEDIDO || '')}">
                            ${escaparHtml(p.CODIGO_PEDIDO || `Pedido ${p.ID_PEDIDO || ''}`)}
                        </div>
                        <div class="dashboard-pedido-sub">
                            ${escaparHtml(p.DETALLE_PROVEEDOR || p.CODIGO_PROVEEDOR || '-')}
                            · Orden ${escaparHtml(p.NUMERO_ORDEN || '-')}
                        </div>
                    </div>
                    <span class="badge ${clase}">${escaparHtml(estado || '-')}</span>
                </div>

                <div class="dashboard-pedido-stats">
                    <div class="dashboard-pedido-stat"><span>Productos</span><strong>${formatearNumero(p.CANTIDAD_PRODUCTOS)}</strong></div>
                    <div class="dashboard-pedido-stat"><span>Pares</span><strong>${formatearNumero(p.TOTAL_PARES)}</strong></div>
                    <div class="dashboard-pedido-stat"><span>Total</span><strong>${total}</strong></div>
                </div>

                <div class="dashboard-pedido-footer">
                    <span class="small text-secondary">${formatearFecha(p.FECHA_CREACION)}</span>
                    <a href="/pedidos/${encodeURIComponent(p.ID_PEDIDO)}" class="btn btn-sm btn-outline-primary">Ver</a>
                </div>
            </div>`;
    }).join('');
}

function pintarAltas(altas) {
    const tbody = document.getElementById('tablaAltas');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(altas) || altas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-secondary">No existen altas registradas.</td></tr>';
        return;
    }

    for (const alta of altas) {
        const seguimiento = alta.seguimientoErp || {};
        const total = Number(seguimiento.total || 0);
        const confirmados = Number(seguimiento.confirmados || 0);
        const porcentaje = Number(seguimiento.porcentajeConfirmado || 0);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><div class="fw-semibold">${escaparHtml(alta.CODIGO_ALTA)}</div><div class="small text-secondary">ID ${escaparHtml(alta.ID_ALTA)}</div></td>
            <td>${escaparHtml(alta.DETALLE_MARCA || alta.CODIGO_MARCA)}</td>
            <td>${escaparHtml(alta.DETALLE_RUBRO || alta.CODIGO_RUBRO)}</td>
            <td>${formatearAnoTemporada(alta)}</td>
            <td>${badgeLicencia(alta.LICENCIA_ALTA)}</td>
            <td>${escaparHtml(alta.TIPO_PRODUCTO)}</td>
            <td>${badgeEstado(alta.ESTADO)}</td>
            <td class="text-center">${confirmados}/${total}</td>
            <td class="text-center"><span class="fw-semibold">${porcentaje}%</span></td>
            <td>${alta.ARCHIVO_EXPORTADO ? escaparHtml(alta.ARCHIVO_EXPORTADO) : '<span class="text-secondary">-</span>'}</td>`;

        tbody.appendChild(tr);
    }
}

function formatearAnoTemporada(alta) {
    const ano = alta.DETALLE_ANO ?? alta.DETALLE_AÑO ?? alta.ANO ?? alta.AÑO ?? alta.CODIGO_ANO ?? alta.CODIGO_AÑO ?? '-';
    const codigoTemporada = alta.CODIGO_TEMPORADA ?? alta.CODIGO_TEM ?? alta.COD_TEM ?? '';
    const detalleTemporada = alta.DETALLE_TEMPORADA ?? alta.DETALLE_TEM ?? alta.DCOD_TEM ?? alta.TEMPORADA ?? '';
    let temporada = '-';

    if (detalleTemporada && codigoTemporada) temporada = `${codigoTemporada} - ${detalleTemporada}`;
    else if (detalleTemporada) temporada = detalleTemporada;
    else if (codigoTemporada) temporada = codigoTemporada;

    return `<div class="d-flex flex-wrap gap-1"><span class="badge text-bg-light border">${escaparHtml(ano)}</span><span class="badge text-bg-light border">${escaparHtml(temporada)}</span></div>`;
}

function badgeLicencia(licencia) {
    const valor = String(licencia || 'SIN DEFINIR').trim();
    const clase = valor.toUpperCase() === 'SIN LICENCIA' ? 'text-bg-secondary' : 'text-bg-light border text-dark';
    return `<span class="badge ${clase}">${escaparHtml(valor)}</span>`;
}

function badgeEstado(estado) {
    const valor = String(estado || '').toUpperCase();
    const clases = {
        BORRADOR: 'text-bg-secondary',
        VALIDADO: 'text-bg-primary',
        EXPORTADO: 'text-bg-warning',
        PARCIAL_ERP: 'text-bg-info',
        GENERADO_OK_EN_ERP: 'text-bg-success',
        ANULADO: 'text-bg-dark',
    };
    return `<span class="badge ${clases[valor] || 'text-bg-secondary'}">${escaparHtml(valor)}</span>`;
}

function estadoPedido(pedido) {
    return String(pedido?.ESTADO || '').trim().toUpperCase();
}

function claseEstadoPedido(estado) {
    if (estado === 'VALIDADO') return 'text-bg-success';
    if (estado === 'ANULADO') return 'text-bg-danger';
    if (estado === 'BORRADOR') return 'text-bg-secondary';
    return 'text-bg-secondary';
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-AR');
}

function formatearDinero(valor) {
    return Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearFecha(valor) {
    if (!valor) return '-';
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toLocaleDateString('es-AR');
}

function setTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor ?? '-';
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function mostrarError(mensaje) {
    const alerta = document.getElementById('alertaError');
    if (!alerta) return;
    alerta.textContent = mensaje;
    alerta.classList.remove('d-none');
}

function ocultarError() {
    const alerta = document.getElementById('alertaError');
    if (!alerta) return;
    alerta.textContent = '';
    alerta.classList.add('d-none');
}
