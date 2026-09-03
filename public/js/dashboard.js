const API_RESUMEN =
    '/api/seguimiento/resumen';

const API_ALTAS =
    '/api/seguimiento/altas';

const API_PEDIDOS =
    '/api/pedidos';

let ID_EMPRESA_DASHBOARD = null;
let vistaAltasDashboard = sessionStorage.getItem('dashboard.altas.vista') === 'lista' ? 'lista' : 'tarjetas';
let vistaPedidosDashboard = sessionStorage.getItem('dashboard.pedidos.vista') === 'lista' ? 'lista' : 'tarjetas';
let altasDashboard = [];
let pedidosDashboard = [];


document.addEventListener(
    'DOMContentLoaded',
    async () => {

        window.addEventListener(
            'app:empresa-cambiada',
            actualizarEmpresaDashboard
        );

        const btnActualizar =
            document.getElementById(
                'btnActualizar'
            );

        btnActualizar.addEventListener(
            'click',
            cargarDashboard
        );

        document.getElementById('btnVistaTarjetasDashboard')?.addEventListener('click', () => aplicarVistaAltasDashboard('tarjetas'));
        document.getElementById('btnVistaListaDashboard')?.addEventListener('click', () => aplicarVistaAltasDashboard('lista'));
        aplicarVistaAltasDashboard(vistaAltasDashboard);
        document.getElementById('btnVistaTarjetasPedidosDashboard')?.addEventListener('click', () => aplicarVistaPedidosDashboard('tarjetas'));
        document.getElementById('btnVistaListaPedidosDashboard')?.addEventListener('click', () => aplicarVistaPedidosDashboard('lista'));
        aplicarVistaPedidosDashboard(vistaPedidosDashboard);
        document.getElementById('mostrarAnuladasAltasDashboard')?.addEventListener('change', pintarAltasDashboardFiltradas);
        document.getElementById('mostrarAnuladosPedidosDashboard')?.addEventListener('change', pintarPedidosDashboardFiltrados);

        try {
            ID_EMPRESA_DASHBOARD =
                await resolverEmpresaActiva();

            await cargarDashboard();

        } catch (error) {
            mostrarError(
                error.message
            );
        }
    }
);


function actualizarEmpresaDashboard(event) {
    event.preventDefault();

    ID_EMPRESA_DASHBOARD =
        Number(
            event.detail?.idEmpresa
        ) || null;

    altasDashboard = [];
    pedidosDashboard = [];

    cargarDashboard();
}


async function resolverEmpresaActiva() {
    const auth =
        await fetch('/api/auth/me');

    let data = null;

    try {
        data =
            await auth.json();
    } catch {}

    if (
        !auth.ok ||
        !data?.autenticado ||
        !data?.usuario
    ) {
        throw new Error(
            'Debe iniciar sesión.'
        );
    }

    const empresas =
        Array.isArray(
            data.usuario.empresas
        )
            ? data.usuario.empresas
            : [];

    if (empresas.length === 1) {
        const id =
            Number(
                empresas[0].idEmpresa
            );

        sessionStorage.setItem(
            'app.idEmpresa',
            String(id)
        );

        return id;
    }

    const guardada =
        Number(
            sessionStorage.getItem(
                'app.idEmpresa'
            )
        );

    if (
        empresas.some(
            item =>
                Number(
                    item.idEmpresa
                ) ===
                guardada
        )
    ) {
        return guardada;
    }

    throw new Error(
        'Debe seleccionar una empresa desde la barra superior.'
    );
}


function fetchEmpresa(
    url,
    opciones = {}
) {
    if (!ID_EMPRESA_DASHBOARD) {
        throw new Error(
            'Debe seleccionar una empresa.'
        );
    }

    return fetch(
        url,
        {
            ...opciones,
            headers: {
                ...(opciones.headers || {}),
                'x-id-empresa':
                    String(
                        ID_EMPRESA_DASHBOARD
                    )
            }
        }
    );
}


