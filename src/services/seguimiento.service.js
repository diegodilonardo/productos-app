const seguimientoRepository =
    require('../repositories/seguimiento.repository');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const sharp = require('sharp');
const bwipjs = require('bwip-js');
const imagenesAltaService = require('./imagenesAlta.service');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { escribirDBFGenerico } = require('./dbfWriterGenerico.service');

const EAN_PROVISORIO_GS1 = '7792800015157';


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


function estadoSeguimientoEan(valor) {
    const ean = String(valor ?? '').trim();
    if (!ean) return 'SIN_EAN';
    if (ean === EAN_PROVISORIO_GS1) return 'PENDIENTE_GS1';
    return 'EAN_ASIGNADO';
}


async function listarSeguimientoEan({ idEmpresa, acceso }) {
    const registros = await seguimientoRepository
        .listarProductosSeguimientoEan(idEmpresa);

    const productos = registros
        .filter(fila => altaPermitidaPorAcceso(fila, acceso))
        .filter(fila => {
            const tipo = normalizarTexto(fila.TIPO_PRODUCTO_DETALLE);
            const clasificacion = normalizarTexto(fila.DETALLE_CLASIFICACION);
            return (
                tipo === 'MODULO' && !Boolean(fila.GENERADO_AUTOMATICO)
            ) || clasificacion === 'PRIMERA';
        })
        .map(fila => {
            const tipo = normalizarTexto(fila.TIPO_PRODUCTO_DETALLE);
            const talleCurva = tipo === 'MODULO'
                ? fila.DETALLE_MODULO
                : fila.DETALLE_TALLE;
            const parametrosImagen = new URLSearchParams({
                idAlta: String(fila.ID_ALTA ?? ''),
                ano: String(fila.CODIGO_ANO ?? ''),
                temporada: String(fila.CODIGO_TEMPORADA ?? ''),
                modelo: String(fila.CODIGO_MODELO ?? ''),
                color: String(fila.CODIGO_COLOR ?? ''),
            });

            return {
                ...fila,
                LICENCIA_ALTA: normalizarLicencia(fila.LICENCIA_ALTA),
                EAN_MOSTRADO: fila.EAN_GS1 || fila.EAN_ERP,
                ESTADO_EAN: fila.EAN_GS1
                    ? (String(fila.EAN_ERP || '').trim() === String(fila.EAN_GS1).trim()
                        ? 'CONFIRMADO_ERP'
                        : (fila.FECHA_ENVIO_PRESEA ? 'PENDIENTE_ERP' : 'EAN_ASIGNADO'))
                    : estadoSeguimientoEan(fila.EAN_ERP),
                TALLE_CURVA: talleCurva || '-',
                URL_IMAGEN: `/api/imagenes/archivo?${parametrosImagen.toString()}`,
                FAMILIAS_MODULO: String(fila.FAMILIAS_MODULO ?? '')
                    .split('|')
                    .map(valor => valor.trim())
                    .filter(Boolean),
            };
        });

    const modulos = productos.filter(
        producto => normalizarTexto(producto.TIPO_PRODUCTO_DETALLE) === 'MODULO'
    );
    const primeras = productos.filter(
        producto => normalizarTexto(producto.DETALLE_CLASIFICACION) === 'PRIMERA'
    );
    const familias = modulos.map(modulo => ({
        tipo: 'MODULO',
        clave: `${modulo.ID_ALTA}-${modulo.COD_ALFA}`,
        principal: modulo,
        primeras: primeras.filter(primera =>
            primera.FAMILIAS_MODULO.includes(String(modulo.COD_ALFA))
        ),
    }));
    const primerasSueltas = primeras
        .filter(primera => primera.FAMILIAS_MODULO.length === 0)
        .map(primera => ({
            tipo: 'PRIMERA',
            clave: `${primera.ID_ALTA}-${primera.COD_ALFA}`,
            principal: primera,
            primeras: [],
        }));

    return {
        resumen: {
            total: productos.length,
            pendientesGs1: productos.filter(x => x.ESTADO_EAN === 'PENDIENTE_GS1').length,
            asignados: productos.filter(x => x.ESTADO_EAN === 'EAN_ASIGNADO').length,
            sinEan: productos.filter(x => x.ESTADO_EAN === 'SIN_EAN').length,
            urlsAsociadas: productos.filter(x => Boolean(String(x.URL_IMAGEN_GS1 || '').trim())).length,
            pendientesErp: productos.filter(x => x.ESTADO_EAN === 'PENDIENTE_ERP').length,
            confirmadosErp: productos.filter(x => x.ESTADO_EAN === 'CONFIRMADO_ERP').length,
        },
        codigoProvisorio: EAN_PROVISORIO_GS1,
        productos,
        grupos: [...familias, ...primerasSueltas],
    };
}


