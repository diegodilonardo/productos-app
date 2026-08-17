const API_RESUMEN =
    '/api/seguimiento/resumen';

const API_ALTAS =
    '/api/seguimiento/altas';


document.addEventListener(
    'DOMContentLoaded',
    () => {

        const btnActualizar =
            document.getElementById(
                'btnActualizar'
            );

        btnActualizar.addEventListener(
            'click',
            cargarDashboard
        );

        cargarDashboard();
    }
);


async function cargarDashboard() {

    ocultarError();

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
            fetch(API_RESUMEN),
            fetch(API_ALTAS),
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

        pintarAltas(
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

        btnActualizar.disabled = false;
        btnActualizar.textContent =
            'Actualizar';
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

    if (
        !Array.isArray(altas) ||
        altas.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
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
                    ${porcentaje}%
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