async function cargarDashboard() {

    ocultarError();
    pintarCargaDashboard();

    const btnActualizar =
        document.getElementById(
            'btnActualizar'
        );

    btnActualizar.disabled = true;
    btnActualizar.textContent =
        'Actualizando...';

    try {

        const [
            resumenResponse,
            altasResponse,
        ] = await Promise.all([
            fetchEmpresa(API_RESUMEN),
            fetchEmpresa(API_ALTAS),
        ]);

        if (!resumenResponse.ok) {
            throw new Error(
                'No se pudo obtener el resumen.'
            );
        }

        if (!altasResponse.ok) {
            throw new Error(
                'No se pudo obtener el listado de altas.'
            );
        }

        const resumenJson =
            await resumenResponse.json();

        const altasJson =
            await altasResponse.json();

        if (!resumenJson.ok) {
            throw new Error(
                resumenJson.mensaje ||
                'Error consultando resumen.'
            );
        }

        if (!altasJson.ok) {
            throw new Error(
                altasJson.mensaje ||
                'Error consultando altas.'
            );
        }

        pintarResumen(
            resumenJson.resultado
        );

        altasDashboard = Array.isArray(altasJson.resultado) ? altasJson.resultado : [];
        pintarAltasDashboardFiltradas();

        await cargarPedidosDashboard(
            altasJson.resultado
        );

        document.getElementById(
            'ultimaActualizacion'
        ).textContent =
            `Actualizado: ${new Date().toLocaleTimeString()}`;

    } catch (error) {

        mostrarError(
            error.message
        );

    } finally {

        document
            .getElementById(
                'dashboardPrincipal'
            )
            ?.removeAttribute(
                'aria-busy'
            );

        btnActualizar.disabled = false;
        btnActualizar.textContent =
            'Actualizar';
    }
}


function pintarCargaDashboard() {
    document
        .getElementById(
            'dashboardPrincipal'
        )
        ?.setAttribute(
            'aria-busy',
            'true'
        );

    for (const id of [
        'totalAltas',
        'altasOk',
        'productosPendientes',
        'productosConfirmados',
        'pedidosTotal',
        'pedidosBorrador',
        'pedidosValidado',
        'pedidosAnulado'
    ]) {
        const elemento =
            document.getElementById(id);

        if (elemento) {
            elemento.textContent = '—';
        }
    }

    const pedidosRecientes =
        document.getElementById(
            'pedidosRecientes'
        );

    if (pedidosRecientes) {
        pedidosRecientes.innerHTML =
            '<div class="dashboard-loading-state dashboard-pedidos-loading">Actualizando pedidos</div>';
    }

    const tablaAltas =
        document.getElementById(
            'tablaAltas'
        );

    if (tablaAltas) {
        tablaAltas.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <span class="dashboard-loading-state">Actualizando altas</span>
                </td>
            </tr>
        `;
    }
}


function pintarResumen(resultado) {

    document.getElementById(
        'totalAltas'
    ).textContent =
        resultado.altas.total;

    document.getElementById(
        'altasOk'
    ).textContent =
        resultado.altas.generadoOkEnErp;

    document.getElementById(
        'productosPendientes'
    ).textContent =
        resultado.erp.pendientes;

    document.getElementById(
        'productosConfirmados'
    ).textContent =
        resultado.erp.confirmados;
}


function pintarAltas(altas) {

    const tbody =
        document.getElementById(
            'tablaAltas'
        );

    tbody.innerHTML = '';
    pintarTarjetasAltasDashboard(altas);

    if (
        !Array.isArray(altas) ||
        altas.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    class="text-center py-5 text-secondary"
                >
                    No existen altas registradas.
                </td>
            </tr>
        `;

        return;
    }


    for (const alta of altas) {

        const seguimiento =
            alta.seguimientoErp || {};

        const total =
            Number(
                seguimiento.total || 0
            );

        const confirmados =
            Number(
                seguimiento.confirmados || 0
            );

        const porcentaje =
            Number(
                seguimiento.porcentajeConfirmado || 0
            );

        const estadoAlta =
            String(
                alta.ESTADO || ''
            ).trim().toUpperCase();

        const porcentajeTexto =
            estadoAlta === 'SIN_NOVEDADES_ERP'
                ? '-'
                : `${porcentaje}%`;

        const tr =
            document.createElement('tr');

        tr.innerHTML = `
            <td>
                <div class="fw-semibold">
                    ${escaparHtml(alta.CODIGO_ALTA)}
                </div>

                <div class="small text-secondary">
                    ID ${alta.ID_ALTA}
                </div>
            </td>

            <td>
                ${escaparHtml(
                    alta.DETALLE_MARCA ||
                    alta.CODIGO_MARCA
                )}
            </td>

            <td>
                ${escaparHtml(
                    alta.DETALLE_RUBRO ||
                    alta.CODIGO_RUBRO
                )}
            </td>

            <td>
                ${formatearAnoTemporada(alta)}
            </td>

            <td>
                ${badgeLicencia(
                    alta.LICENCIA_ALTA
                )}
            </td>

            <td>
                ${escaparHtml(
                    alta.TIPO_PRODUCTO
                )}
            </td>

            <td>
                ${badgeEstado(
                    alta.ESTADO
                )}
            </td>

            <td class="text-center">
                ${confirmados}/${total}
            </td>

            <td class="text-center">
                <span class="fw-semibold">
                    ${porcentajeTexto}
                </span>
            </td>

            <td>
                ${
                    alta.ARCHIVO_EXPORTADO
                        ? escaparHtml(
                            alta.ARCHIVO_EXPORTADO
                          )
                        : '<span class="text-secondary">-</span>'
                }
            </td>
        `;

        tbody.appendChild(tr);
    }
}