async function exportarPendientesEan(contexto) {
    const seguimiento = await listarSeguimientoEan(contexto);
    const pendientes = seguimiento.productos.filter(
        producto => producto.ESTADO_EAN === 'PENDIENTE_GS1'
    );
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Pendientes GS1');

    hoja.columns = [
        { header: 'Alta', key: 'alta', width: 28 },
        { header: 'Código alfa', key: 'codigoAlfa', width: 24 },
        { header: 'Código ERP', key: 'codigoErp', width: 18 },
        { header: 'Modelo', key: 'modelo', width: 28 },
        { header: 'Color', key: 'color', width: 22 },
        { header: 'Talle / Curva', key: 'talleCurva', width: 32 },
        { header: 'Marca', key: 'marca', width: 22 },
        { header: 'Rubro', key: 'rubro', width: 22 },
        { header: 'Licencia', key: 'licencia', width: 22 },
        { header: 'EAN provisorio', key: 'ean', width: 20 },
    ];
    pendientes.forEach(producto => hoja.addRow({
        alta: producto.CODIGO_ALTA,
        codigoAlfa: producto.COD_ALFA,
        codigoErp: producto.CODIGO_ERP,
        modelo: producto.DETALLE_MODELO || producto.CODIGO_MODELO,
        color: producto.DETALLE_COLOR || producto.CODIGO_COLOR,
        talleCurva: producto.TALLE_CURVA,
        marca: producto.DETALLE_MARCA,
        rubro: producto.DETALLE_RUBRO,
        licencia: producto.LICENCIA_ALTA,
        ean: producto.EAN_ERP,
    }));
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    hoja.autoFilter = { from: 'A1', to: 'J1' };

    return workbook.xlsx.writeBuffer();
}


async function prepararImagenesEan(clavesEntrada, contexto) {
    const claves = [...new Set(
        (Array.isArray(clavesEntrada) ? clavesEntrada : [])
            .map(valor => String(valor ?? '').trim())
            .filter(Boolean)
    )];
    if (!claves.length) throw new Error('Seleccione al menos un producto.');
    if (claves.length > 1000) throw new Error('La selección supera el máximo de 1000 productos.');

    const seguimiento = await listarSeguimientoEan(contexto);
    const seleccionados = seguimiento.productos.filter(
        producto => claves.includes(`${producto.ID_ALTA}|${producto.COD_ALFA}`)
    );
    if (!seleccionados.length) throw new Error('No se encontraron productos habilitados en la selección.');
    const noPendientes = seleccionados.filter(producto => producto.ESTADO_EAN !== 'PENDIENTE_GS1');
    if (noPendientes.length) {
        throw new Error('Las imágenes para GS1 solo pueden descargarse para productos pendientes de gestión en GS1.');
    }

    const imagenes = [];
    const omitidos = [];
    const clavesProcesadas = new Set();
    const nombresProcesados = new Set();
    for (const producto of seleccionados) {
        const claveUnica = [producto.ID_ALTA, producto.CODIGO_MODELO, producto.CODIGO_COLOR]
            .map(valor => String(valor ?? '').trim().toUpperCase()).join('|');
        if (clavesProcesadas.has(claveUnica)) continue;
        clavesProcesadas.add(claveUnica);

        const encontrada = await imagenesAltaService.buscarImagenProducto(
            producto.ID_ALTA,
            producto
        );
        if (!encontrada) {
            omitidos.push(producto.COD_ALFA);
            continue;
        }
        const nombreNormalizado = encontrada.nombre.toLowerCase();
        if (nombresProcesados.has(nombreNormalizado)) continue;
        nombresProcesados.add(nombreNormalizado);

        const metadata = await sharp(encontrada.archivo).metadata();
        const width = Math.max(Number(metadata.width || 0), 400);
        const height = Math.max(Number(metadata.height || 0), 400);
        let salida = sharp(encontrada.archivo).rotate().resize({
            width,
            height,
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
        });
        if (encontrada.extension === '.png') salida = salida.png();
        else salida = salida.flatten({ background: '#ffffff' }).jpeg({ quality: 92 });
        imagenes.push({
            nombre: encontrada.nombre,
            buffer: await salida.toBuffer(),
        });
    }
    if (!imagenes.length) throw new Error('Los productos seleccionados no tienen imágenes disponibles.');
    return { imagenes, omitidos };
}


function codigoBarrasSvg(tipo, valor, opciones = {}) {
    const texto = String(valor ?? '').trim();
    if (!texto) return '';
    try {
        return bwipjs.toSVG({
            bcid: tipo,
            text: texto,
            scale: 1,
            height: opciones.height || 8,
            includetext: false,
            paddingwidth: 0,
            paddingheight: 0,
        }).replace('<svg ', '<svg preserveAspectRatio="none" ');
    } catch (_) {
        return '';
    }
}


async function imagenEtiquetaProducto(producto, cache) {
    const clave = [
        producto.ID_ALTA,
        producto.CODIGO_MODELO,
        producto.CODIGO_COLOR,
    ].map(valor => String(valor ?? '').trim().toUpperCase()).join('|');

    if (cache.has(clave)) return cache.get(clave);

    let imagen = '';
    try {
        const encontrada = await imagenesAltaService.buscarImagenProducto(
            producto.ID_ALTA,
            producto
        );
        if (encontrada) {
            const buffer = await sharp(encontrada.archivo)
                .rotate()
                .resize(180, 180, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 82 })
                .toBuffer();
            imagen = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
    } catch (_) {
        imagen = '';
    }

    cache.set(clave, imagen);
    return imagen;
}


function debeMostrarImagenEtiqueta(producto, contexto) {
    const acceso = contexto?.acceso || {};
    const empresa = normalizarTexto(
        acceso.empresa || acceso.razonSocial || acceso.RAZON_SOCIAL || acceso.codigoEmpresa
    );
    const rubro = normalizarTexto(producto?.DETALLE_RUBRO || producto?.CODIGO_RUBRO);

    return !(
        empresa === 'VICBOR' &&
        ['INDUMENTARIA', 'ACCESORIOS'].includes(rubro)
    );
}


function ordenTalle(valor) {
    const texto = String(valor ?? '').trim();
    const numero = Number(texto.replace(',', '.'));
    return Number.isFinite(numero) ? [0, numero, texto] : [1, 0, texto];
}


