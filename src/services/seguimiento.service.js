const seguimientoRepository =
    require('../repositories/seguimiento.repository');


function normalizarTexto(valor) {
    return String(valor ?? '')
        .trim()
        .toUpperCase();
}


function normalizarEstado(valor) {
    const estado = normalizarTexto(valor);
    return estado || null;
}


function normalizarLicencia(valor) {
    const licencia = normalizarTexto(valor);

    if (
        !licencia ||
        licencia === '__SIN_LICENCIA__' ||
        licencia === 'SIN LICENCIA'
    ) {
        return 'SIN LICENCIA';
    }

    return licencia;
}


function validarId(valor) {
    const id = Number(valor);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error('ID_ALTA inválido.');
    }

    return id;
}


function extraerValoresScope(items, claves = []) {
    if (!Array.isArray(items)) {
        return [];
    }

    const valores = [];

    for (const item of items) {
        if (item === null || item === undefined) {
            continue;
        }

        if (typeof item !== 'object') {
            const valor = normalizarTexto(item);
            if (valor) valores.push(valor);
            continue;
        }

        for (const clave of claves) {
            if (item[clave] !== undefined && item[clave] !== null) {
                const valor = normalizarTexto(item[clave]);
                if (valor) valores.push(valor);
            }
        }
    }

    return [...new Set(valores)];
}


function scopeIncluye(valorCodigo, valorDetalle, permitidos) {
    if (!permitidos.length) {
        return false;
    }

    const candidatos = [
        normalizarTexto(valorCodigo),
        normalizarTexto(valorDetalle),
    ].filter(Boolean);

    return candidatos.some(valor => permitidos.includes(valor));
}


function altaPermitidaPorAcceso(alta, acceso) {
    if (!acceso) {
        return false;
    }

    if (acceso.todasMarcas !== true) {
        const marcas = extraerValoresScope(
            acceso.marcas,
            [
                'codigoMarca', 'CODIGO_MARCA',
                'detalleMarca', 'DETALLE_MARCA',
                'codigo', 'detalle', 'value'
            ]
        );

        if (!scopeIncluye(
            alta.CODIGO_MARCA,
            alta.DETALLE_MARCA,
            marcas
        )) {
            return false;
        }
    }

    if (acceso.todosRubros !== true) {
        const rubros = extraerValoresScope(
            acceso.rubros,
            [
                'codigoRubro', 'CODIGO_RUBRO',
                'detalleRubro', 'DETALLE_RUBRO',
                'codigo', 'detalle', 'value'
            ]
        );

        if (!scopeIncluye(
            alta.CODIGO_RUBRO,
            alta.DETALLE_RUBRO,
            rubros
        )) {
            return false;
        }
    }

    if (acceso.todasLicencias !== true) {
        const licencias = extraerValoresScope(
            acceso.licencias,
            [
                'codigoLicencia', 'CODIGO_LICENCIA',
                'licencia', 'LICENCIA',
                'detalleLicencia', 'DETALLE_LICENCIA',
                'codigo', 'detalle', 'value'
            ]
        ).map(normalizarLicencia);

        const licenciaAlta =
            normalizarLicencia(alta.LICENCIA_ALTA);

        if (!licencias.includes(licenciaAlta)) {
            return false;
        }
    }

    return true;
}