function pintarAltasDashboardFiltradas() {
    const mostrarAnuladas = document.getElementById('mostrarAnuladasAltasDashboard')?.checked === true;
    pintarAltas(altasDashboard.filter(alta =>
        mostrarAnuladas || String(alta.ESTADO || '').trim().toUpperCase() !== 'ANULADO'
    ));
}

function aplicarVistaAltasDashboard(vista) {
    vistaAltasDashboard = vista === 'lista' ? 'lista' : 'tarjetas';
    sessionStorage.setItem('dashboard.altas.vista', vistaAltasDashboard);
    const tarjetas = vistaAltasDashboard === 'tarjetas';
    document.getElementById('tarjetasAltasDashboard')?.classList.toggle('d-none', !tarjetas);
    document.getElementById('listaAltasDashboard')?.classList.toggle('d-none', tarjetas);
    const btnTarjetas = document.getElementById('btnVistaTarjetasDashboard');
    const btnLista = document.getElementById('btnVistaListaDashboard');
    btnTarjetas?.classList.toggle('is-active', tarjetas);
    btnLista?.classList.toggle('is-active', !tarjetas);
    btnTarjetas?.setAttribute('aria-pressed', String(tarjetas));
    btnLista?.setAttribute('aria-pressed', String(!tarjetas));
}

function pintarTarjetasAltasDashboard(altas) {
    const contenedor = document.getElementById('tarjetasAltasDashboard');
    if (!contenedor) return;
    if (!Array.isArray(altas) || !altas.length) {
        contenedor.innerHTML = '<div class="dashboard-altas-message">No existen altas registradas.</div>';
        return;
    }
    contenedor.innerHTML = altas.map(alta => {
        const seguimiento = alta.seguimientoErp || {};
        const total = Number(seguimiento.total || 0);
        const confirmados = Number(seguimiento.confirmados || 0);
        const porcentaje = Math.max(0, Math.min(100, Number(seguimiento.porcentajeConfirmado || 0)));
        const estado = String(alta.ESTADO || '').trim().toUpperCase();
        const porcentajeTexto = estado === 'SIN_NOVEDADES_ERP' ? '-' : `${porcentaje}%`;
        return `<article class="dashboard-alta-card dashboard-alta-${estado.toLowerCase().replaceAll('_','-')}">
          <div class="dashboard-alta-top"><div class="dashboard-alta-title"><strong>${escaparHtml(alta.CODIGO_ALTA || '-')}</strong><small>ID ${escaparHtml(alta.ID_ALTA)}</small></div>${badgeEstado(estado)}</div>
          <div class="dashboard-alta-brand"><strong>${escaparHtml(alta.DETALLE_MARCA || alta.CODIGO_MARCA || '-')}</strong><span>${escaparHtml(alta.DETALLE_RUBRO || alta.CODIGO_RUBRO || '-')}</span></div>
          <div class="dashboard-alta-meta"><div><span>Campaña</span>${formatearAnoTemporada(alta)}</div><div><span>Tipo</span><strong>${escaparHtml(alta.TIPO_PRODUCTO || '-')}</strong></div><div><span>Licencia</span>${badgeLicencia(alta.LICENCIA_ALTA)}</div><div><span>ERP</span><strong>${confirmados}/${total} · ${porcentajeTexto}</strong></div></div>
          <div class="progress dashboard-alta-progress"><div class="progress-bar" style="width:${porcentaje}%"></div></div>
          <div class="dashboard-alta-file" title="${escaparHtml(alta.ARCHIVO_EXPORTADO || '-')}">${escaparHtml(alta.ARCHIVO_EXPORTADO || 'Sin archivo informado')}</div>
          <div class="dashboard-alta-footer"><span>Seguimiento ERP</span><a class="btn btn-sm btn-outline-primary" href="/seguimiento/${encodeURIComponent(alta.ID_ALTA)}">Ver</a></div>
        </article>`;
    }).join('');
}