function compararTalles(a, b) {
    const x = ordenTalle(a.DETALLE_TALLE);
    const y = ordenTalle(b.DETALLE_TALLE);
    return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], 'es', { numeric: true });
}


function compararCurvas(a, b) {
    const curvaA = String(a?.principal?.DETALLE_MODULO || a?.principal?.CODIGO_MODULO || '').trim();
    const curvaB = String(b?.principal?.DETALLE_MODULO || b?.principal?.CODIGO_MODULO || '').trim();
    return curvaA.localeCompare(curvaB, 'es', { numeric: true, sensitivity: 'base' }) ||
        String(a?.principal?.DETALLE_MODELO || '').localeCompare(String(b?.principal?.DETALLE_MODELO || ''), 'es', { numeric: true }) ||
        String(a?.principal?.DETALLE_COLOR || '').localeCompare(String(b?.principal?.DETALLE_COLOR || ''), 'es', { numeric: true });
}


function extraerCantidadesCurva(detalle, cantidadTalles, totalFallback = 0) {
    const texto = String(detalle ?? '').trim();
    const candidatos = [];
    const parentesis = texto.match(/\(([\d\s,;|]+)\)/);
    if (parentesis) candidatos.push(parentesis[1]);
    const despuesPares = texto.match(/PARES?\s+([\d\s,;|]+)$/i);
    if (despuesPares) candidatos.push(despuesPares[1]);
    const despuesTotal = texto.match(/X\s*\d+\s+(?:PARES?\s+)?((?:\d+[\s,;|]+)+\d+)\s*$/i);
    if (despuesTotal) candidatos.push(despuesTotal[1]);
    const antesTotal = texto.match(/((?:\d+\s*[,;|]\s*)+\d+)\s*X\s*\d+/i);
    if (antesTotal) candidatos.push(antesTotal[1]);

    for (const candidato of candidatos) {
        const cantidades = candidato.split(/[\s,;|]+/)
            .map(valor => Number(String(valor).trim()))
            .filter(valor => Number.isFinite(valor) && valor > 0);
        if (cantidades.length === cantidadTalles) return cantidades;
    }

    if (cantidadTalles === 1) {
        const totalDescripcion = texto.match(/X\s*(\d+)/i);
        const total = Number(totalDescripcion?.[1] || totalFallback || 0);
        if (total > 0) return [total];
    }
    return [];
}

function columnaMaestroParaTalle(talle) {
    const valor = normalizarTexto(talle).replace(',', '.');
    if (/^\d+(?:\.5)?$/.test(valor)) {
        const [entero, decimal] = valor.split('.');
        return `TM_T${String(Number(entero)).padStart(2, '0')}${decimal === '5' ? '5' : ''}`;
    }
    const alfa = valor.replace(/[^A-Z0-9]/g, '');
    return alfa ? `TM_T_${alfa}` : '';
}

function cantidadesCurvaDesdeMaestro(producto, primeras) {
    if (!producto || !Array.isArray(primeras) || !primeras.length) return [];
    const cantidades = primeras.map(primera => {
        const columna = columnaMaestroParaTalle(primera.DETALLE_TALLE || primera.CODIGO_TALLE);
        return Number(producto[columna]);
    });
    if (cantidades.some(cantidad => !Number.isInteger(cantidad) || cantidad <= 0)) return [];
    const total = cantidades.reduce((suma, cantidad) => suma + cantidad, 0);
    const totalMaestro = Number(producto.PARES_MAESTRO || 0);
    return totalMaestro > 0 && total === totalMaestro ? cantidades : [];
}


