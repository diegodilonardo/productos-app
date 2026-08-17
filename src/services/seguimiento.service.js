const seguimientoRepository =
    require('../repositories/seguimiento.repository');


function normalizarEstado(valor) {

    if (
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ''
    ) {
        return null;
    }

    return String(valor)
        .trim()
        .toUpperCase();
}


function validarId(valor) {

    const id = Number(valor);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        throw new Error(
            'ID_ALTA inválido.'
        );
    }

    return id;
}


async function obtenerResumen() {

    const resultado =
        await seguimientoRepository
            .obtenerResumen();

    return {
        altas: {
            total:
                Number(resultado.altas.TOTAL_ALTAS || 0),
            borrador:
                Number(resultado.altas.BORRADOR || 0),
            validado:
                Number(resultado.altas.VALIDADO || 0),
            exportado:
                Number(resultado.altas.EXPORTADO || 0),
            parcialErp:
                Number(resultado.altas.PARCIAL_ERP || 0),
            generadoOkEnErp:
                Number(
                    resultado.altas.GENERADO_OK_EN_ERP || 0
                ),
            anulado:
                Number(resultado.altas.ANULADO || 0),
        },

        erp: {
            totalExportados:
                Number(
                    resultado.erp.TOTAL_EXPORTADOS || 0
                ),
            pendientes:
                Number(
                    resultado.erp.PENDIENTES_ERP || 0
                ),
            confirmados:
                Number(
                    resultado.erp.CONFIRMADOS_ERP || 0
                ),
            errores:
                Number(
                    resultado.erp.ERROR_ERP || 0
                ),
        },
    };
}


async function listarAltas(estadoEntrada) {

    const estado =
        normalizarEstado(
            estadoEntrada
        );

    const estadosPermitidos = [
        'BORRADOR',
        'VALIDADO',
        'EXPORTADO',
        'PARCIAL_ERP',
        'GENERADO_OK_EN_ERP',
        'ANULADO',
    ];

    if (
        estado &&
        !estadosPermitidos.includes(estado)
    ) {
        throw new Error(
            `Estado inválido. Valores permitidos: ${estadosPermitidos.join(', ')}.`
        );
    }

    const registros =
        await seguimientoRepository
            .listarAltasSeguimiento(
                estado
            );

    return registros.map((fila) => {

        const total =
            Number(
                fila.CANTIDAD_EXPORTADOS || 0
            );

        const confirmados =
            Number(
                fila.CANTIDAD_CONFIRMADOS_ERP || 0
            );

        const pendientes =
            Number(
                fila.CANTIDAD_PENDIENTES_ERP || 0
            );

        const errores =
            Number(
                fila.CANTIDAD_ERROR_ERP || 0
            );

        const porcentajeConfirmado =
            total > 0
                ? Number(
                    (
                        confirmados /
                        total *
                        100
                    ).toFixed(2)
                )
                : 0;

        return {
            ...fila,

            seguimientoErp: {
                total,
                confirmados,
                pendientes,
                errores,
                porcentajeConfirmado,
            },
        };
    });
}


async function obtenerAlta(idEntrada) {

    const id =
        validarId(
            idEntrada
        );

    const resultado =
        await seguimientoRepository
            .obtenerSeguimientoAlta(
                id
            );

    if (!resultado) {
        throw new Error(
            'Alta no encontrada.'
        );
    }

    const total =
        Number(
            resultado.resumenErp.TOTAL || 0
        );

    const confirmados =
        Number(
            resultado.resumenErp.CONFIRMADOS || 0
        );

    const pendientes =
        Number(
            resultado.resumenErp.PENDIENTES || 0
        );

    const errores =
        Number(
            resultado.resumenErp.ERRORES || 0
        );

    return {
        alta:
            resultado.alta,

        seguimientoErp: {
            total,
            confirmados,
            pendientes,
            errores,

            porcentajeConfirmado:
                total > 0
                    ? Number(
                        (
                            confirmados /
                            total *
                            100
                        ).toFixed(2)
                    )
                    : 0,
        },

        productos:
            resultado.productos,
    };
}


module.exports = {
    obtenerResumen,
    listarAltas,
    obtenerAlta,
};