async function cargarPedidosDashboard(altasEmpresa) {

    const contenedor =
        document.getElementById(
            'pedidosRecientes'
        );

    try {
        const response =
            await fetchEmpresa(
                API_PEDIDOS
            );

        let data = null;

        try {
            data = await response.json();
        } catch {}

        if (
            !response.ok ||
            data?.ok === false
        ) {
            throw new Error(
                data?.mensaje ||
                'No se pudieron obtener los pedidos.'
            );
        }

        const idsAltasEmpresa =
            new Set(
                (Array.isArray(altasEmpresa)
                    ? altasEmpresa
                    : []
                ).map(
                    alta => Number(alta.ID_ALTA)
                )
            );

        const altasPorId = new Map(
            (Array.isArray(altasEmpresa) ? altasEmpresa : [])
                .map(alta => [Number(alta.ID_ALTA), alta])
        );

        const pedidos =
            (Array.isArray(data?.datos)
                ? data.datos
                : []
            ).filter(
                pedido =>
                    idsAltasEmpresa.has(
                        Number(pedido.ID_ALTA)
                    )
            )
            .map(pedido => {
                const alta = altasPorId.get(Number(pedido.ID_ALTA)) || {};
                return {
                    ...pedido,
                    DETALLE_RUBRO_ALTA: alta.DETALLE_RUBRO || alta.CODIGO_RUBRO || '-',
                    CODIGO_ANO_ALTA: alta.CODIGO_ANO || alta.DETALLE_ANO || alta.DETALLE_AÑO || alta.ANO || alta.AÑO || '-',
                    DETALLE_TEMPORADA_ALTA: alta.DETALLE_TEMPORADA || alta.CODIGO_TEMPORADA || '-'
                };
            });

        pintarResumenPedidos(
            pedidos
        );

        pedidosDashboard = pedidos;
        pintarPedidosDashboardFiltrados();

    } catch (error) {
        pedidosDashboard = [];
        pintarResumenPedidos([]);

        if (contenedor) {
            contenedor.innerHTML = `
                <div class="text-center py-5 text-danger dashboard-pedidos-loading">
                    ${escaparHtml(error.message)}
                </div>
            `;
        }

        const listaPedidos = document.getElementById('pedidosRecientesLista');
        if (listaPedidos) {
            listaPedidos.innerHTML = `<div class="dashboard-pedidos-list-message text-danger">${escaparHtml(error.message)}</div>`;
        }
    }
}


function pintarResumenPedidos(pedidos) {

    const lista =
        Array.isArray(pedidos)
            ? pedidos
            : [];

    const estado = pedido =>
        String(
            pedido?.ESTADO || ''
        ).trim().toUpperCase();

    const borradores =
        lista.filter(
            pedido => estado(pedido) === 'BORRADOR'
        );

    const validados =
        lista.filter(
            pedido => estado(pedido) === 'VALIDADO'
        );

    const anulados =
        lista.filter(
            pedido => estado(pedido) === 'ANULADO'
        );

    setTextoDashboard(
        'pedidosTotal',
        lista.length
    );

    setTextoDashboard(
        'pedidosBorrador',
        borradores.length
    );

    setTextoDashboard(
        'pedidosValidado',
        validados.length
    );

    setTextoDashboard(
        'pedidosAnulado',
        anulados.length
    );

    const importeValidado =
        document.getElementById(
            'pedidosValidadoImporte'
        );

    if (importeValidado) {
        if (!validados.length) {
            importeValidado.textContent = '';
        } else {
            const monedas =
                new Set(
                    validados.map(
                        pedido =>
                            String(
                                pedido.MONEDA || 'USD'
                            ).trim().toUpperCase()
                    )
                );

            if (monedas.size === 1) {
                const moneda =
                    [...monedas][0];

                const total =
                    validados.reduce(
                        (acum, pedido) =>
                            acum +
                            Number(
                                pedido.TOTAL_PEDIDO || 0
                            ),
                        0
                    );

                importeValidado.textContent =
                    `${moneda} ${formatearImporteDashboard(total)}`;
            } else {
                importeValidado.textContent =
                    'Varias monedas';
            }
        }
    }
}