async function prepararEtiquetasEan(clavesEntrada, contexto) {
    const claves = [...new Set(
        (Array.isArray(clavesEntrada) ? clavesEntrada : [])
            .map(valor => String(valor ?? '').trim())
            .filter(Boolean)
    )];
    if (!claves.length) throw new Error('Seleccione al menos un producto para imprimir.');
    if (claves.length > 1000) throw new Error('La selección supera el máximo de 1000 productos.');

    const seguimiento = await listarSeguimientoEan(contexto);
    const seleccionados = seguimiento.productos.filter(
        producto => claves.includes(`${producto.ID_ALTA}|${producto.COD_ALFA}`)
    );
    if (seleccionados.length !== claves.length) {
        throw new Error('Hay productos seleccionados fuera del alcance disponible.');
    }

    const clavesSeleccionadas = new Set(claves);
    const modulosSeleccionados = seguimiento.grupos.filter(grupo =>
        grupo.tipo === 'MODULO' &&
        clavesSeleccionadas.has(`${grupo.principal.ID_ALTA}|${grupo.principal.COD_ALFA}`)
    ).sort(compararCurvas);

    const paresPorClave = new Map();
    for (const grupo of modulosSeleccionados) {
        for (const primera of [...(grupo.primeras || [])].sort(compararTalles)) {
            paresPorClave.set(`${primera.ID_ALTA}|${primera.COD_ALFA}`, {
                producto: primera,
                ordenCurva: String(grupo.principal.DETALLE_MODULO || grupo.principal.CODIGO_MODULO || ''),
            });
        }
    }
    for (const producto of seleccionados) {
        if (normalizarTexto(producto.DETALLE_CLASIFICACION) !== 'PRIMERA') continue;
        const clave = `${producto.ID_ALTA}|${producto.COD_ALFA}`;
        if (!paresPorClave.has(clave)) paresPorClave.set(clave, { producto, ordenCurva: 'ZZZ' });
    }
    const paresSeleccionados = [...paresPorClave.values()].sort((a, b) =>
        a.ordenCurva.localeCompare(b.ordenCurva, 'es', { numeric: true, sensitivity: 'base' }) ||
        String(a.producto.DETALLE_MODELO || '').localeCompare(String(b.producto.DETALLE_MODELO || ''), 'es', { numeric: true }) ||
        String(a.producto.DETALLE_COLOR || '').localeCompare(String(b.producto.DETALLE_COLOR || ''), 'es', { numeric: true }) ||
        compararTalles(a.producto, b.producto)
    ).map(item => item.producto);

    const productosAImprimir = [
        ...modulosSeleccionados.map(grupo => grupo.principal),
        ...paresSeleccionados,
    ];
    const sinEanConfirmado = productosAImprimir.filter(
        producto => producto.ESTADO_EAN !== 'CONFIRMADO_ERP' || !ean13Valido(producto.EAN_ERP)
    );
    if (sinEanConfirmado.length) {
        throw new Error(`${sinEanConfirmado.length} producto(s) de las familias seleccionadas todavía no tienen el EAN confirmado en Presea.`);
    }

    const cacheImagenes = new Map();
    const modulos = [];
    for (const grupo of modulosSeleccionados) {
        const producto = grupo.principal;
        const primerasOrdenadas = [...(grupo.primeras || [])].sort(compararTalles);
        const cantidadesCurva = cantidadesCurvaDesdeMaestro(producto, primerasOrdenadas);
        if (!cantidadesCurva.length) cantidadesCurva.push(...extraerCantidadesCurva(
            producto.TALLE_CURVA || producto.DETALLE_MODULO,
            primerasOrdenadas.length,
            producto.PARES
        ));
        const composicion = primerasOrdenadas.map((primera, indice) => ({
                talle: primera.DETALLE_TALLE || primera.CODIGO_TALLE || '-',
                pares: cantidadesCurva[indice] || Number(primera.PARES || 0) || '-',
            }));
        const totalPares = composicion.reduce(
            (total, item) => total + (Number(item.pares) || 0),
            0
        ) || Number(producto.PARES || 0) || '-';
        modulos.push({
            codigoAlfa: producto.COD_ALFA,
            ean: producto.EAN_ERP,
            marca: producto.DETALLE_MARCA || producto.CODIGO_MARCA || '-',
            articulo: producto.DETALLE_MODELO || producto.CODIGO_MODELO || '-',
            talleCurva: producto.TALLE_CURVA || producto.DETALLE_MODULO || '-',
            color: producto.DETALLE_COLOR || producto.CODIGO_COLOR || '-',
            imagen: debeMostrarImagenEtiqueta(producto, contexto)
                ? await imagenEtiquetaProducto(producto, cacheImagenes)
                : '',
            composicion,
            totalPares,
            barcodeAlfa: codigoBarrasSvg('code128', producto.COD_ALFA, { height: 7, textsize: 7 }),
            barcodeEan: codigoBarrasSvg('ean13', producto.EAN_ERP, { height: 7, textsize: 7 }),
        });
    }

    const pares = [];
    for (const producto of paresSeleccionados) {
        pares.push({
            codigoAlfa: producto.COD_ALFA,
            ean: producto.EAN_ERP,
            articulo: producto.DETALLE_MODELO || producto.CODIGO_MODELO || '-',
            color: producto.DETALLE_COLOR || producto.CODIGO_COLOR || '-',
            talle: producto.DETALLE_TALLE || producto.CODIGO_TALLE || '-',
            imagen: debeMostrarImagenEtiqueta(producto, contexto)
                ? await imagenEtiquetaProducto(producto, cacheImagenes)
                : '',
            barcodeAlfa: codigoBarrasSvg('code128', producto.COD_ALFA, { height: 8, textsize: 7 }),
            barcodeEan: codigoBarrasSvg('ean13', producto.EAN_ERP, { height: 8, textsize: 7 }),
        });
    }

    if (!modulos.length && !pares.length) {
        throw new Error('La selección no contiene módulos ni pares individuales imprimibles.');
    }
    return {
        modulos,
        pares,
        hayModulos: modulos.length > 0,
        hayPares: pares.length > 0,
        cantidad: modulos.length + pares.length,
        cantidadModulos: modulos.length,
        cantidadPares: pares.length,
    };
}


function valorCeldaExcel(celda) {
    const valor = celda?.value;
    if (valor && typeof valor === 'object') {
        return String(valor.hyperlink || valor.text || valor.result || '').trim();
    }
    return String(valor ?? '').trim();
}


function normalizarNombreImagen(valor) {
    return String(valor ?? '')
        .trim()
        .replace(/^.*[\\/]/, '')
        .replace(/\.(?:jpe?g|png|webp|gif|bmp|tiff?)$/i, '')
        .toLocaleLowerCase('es');
}