async function listarAltas(
    estadoEntrada,
    { idEmpresa, acceso }
) {
    const estado = normalizarEstado(estadoEntrada);

    const estadosPermitidos = [
        'BORRADOR',
        'VALIDADO',
        'EXPORTADO',
        'PARCIAL_ERP',
        'GENERADO_OK_EN_ERP',
        'SIN_NOVEDADES_ERP',
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
            .listarAltasSeguimiento({
                estado,
                idEmpresa
            });

    return registros
        .filter(fila =>
            altaPermitidaPorAcceso(
                fila,
                acceso
            )
        )
        .map((fila) => {
            const total =
                Number(fila.CANTIDAD_EXPORTADOS || 0);

            const confirmados =
                Number(fila.CANTIDAD_CONFIRMADOS_ERP || 0);

            const pendientes =
                Number(fila.CANTIDAD_PENDIENTES_ERP || 0);

            const errores =
                Number(fila.CANTIDAD_ERROR_ERP || 0);

            const porcentajeConfirmado =
                total > 0
                    ? Number(((confirmados / total) * 100).toFixed(2))
                    : 0;

            return {
                ...fila,
                LICENCIA_ALTA:
                    normalizarLicencia(fila.LICENCIA_ALTA),
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


async function obtenerResumen({
    idEmpresa,
    acceso
}) {
    /*
     * El resumen se deriva del MISMO conjunto visible que el listado.
     * Así Dashboard y Seguimiento nunca pueden discrepar por filtros
     * de empresa / marca / rubro / licencia.
     */
    const altas =
        await listarAltas(
            null,
            { idEmpresa, acceso }
        );

    const contarEstado = estado =>
        altas.filter(
            alta =>
                normalizarEstado(alta.ESTADO) === estado
        ).length;

    /*
     * Un Alta anulada conserva su historial de exportación para auditoría,
     * pero ya no representa trabajo pendiente ni confirmado del circuito
     * operativo. Por eso no participa en las métricas del Dashboard/ERP.
     */
    const altasOperativas = altas.filter(
        alta => normalizarEstado(alta.ESTADO) !== 'ANULADO'
    );

    const erp = altasOperativas.reduce(
        (acum, alta) => {
            const s = alta.seguimientoErp || {};

            acum.totalExportados += Number(s.total || 0);
            acum.pendientes += Number(s.pendientes || 0);
            acum.confirmados += Number(s.confirmados || 0);
            acum.errores += Number(s.errores || 0);

            return acum;
        },
        {
            totalExportados: 0,
            pendientes: 0,
            confirmados: 0,
            errores: 0,
        }
    );

    return {
        altas: {
            total: altasOperativas.length,
            totalIncluyendoAnuladas: altas.length,
            borrador: contarEstado('BORRADOR'),
            validado: contarEstado('VALIDADO'),
            exportado: contarEstado('EXPORTADO'),
            parcialErp: contarEstado('PARCIAL_ERP'),
            generadoOkEnErp:
                contarEstado('GENERADO_OK_EN_ERP'),
            sinNovedadesErp:
                contarEstado('SIN_NOVEDADES_ERP'),
            anulado: contarEstado('ANULADO'),
        },
        erp,
    };
}


async function obtenerAlta(
    idEntrada,
    { idEmpresa, acceso }
) {
    const id = validarId(idEntrada);

    const resultado =
        await seguimientoRepository
            .obtenerSeguimientoAlta(
                id,
                idEmpresa
            );

    if (!resultado) {
        throw new Error('Alta no encontrada.');
    }

    if (!altaPermitidaPorAcceso(
        resultado.alta,
        acceso
    )) {
        const error =
            new Error(
                'No tiene permisos para acceder a esta alta por marca, rubro o licencia.'
            );
        error.status = 403;
        throw error;
    }

    const total =
        Number(resultado.resumenErp.TOTAL || 0);
    const confirmados =
        Number(resultado.resumenErp.CONFIRMADOS || 0);
    const pendientes =
        Number(resultado.resumenErp.PENDIENTES || 0);
    const errores =
        Number(resultado.resumenErp.ERRORES || 0);

    return {
        alta: {
            ...resultado.alta,
            LICENCIA_ALTA:
                normalizarLicencia(
                    resultado.alta.LICENCIA_ALTA
                ),
        },
        seguimientoErp: {
            total,
            confirmados,
            pendientes,
            errores,
            porcentajeConfirmado:
                total > 0
                    ? Number(((confirmados / total) * 100).toFixed(2))
                    : 0,
        },
        productos: resultado.productos,
    };
}


module.exports = {
    obtenerResumen,
    listarAltas,
    obtenerAlta,
};