function pintarPedidosRecientes(pedidos) {

    const contenedor =
        document.getElementById(
            'pedidosRecientes'
        );

    if (!contenedor) {
        return;
    }

    const lista =
        [...(
            Array.isArray(pedidos)
                ? pedidos
                : []
        )]
            .sort(
                (a, b) =>
                    fechaPedidoDashboard(b) -
                    fechaPedidoDashboard(a)
            )
            .slice(0, 6);

    pintarListaPedidosDashboard(lista);

    if (!lista.length) {
        contenedor.innerHTML = `
            <div class="text-center py-5 text-secondary dashboard-pedidos-loading">
                No existen pedidos registrados.
            </div>
        `;
        return;
    }

    contenedor.innerHTML =
        lista.map(
            pedido => {
                const id =
                    Number(pedido.ID_PEDIDO || 0);

                const estado =
                    String(
                        pedido.ESTADO || '-'
                    ).trim().toUpperCase();

                return `
                    <article class="dashboard-pedido-card dashboard-pedido-${estado.toLowerCase().replaceAll('_','-')}">
                        <div class="dashboard-pedido-top">
                            <div class="dashboard-pedido-title">
                                <strong class="dashboard-pedido-code">
                                    ${escaparHtml(pedido.CODIGO_PEDIDO || `Pedido ${id}`)}
                                </strong>
                                <small>Alta ${escaparHtml(pedido.CODIGO_ALTA || '-')}</small>
                            </div>
                            ${badgeEstadoPedidoDashboard(estado)}
                        </div>

                        <div class="dashboard-pedido-provider">
                            <strong>${escaparHtml(pedido.DETALLE_PROVEEDOR || pedido.CODIGO_PROVEEDOR || '-')}</strong>
                            <span>${escaparHtml(pedido.CODIGO_PROVEEDOR || '')} · Orden ${escaparHtml(pedido.NUMERO_ORDEN || '-')} · ID ${id}</span>
                        </div>

                        <div class="dashboard-pedido-stats">
                            <div class="dashboard-pedido-stat">
                                <span>Rubro</span>
                                <strong>${escaparHtml(pedido.DETALLE_RUBRO_ALTA || '-')}</strong>
                            </div>
                            <div class="dashboard-pedido-stat">
                                <span>Año / Temporada</span>
                                <strong>${escaparHtml(pedido.CODIGO_ANO_ALTA || '-')} · ${escaparHtml(pedido.DETALLE_TEMPORADA_ALTA || '-')}</strong>
                            </div>
                            <div class="dashboard-pedido-stat">
                                <span>Productos</span>
                                <strong>${Number(pedido.CANTIDAD_PRODUCTOS || 0)}</strong>
                            </div>
                            <div class="dashboard-pedido-stat dashboard-pedido-stat-emphasis">
                                <span>Pares</span>
                                <strong>${Number(pedido.TOTAL_PARES || 0)}</strong>
                            </div>
                            <div class="dashboard-pedido-stat dashboard-pedido-stat-emphasis">
                                <span>Total</span>
                                <strong>
                                    ${escaparHtml(pedido.MONEDA || 'USD')}
                                    ${formatearImporteDashboard(pedido.TOTAL_PEDIDO || 0)}
                                </strong>
                            </div>
                            <div class="dashboard-pedido-stat">
                                <span>Exportación</span>
                                ${badgeExportacionPedidoDashboard(pedido)}
                            </div>
                        </div>

                        ${estado === 'ANULADO' && pedido.MOTIVO_ANULACION ? `<div class="dashboard-pedido-cancel">${escaparHtml(pedido.MOTIVO_ANULACION)}</div>` : ''}

                        <div class="dashboard-pedido-footer">
                            <span>
                                Creado ${escaparHtml(formatearFechaPedidoDashboard(pedido.FECHA_CREACION))}
                            </span>
                            <a
                                href="/pedidos/${id}"
                                class="btn btn-sm btn-outline-primary"
                            >
                                Ver pedido
                            </a>
                        </div>
                    </article>
                `;
            }
        ).join('');
}