async function asociarUrlsTemporalesEan(bufferArchivo, clavesEntrada, contexto) {
    if (!Buffer.isBuffer(bufferArchivo) || !bufferArchivo.length) {
        throw new Error('Seleccione un archivo Excel de URLs temporales de GS1.');
    }

    let filasArchivo = [];
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bufferArchivo);
        const hoja = workbook.worksheets[0];
        if (hoja) {
            for (let numeroFila = 1; numeroFila <= hoja.rowCount; numeroFila += 1) {
                const fila = [];
                const filaExcel = hoja.getRow(numeroFila);
                for (let numeroColumna = 1; numeroColumna <= filaExcel.cellCount; numeroColumna += 1) {
                    fila[numeroColumna - 1] = valorCeldaExcel(filaExcel.getCell(numeroColumna));
                }
                filasArchivo.push(fila);
            }
        }
    } catch (_) {
        try {
            const workbookAlternativo = XLSX.read(bufferArchivo, {
                type: 'buffer',
                raw: false,
                cellText: true,
            });
            const nombreHoja = workbookAlternativo.SheetNames[0];
            if (nombreHoja) {
                filasArchivo = XLSX.utils.sheet_to_json(
                    workbookAlternativo.Sheets[nombreHoja],
                    { header: 1, defval: '', raw: false }
                );
            }
        } catch (_) {
            filasArchivo = [];
        }
    }
    if (!filasArchivo.length) {
        throw new Error('No se pudo leer el archivo. Descárguelo nuevamente desde GS1 y seleccione el archivo sin modificarlo.');
    }

    let filaEncabezados = null;
    let columnaUrl = null;
    let columnaNombre = null;
    const limite = Math.min(filasArchivo.length, 15);
    for (let indiceFila = 0; indiceFila < limite; indiceFila += 1) {
        filasArchivo[indiceFila].forEach((valor, indiceColumna) => {
            const encabezado = normalizarTexto(valor)
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^A-Z0-9]/g, '');
            if (encabezado === 'URLS' || encabezado === 'URL' || encabezado === 'URLTEMPORAL') {
                columnaUrl = indiceColumna;
            }
            if (encabezado === 'NOMBRE' || encabezado === 'NOMBREARCHIVO') {
                columnaNombre = indiceColumna;
            }
        });
        if (columnaUrl !== null && columnaNombre !== null) {
            filaEncabezados = indiceFila;
            break;
        }
    }
    if (filaEncabezados === null) {
        throw new Error('No se encontraron las columnas Urls y Nombre en el archivo de GS1.');
    }

    const urlsPorNombre = new Map();
    const nombresDuplicados = new Set();
    for (let indiceFila = filaEncabezados + 1; indiceFila < filasArchivo.length; indiceFila += 1) {
        const fila = filasArchivo[indiceFila];
        const nombreOriginal = String(fila[columnaNombre] ?? '').trim();
        const url = String(fila[columnaUrl] ?? '').trim();
        if (!nombreOriginal && !url) continue;
        const nombre = normalizarNombreImagen(nombreOriginal);
        if (!nombre || !/^https?:\/\//i.test(url)) continue;
        if (urlsPorNombre.has(nombre) && urlsPorNombre.get(nombre) !== url) {
            nombresDuplicados.add(nombreOriginal);
            continue;
        }
        urlsPorNombre.set(nombre, url);
    }
    if (!urlsPorNombre.size) {
        throw new Error('El archivo no contiene URLs temporales válidas.');
    }

    const claves = [...new Set((Array.isArray(clavesEntrada) ? clavesEntrada : [])
        .map(valor => String(valor ?? '').trim()).filter(Boolean))];
    if (!claves.length) throw new Error('Seleccione al menos un producto antes de importar las URLs.');

    const seguimiento = await listarSeguimientoEan(contexto);
    const seleccionados = seguimiento.productos.filter(
        producto => claves.includes(`${producto.ID_ALTA}|${producto.COD_ALFA}`)
    );
    if (seleccionados.length !== claves.length) {
        throw new Error('Hay productos seleccionados fuera del alcance disponible.');
    }
    const estadosPermitidos = new Set(['PENDIENTE_GS1', 'EAN_ASIGNADO']);
    const noImportables = seleccionados.filter(producto => !estadosPermitidos.has(producto.ESTADO_EAN));
    if (noImportables.length) {
        throw new Error('Las URLs de GS1 solo pueden asociarse antes de enviar los productos a Presea.');
    }
    const asociados = [];
    const productosSinUrl = [];
    for (const producto of seleccionados) {
        const encontrada = await imagenesAltaService.buscarImagenProducto(producto.ID_ALTA, producto);
        const nombreImagen = encontrada?.nombre || '';
        const urlImagen = urlsPorNombre.get(normalizarNombreImagen(nombreImagen));
        if (!urlImagen) {
            productosSinUrl.push({ codigoAlfa: producto.COD_ALFA, nombreImagen: nombreImagen || null });
            continue;
        }
        asociados.push({
            claveProducto: `${producto.ID_ALTA}|${producto.COD_ALFA}`,
            idAlta: Number(producto.ID_ALTA),
            codigoAlfa: producto.COD_ALFA,
            nombreImagen,
            urlImagen,
        });
    }

    const usados = new Set(asociados.map(item => normalizarNombreImagen(item.nombreImagen)));
    const urlsSinProducto = [...urlsPorNombre.entries()]
        .filter(([nombre]) => !usados.has(nombre))
        .map(([nombre, url]) => ({ nombreImagen: nombre, urlImagen: url }));

    let persistencia = { insertadas: 0, actualizadas: 0 };
    if (asociados.length) {
        persistencia = await seguimientoRepository.guardarUrlsProductosGs1({
            idEmpresa: contexto.idEmpresa,
            asociaciones: asociados,
            usuario: String(contexto.usuario || 'SISTEMA').trim() || 'SISTEMA',
        });
    }

    return {
        resumen: {
            productosSeleccionados: seleccionados.length,
            productosAsociados: asociados.length,
            productosSinUrl: productosSinUrl.length,
            urlsSinProducto: urlsSinProducto.length,
            urlsInsertadas: persistencia.insertadas,
            urlsActualizadas: persistencia.actualizadas,
        },
        asociados,
        productosSinUrl,
        urlsSinProducto,
        nombresDuplicados: [...nombresDuplicados],
    };
}


const CONFIGURACION_GS1 = {
    CALZADO: {
        MODULO: { gpc: '10001070', envase: 'CTN', unidad: 'PR' },
        PAR_SUELTO: { gpc: '10001070', envase: 'CTN', unidad: 'PR' },
    },
    INDUMENTARIA: {
        MODULO: { gpc: '10001342', envase: 'CTN', unidad: 'PR' },
        PAR_SUELTO: { gpc: '10001342', envase: 'EC', unidad: 'UN' },
    },
    ACCESORIOS: {
        MODULO: { gpc: '10001903', envase: 'CTN', unidad: 'PR' },
        PAR_SUELTO: { gpc: '10001903', envase: 'EC', unidad: 'UN' },
    },
};


function filaArchivoGs1(producto, urlImagen, opciones = {}) {
    const rubro = normalizarTexto(producto.DETALLE_RUBRO);
    const tipo = normalizarTexto(producto.TIPO_PRODUCTO_DETALLE);
    const regla = CONFIGURACION_GS1[rubro]?.[tipo];
    if (!regla) {
        throw new Error(`No existe configuración GS1 para ${rubro || 'SIN RUBRO'} / ${tipo || 'SIN TIPO'}.`);
    }
    const pais = String(producto.PAIS_EAN ?? '').trim();
    if (!pais) {
        throw new Error(`El producto ${producto.COD_ALFA} no tiene PAIS_EAN configurado.`);
    }
    const marca = String(producto.DETALLE_MARCA || producto.CODIGO_MARCA || '').trim();
    const pares = tipo === 'MODULO' ? Number(producto.PARES || 0) : 1;
    if (!Number.isFinite(pares) || pares <= 0) {
        throw new Error(`El producto ${producto.COD_ALFA} no tiene una cantidad válida.`);
    }
    const nombre = String(producto.DETALLE_MODELO || producto.DETALLE_PRODUCTO || '').trim();
    const variedadBase = String(producto.DETALLE_PRODUCTO || [
        producto.DETALLE_MODELO,
        producto.DETALLE_COLOR,
        producto.TALLE_CURVA,
    ].filter(Boolean).join(' ')).trim();
    const edad = String(producto.DETALLE_EDAD ?? '').trim();
    const variedadConEdad = edad && !normalizarTexto(variedadBase).includes(normalizarTexto(edad))
        ? `${variedadBase} ${edad}`.trim()
        : variedadBase;
    const sexo = opciones.incluirSexo ? String(producto.SEXO ?? '').trim() : '';
    const variedadConSexo = sexo && !normalizarTexto(variedadConEdad).includes(normalizarTexto(sexo))
        ? `${variedadConEdad} ${sexo}`.trim()
        : variedadConEdad;
    const campana = [producto.DETALLE_TEMPORADA, producto.CODIGO_ANO]
        .map(valor => String(valor ?? '').trim())
        .filter(Boolean)
        .join(' ');
    const variedad = campana && !normalizarTexto(variedadConSexo).endsWith(normalizarTexto(campana))
        ? `${variedadConSexo} ${campana}`.trim()
        : variedadConSexo;
    return [
        'A', marca, marca, nombre, variedad, regla.gpc, pais, 'NAC', regla.envase,
        pares, regla.unidad, '', '', String(producto.COD_ALFA || '').trim(), '', 'COMUN',
        '', '', 'N', '', 'AR', urlImagen, 'NO', 'NO', 'NO', 'NO', 'NO', 'NO',
        'NO', 'NO', 'NO', '', '', '', '', '', '', '', '', '', '', '',
    ];
}


function asegurarVariedadesUnicas(productos, urlPorClave) {
    const entradas = productos.map(producto => {
        const clave = `${producto.ID_ALTA}|${producto.COD_ALFA}`;
        return { producto, fila: filaArchivoGs1(producto, urlPorClave.get(clave)) };
    });
    const contar = () => entradas.reduce((mapa, entrada) => {
        const clave = normalizarTexto(entrada.fila[4]);
        mapa.set(clave, (mapa.get(clave) || 0) + 1);
        return mapa;
    }, new Map());

    let cantidades = contar();
    entradas.forEach(entrada => {
        if ((cantidades.get(normalizarTexto(entrada.fila[4])) || 0) > 1) {
            const clave = `${entrada.producto.ID_ALTA}|${entrada.producto.COD_ALFA}`;
            entrada.fila = filaArchivoGs1(
                entrada.producto,
                urlPorClave.get(clave),
                { incluirSexo: true }
            );
        }
    });

    cantidades = contar();
    entradas.forEach(entrada => {
        if ((cantidades.get(normalizarTexto(entrada.fila[4])) || 0) > 1) {
            entrada.fila[4] = `${entrada.fila[4]} ${entrada.producto.COD_ALFA}`.trim();
        }
    });
    return entradas.map(entrada => entrada.fila);
}