function pintarPedidosDashboardFiltrados() {
    const mostrarAnulados = document.getElementById('mostrarAnuladosPedidosDashboard')?.checked === true;
    pintarPedidosRecientes(pedidosDashboard.filter(pedido =>
        mostrarAnulados || String(pedido.ESTADO || '').trim().toUpperCase() !== 'ANULADO'
    ));
}

function aplicarVistaPedidosDashboard(vista) {
    vistaPedidosDashboard = vista === 'lista' ? 'lista' : 'tarjetas';
    sessionStorage.setItem('dashboard.pedidos.vista', vistaPedidosDashboard);
    const tarjetas = vistaPedidosDashboard === 'tarjetas';
    document.getElementById('pedidosRecientes')?.classList.toggle('d-none', !tarjetas);
    document.getElementById('pedidosRecientesLista')?.classList.toggle('d-none', tarjetas);
    const btnTarjetas = document.getElementById('btnVistaTarjetasPedidosDashboard');
    const btnLista = document.getElementById('btnVistaListaPedidosDashboard');
    btnTarjetas?.classList.toggle('is-active', tarjetas);
    btnLista?.classList.toggle('is-active', !tarjetas);
    btnTarjetas?.setAttribute('aria-pressed', String(tarjetas));
    btnLista?.setAttribute('aria-pressed', String(!tarjetas));
}

function pintarListaPedidosDashboard(lista) {
    const contenedor = document.getElementById('pedidosRecientesLista');
    if (!contenedor) return;
    if (!lista.length) {
        contenedor.innerHTML = '<div class="dashboard-pedidos-list-message">No existen pedidos registrados.</div>';
        return;
    }
    contenedor.innerHTML = lista.map(pedido => {
        const id = Number(pedido.ID_PEDIDO || 0);
        const estado = String(pedido.ESTADO || '-').trim().toUpperCase();
        return `<div class="dashboard-pedido-list-row">
          <div class="dashboard-pedido-list-main"><strong>${escaparHtml(pedido.CODIGO_PEDIDO || `Pedido ${id}`)}</strong><span>${escaparHtml(pedido.CODIGO_ALTA || '-')} · ${escaparHtml(pedido.DETALLE_PROVEEDOR || pedido.CODIGO_PROVEEDOR || '-')}</span></div>
          <div class="dashboard-pedido-list-cell"><span>Fecha</span><strong>${escaparHtml(formatearFechaPedidoDashboard(pedido.FECHA_CREACION))}</strong></div>
          <div class="dashboard-pedido-list-cell"><span>Productos</span><strong>${Number(pedido.CANTIDAD_PRODUCTOS || 0)}</strong></div>
          <div class="dashboard-pedido-list-cell"><span>Pares</span><strong>${Number(pedido.TOTAL_PARES || 0)}</strong></div>
          <div class="dashboard-pedido-list-cell"><span>Total</span><strong>${escaparHtml(pedido.MONEDA || 'USD')} ${formatearImporteDashboard(pedido.TOTAL_PEDIDO || 0)}</strong></div>
          <div class="dashboard-pedido-list-actions">${badgeEstadoPedidoDashboard(estado)}<a href="/pedidos/${id}" class="btn btn-sm btn-outline-primary">Ver</a></div>
        </div>`;
    }).join('');
}


function badgeEstadoPedidoDashboard(estado) {

    const clases = {
        BORRADOR: 'text-bg-secondary',
        VALIDADO: 'text-bg-success',
        SINCRONIZADO: 'text-bg-primary',
        ANULADO: 'text-bg-danger',
    };

    return `
        <span class="badge ${clases[estado] || 'text-bg-secondary'}">
            ${escaparHtml(estado || '-')}
        </span>
    `;
}