async function generarArchivoGs1(asociacionesEntrada, contexto) {
    const asociaciones = Array.isArray(asociacionesEntrada) ? asociacionesEntrada : [];
    if (!asociaciones.length) throw new Error('Primero importe y asocie las URLs temporales de GS1.');
    if (asociaciones.length > 1000) throw new Error('La selección supera el máximo de 1000 productos.');

    const urlPorClave = new Map();
    asociaciones.forEach(item => {
        const clave = String(item?.claveProducto || '').trim();
        const url = String(item?.urlImagen || '').trim();
        if (clave && /^https?:\/\//i.test(url)) urlPorClave.set(clave, url);
    });
    const seguimiento = await listarSeguimientoEan(contexto);
    const productos = seguimiento.productos.filter(producto =>
        urlPorClave.has(`${producto.ID_ALTA}|${producto.COD_ALFA}`)
    );
    if (!productos.length) throw new Error('No hay productos habilitados asociados a las URLs importadas.');
    const noPendientes = productos.filter(producto => producto.ESTADO_EAN !== 'PENDIENTE_GS1');
    if (noPendientes.length) {
        throw new Error('El archivo GS1 solo puede generarse con productos pendientes de gestión en GS1.');
    }

    const encabezados = [
        'Acción', 'Marca', 'SubMarca', 'Nombre de Producto', 'Variedad',
        'Clasificación (GPC)', 'País de Fabricación', 'Origen del Código', 'Envase',
        'Contenido Neto', 'Unidad de Medida', 'GTIN', 'Código Articulo', 'Código Interno',
        'NroRegCertificado', 'TipoProducto', 'Atributo', 'Valor', 'En Desarrollo',
        'Fecha de Activación', 'Mercado de Destino', 'Url_Imagen', 'Exceptuado',
        'NoAlcanzado', 'Sodio', 'Azucares', 'Grasas_saturadas', 'Grasas_totales',
        'Calorias', 'Edulcorantes', 'Cafeina', 'UrlPrincipal', 'LinkTypePrincipal',
        'Url1', 'LinkType1', 'Url2', 'LinkType2', 'Url3', 'LinkType3', 'Url4',
        'LinkType4', 'Resultado',
    ];
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Productos');
    hoja.addRow(encabezados);
    asegurarVariedadesUnicas(productos, urlPorClave).forEach(fila => hoja.addRow(fila));
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    hoja.autoFilter = { from: 'A1', to: 'AP1' };
    hoja.columns.forEach((columna, indice) => {
        columna.width = [12, 18, 18, 30, 55, 22, 20, 18, 12, 16, 18, 18, 20, 24][indice] || 16;
    });
    return workbook.xlsx.writeBuffer();
}

function ean13Valido(valor) {
    const ean = String(valor || '').trim();
    if (!/^\d{13}$/.test(ean)) return false;
    let suma = 0;
    for (let i = 0; i < 12; i += 1) suma += Number(ean[i]) * (i % 2 ? 3 : 1);
    return (10 - (suma % 10)) % 10 === Number(ean[12]);
}

async function importarCodigosEanGs1(buffer, nombreArchivo, clavesEntrada, contexto) {
    const clavesSeleccionadas = new Set(
        (Array.isArray(clavesEntrada) ? clavesEntrada : [])
            .map(valor => String(valor || '').trim())
            .filter(Boolean)
    );
    if (!clavesSeleccionadas.size) {
        throw new Error('Seleccione los productos pendientes que desea cruzar con el archivo de GS1.');
    }
    let workbook;
    try { workbook = XLSX.read(buffer, { type: 'buffer', raw: false }); }
    catch (_) { throw new Error('El archivo devuelto por GS1 no es un Excel válido.'); }
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false });
    if (!filas.length || !Object.hasOwn(filas[0], 'GTIN') || !Object.hasOwn(filas[0], 'CodigoInterno')) {
        throw new Error('No se encontraron las columnas GTIN y CodigoInterno.');
    }
    const seguimiento = await listarSeguimientoEan(contexto);
    const productosSeleccionados = seguimiento.productos.filter(producto =>
        clavesSeleccionadas.has(`${producto.ID_ALTA}|${producto.COD_ALFA}`)
    );
    const estadosImportables = new Set(['PENDIENTE_GS1', 'EAN_ASIGNADO']);
    const seleccionNoImportable = productosSeleccionados.filter(
        producto => !estadosImportables.has(producto.ESTADO_EAN)
    );
    if (seleccionNoImportable.length) {
        throw new Error('La selección contiene productos ya enviados o confirmados en Presea. Solo se pueden importar o corregir EAN que todavía no fueron enviados.');
    }
    const porCodigoSeleccionado = new Map(
        productosSeleccionados.map(producto => [normalizarTexto(producto.COD_ALFA), producto])
    );
    const porCodigoGeneral = new Map(
        seguimiento.productos.map(producto => [normalizarTexto(producto.COD_ALFA), producto])
    );
    const vistosEan = new Set(), vistosCodigo = new Set(), validos = [], rechazados = [];
    let ignoradosYaActualizados = 0;
    let ignoradosFueraSeleccion = 0;
    for (const fila of filas) {
        const codigoAlfa = String(fila.CodigoInterno || '').trim();
        const ean = String(fila.GTIN || '').trim();
        const codigoNormalizado = normalizarTexto(codigoAlfa);
        const producto = porCodigoSeleccionado.get(codigoNormalizado);
        const productoGeneral = porCodigoGeneral.get(codigoNormalizado);
        if (!producto) {
            if (productoGeneral && !estadosImportables.has(productoGeneral.ESTADO_EAN)) ignoradosYaActualizados += 1;
            else ignoradosFueraSeleccion += 1;
            continue;
        }
        let motivo = '';
        if (!ean13Valido(ean)) motivo = 'GTIN/EAN inválido.';
        else if (vistosCodigo.has(codigoNormalizado)) motivo = 'Código interno duplicado en el archivo.';
        else if (vistosEan.has(ean)) motivo = 'GTIN/EAN duplicado en el archivo.';
        if (motivo) { rechazados.push({ codigoAlfa, ean, motivo }); continue; }
        vistosCodigo.add(codigoNormalizado); vistosEan.add(ean);
        validos.push({ idAlta: producto.ID_ALTA, codigoAlfa, ean,
            urlImagen: String(fila.Url_Imagen || '').trim(), nombreImagen: producto.NOMBRE_IMAGEN_GS1 });
    }
    if (!validos.length) throw new Error('El archivo no contiene productos válidos para importar.');
    const guardado = await seguimientoRepository.guardarCodigosEanGs1({
        idEmpresa: contexto.idEmpresa, productos: validos,
        usuario: String(contexto.usuario || 'SISTEMA'), archivoOrigen: String(nombreArchivo || 'GS1.xlsx').slice(0, 260),
    });
    return {
        resumen: {
            leidos: filas.length,
            validos: validos.length,
            rechazados: rechazados.length,
            ignorados: ignoradosYaActualizados + ignoradosFueraSeleccion,
            ignoradosYaActualizados,
            ignoradosFueraSeleccion,
            ...guardado,
        },
        rechazados,
    };
}

async function exportarGtinDbi(clavesEntrada, contexto) {
    const claves = [...new Set((Array.isArray(clavesEntrada) ? clavesEntrada : [])
        .map(valor => String(valor || '').trim()).filter(Boolean))];
    if (!claves.length) throw new Error('Seleccione al menos un producto.');
    const seguimiento = await listarSeguimientoEan(contexto);
    const seleccionados = seguimiento.productos.filter(p => claves.includes(`${p.ID_ALTA}|${p.COD_ALFA}`));
    if (seleccionados.length !== claves.length) throw new Error('Hay productos seleccionados fuera del alcance disponible.');
    const estadosInvalidos = seleccionados.filter(p => p.ESTADO_EAN !== 'EAN_ASIGNADO');
    if (estadosInvalidos.length) {
        throw new Error('GTIN.DBI solo puede generarse para productos con EAN asignado y todavía no enviados a Presea.');
    }
    const incompletos = seleccionados.filter(p => !String(p.CODIGO_ERP || '').trim() || !ean13Valido(p.EAN_GS1));
    if (incompletos.length) {
        throw new Error(`${incompletos.length} producto(s) no tienen código ERP o EAN definitivo válido.`);
    }
    const registros = seleccionados.map(p => ({
        CODIGO: String(p.CODIGO_ERP).trim(),
        GTIN: String(p.EAN_GS1).trim(),
    }));
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gtin-dbi-'));
    const archivo = path.join(carpeta, 'GTIN.DBI');
    try {
        escribirDBFGenerico(archivo, registros, [
            { nombre: 'CODIGO', tipo: 'N', largo: 20, decimales: 0 },
            { nombre: 'GTIN', tipo: 'C', largo: 254 },
        ]);
        return fs.readFileSync(archivo);
    } finally {
        try { fs.rmSync(carpeta, { recursive: true, force: true }); } catch (_) {}
    }
}

async function enviarGtinDbiAPresea(clavesEntrada, contexto) {
    const buffer = await exportarGtinDbi(clavesEntrada, contexto);
    const carpetaDestino = String(
        process.env.GTIN_PRESEA_PATH || '\\\\172.24.0.175\\Vicbor2\\Productos\\archivos\\EAN'
    ).trim();
    if (!carpetaDestino || !fs.existsSync(carpetaDestino)) {
        throw new Error(`No se encuentra la carpeta de destino de Presea: ${carpetaDestino}`);
    }
    const destino = path.join(carpetaDestino, 'GTIN.DBI');
    if (fs.existsSync(destino)) {
        throw new Error('Ya existe un GTIN.DBI pendiente en Presea. Espere a que sea procesado antes de enviar otro.');
    }
    const temporal = path.join(
        carpetaDestino,
        `GTIN_${process.pid}_${Date.now()}.TMP`
    );
    try {
        fs.writeFileSync(temporal, buffer, { flag: 'wx' });
        fs.renameSync(temporal, destino);
    } catch (error) {
        try { if (fs.existsSync(temporal)) fs.unlinkSync(temporal); } catch (_) {}
        throw new Error(`No se pudo enviar GTIN.DBI a Presea. Detalle: ${error.message}`);
    }
    const marcados = await seguimientoRepository.marcarCodigosEanEnviadosPresea({
        idEmpresa: contexto.idEmpresa,
        claves: clavesEntrada,
        usuario: String(contexto.usuario || 'SISTEMA').trim() || 'SISTEMA',
    });
    return { archivo: 'GTIN.DBI', ruta: carpetaDestino, registros: buffer.readUInt32LE(4), marcados };
}


module.exports = {
    obtenerResumen,
    listarAltas,
    obtenerAlta,
    listarSeguimientoEan,
    exportarPendientesEan,
    prepararImagenesEan,
    prepararEtiquetasEan,
    asociarUrlsTemporalesEan,
    generarArchivoGs1,
    filaArchivoGs1,
    asegurarVariedadesUnicas,
    importarCodigosEanGs1,
    ean13Valido,
    exportarGtinDbi,
    enviarGtinDbiAPresea,
    estadoSeguimientoEan,
    extraerCantidadesCurva,
    cantidadesCurvaDesdeMaestro,
    debeMostrarImagenEtiqueta,
};