function badgeExportacionPedidoDashboard(pedido) {
    const estado = String(pedido?.ESTADO_EXPORTACION || 'NO_EXPORTADO').trim().toUpperCase();
    const clases = estado === 'COMPLETO'
        ? 'text-bg-success'
        : estado === 'PARCIAL'
            ? 'text-bg-warning'
            : 'text-bg-secondary';
    const texto = estado === 'NO_EXPORTADO' ? 'NO EXPORTADO' : estado;
    const cantidad = Number(pedido?.CANTIDAD_EXPORTACIONES || 0);
    return `<span class="badge ${clases}">${escaparHtml(texto)}</span>${cantidad > 0 ? `<small class="dashboard-pedido-exports">${cantidad} salida${cantidad === 1 ? '' : 's'}</small>` : ''}`;
}


function fechaPedidoDashboard(pedido) {
    const valor =
        pedido?.FECHA_CREACION ||
        pedido?.FECHA_ACTUALIZACION;

    const fecha =
        valor
            ? new Date(valor)
            : new Date(0);

    return Number.isNaN(fecha.getTime())
        ? 0
        : fecha.getTime();
}


function formatearFechaPedidoDashboard(valor) {
    if (!valor) return '-';

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return String(valor);
    }

    return fecha.toLocaleString(
        'es-AR',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
    );
}


function formatearImporteDashboard(valor) {
    return Number(valor || 0).toLocaleString(
        'es-AR',
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    );
}


function setTextoDashboard(id, valor) {
    const elemento =
        document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}


function formatearAnoTemporada(alta) {

    const ano =
        alta.DETALLE_ANO ??
        alta.DETALLE_AÑO ??
        alta.ANO ??
        alta.AÑO ??
        alta.CODIGO_ANO ??
        alta.CODIGO_AÑO ??
        '-';

    const codigoTemporada =
        alta.CODIGO_TEMPORADA ??
        alta.CODIGO_TEM ??
        alta.COD_TEM ??
        '';

    const detalleTemporada =
        alta.DETALLE_TEMPORADA ??
        alta.DETALLE_TEM ??
        alta.DCOD_TEM ??
        alta.TEMPORADA ??
        '';

    let temporada = '-';

    if (detalleTemporada && codigoTemporada) {
        temporada =
            `${codigoTemporada} - ${detalleTemporada}`;
    } else if (detalleTemporada) {
        temporada =
            detalleTemporada;
    } else if (codigoTemporada) {
        temporada =
            codigoTemporada;
    }

    return `
        <div class="d-flex flex-wrap gap-1">
            <span class="badge text-bg-light border">
                ${escaparHtml(ano)}
            </span>
            <span class="badge text-bg-light border">
                ${escaparHtml(temporada)}
            </span>
        </div>
    `;
}


function badgeLicencia(licencia) {

    const valor =
        String(
            licencia || 'SIN DEFINIR'
        ).trim();

    const clase =
        valor.toUpperCase() === 'SIN LICENCIA'
            ? 'text-bg-secondary'
            : 'text-bg-light border text-dark';

    return `
        <span class="badge ${clase}">
            ${escaparHtml(valor)}
        </span>
    `;
}


function badgeEstado(estado) {

    const valor =
        String(
            estado || ''
        ).toUpperCase();

    const clases = {
        BORRADOR:
            'text-bg-secondary',

        VALIDADO:
            'text-bg-primary',

        EXPORTADO:
            'text-bg-warning',

        PARCIAL_ERP:
            'text-bg-info',

        GENERADO_OK_EN_ERP:
            'text-bg-success',

        SIN_NOVEDADES_ERP:
            'text-bg-info',

        ANULADO:
            'text-bg-dark',
    };

    const clase =
        clases[valor] ||
        'text-bg-secondary';

    return `
        <span class="badge ${clase}">
            ${escaparHtml(valor)}
        </span>
    `;
}


function escaparHtml(valor) {

    return String(
        valor ?? ''
    )
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}


function mostrarError(mensaje) {

    const alerta =
        document.getElementById(
            'alertaError'
        );

    alerta.textContent =
        mensaje;

    alerta.classList.remove(
        'd-none'
    );
}


function ocultarError() {

    const alerta =
        document.getElementById(
            'alertaError'
        );

    alerta.textContent = '';

    alerta.classList.add(
        'd-none'
    );
}
