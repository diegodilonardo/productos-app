const ExcelJS =
    require('exceljs');

const altasRepository =
    require('../repositories/altas.repository');


function texto(valor) {
    if (
        valor === null ||
        valor === undefined
    ) {
        return '';
    }

    return String(valor).trim();
}


function limpiarNombreArchivo(valor) {
    return texto(valor)
        .replace(
            /[^A-Za-z0-9_-]/g,
            '_'
        );
}


function normalizarTipoProducto(valor) {
    return texto(valor)
        .toUpperCase()
        .replace(
            /[\s-]+/g,
            '_'
        );
}


function esValorVerdadero(valor) {
    return (
        valor === true ||
        valor === 1 ||
        texto(valor).toUpperCase() === 'TRUE'
    );
}


const ESTADOS_HABILITADOS_EXCEL_ALTA = [
    'BORRADOR',
    'VALIDADO',
    'EXPORTADO',
    'PARCIAL_ERP',
    'GENERADO_OK_EN_ERP',
    'SIN_NOVEDADES_ERP'
];


async function cargarImagenModulo(
    baseUrl,
    alta,
    detalle
) {

    const parametros =
        new URLSearchParams({
            ano:
                texto(
                    alta.CODIGO_ANO
                ),

            temporada:
                texto(
                    alta.CODIGO_TEMPORADA
                ),

            modelo:
                texto(
                    detalle.CODIGO_MODELO
                ),

            color:
                texto(
                    detalle.CODIGO_COLOR
                )
        });


    const url =
        `${baseUrl}/api/imagenes/archivo?${parametros.toString()}`;


    try {

        const respuesta =
            await fetch(
                url,
                {
                    headers: {
                        Accept:
                            'image/jpeg,image/png'
                    }
                }
            );


        if (
            !respuesta.ok
        ) {
            return null;
        }


        const contentType =
            texto(
                respuesta.headers
                    .get(
                        'content-type'
                    )
            ).toLowerCase();


        if (
            !contentType.includes(
                'image/jpeg'
            ) &&
            !contentType.includes(
                'image/png'
            )
        ) {
            return null;
        }


        const arrayBuffer =
            await respuesta.arrayBuffer();


        return {
            buffer:
                Buffer.from(
                    arrayBuffer
                ),

            extension:
                contentType.includes(
                    'png'
                )
                    ? 'png'
                    : 'jpeg'
        };

    } catch (_) {

        /*
         * El borrador debe poder generarse incluso si una imagen
         * puntual no está disponible.
         */
        return null;
    }
}


async function generarBorradorExcel(
    idAlta,
    baseUrl
) {

    const id =
        Number(
            idAlta
        );


    if (
        !Number.isInteger(
            id
        ) ||
        id <= 0
    ) {
        throw new Error(
            'ID_ALTA inválido.'
        );
    }


    const alta =
        await altasRepository
            .obtenerAltaPorId(
                id
            );


    if (
        !alta
    ) {
        throw new Error(
            'Alta no encontrada.'
        );
    }


    const estadoAlta =
        texto(alta.ESTADO).toUpperCase();


    if (
        !ESTADOS_HABILITADOS_EXCEL_ALTA.includes(estadoAlta)
    ) {
        throw new Error(
            `El Excel del Alta solamente puede generarse ` +
            `cuando está activo dentro del circuito de Alta.`
        );
    }


    const detallesTodos =
        await altasRepository
            .obtenerDetalleAlta(
                id
            );


    /*
     * Exportamos una sola fila por producto cargado por el usuario.
     * Los productos automáticos de la familia (primeras/segundas)
     * quedan excluidos para no repetir la misma imagen e información.
     * Esto contempla tanto MÓDULO como PAR SUELTO.
     */
    const productosPrincipales =
        (detallesTodos || [])
            .filter(
                detalle =>
                    !esValorVerdadero(
                        detalle.GENERADO_AUTOMATICO
                    )
            );


    if (
        productosPrincipales.length === 0
    ) {
        throw new Error(
            'El Alta no contiene productos para incluir en el Excel.'
        );
    }


    const ano =
        await altasRepository
            .buscarAno(
                alta.CODIGO_ANO
            );


    const detalleAno =
        texto(
            ano?.DETALLE_ANO
        ) ||
        texto(
            alta.CODIGO_ANO
        );


    const detalleRubro =
        texto(
            alta.DETALLE_RUBRO
        );


    const detalleTemporada =
        texto(
            alta.DETALLE_TEMPORADA
        );


    const codigoAlta =
        texto(
            alta.CODIGO_ALTA
        ) ||
        `ALTA_${id}`;


    const libro =
        new ExcelJS.Workbook();


    libro.creator =
        'PRODUCTOS_APP';

    libro.created =
        new Date();


    const hoja =
        libro.addWorksheet(
        estadoAlta !== 'BORRADOR'
            ? 'ALTA VALIDADA'
            : 'BORRADOR',
            {
                views: [
                    {
                        state:
                            'frozen',

                        ySplit:
                            3
                    }
                ],

                pageSetup: {
                    orientation:
                        'landscape',

                    fitToPage:
                        true,

                    fitToWidth:
                        1,

                    fitToHeight:
                        0,

                    margins: {
                        left:
                            0.25,

                        right:
                            0.25,

                        top:
                            0.4,

                        bottom:
                            0.4,

                        header:
                            0.2,

                        footer:
                            0.2
                    }
                }
            }
        );


    hoja.mergeCells(
        'A1:T2'
    );


    const titulo =
        hoja.getCell(
            'A1'
        );


    titulo.value =
        [
            estadoAlta !== 'BORRADOR'
                ? 'ALTA VALIDADA'
                : 'BORRADOR',
            codigoAlta,
            detalleAno,
            detalleTemporada,
            detalleRubro
        ]
            .filter(
                Boolean
            )
            .join(
                ' - '
            );


    titulo.font = {
        name:
            'Calibri',

        size:
            18,

        bold:
            true
    };


    titulo.alignment = {
        horizontal:
            'center',

        vertical:
            'middle'
    };


    titulo.fill = {
        type:
            'pattern',

        pattern:
            'solid',

        fgColor: {
            argb:
                'FFE9EEF5'
        }
    };


    titulo.border = {
        bottom: {
            style:
                'medium',

            color: {
                argb:
                    'FF7C8A99'
            }
        }
    };


    hoja.getRow(
        1
    ).height =
        26;

    hoja.getRow(
        2
    ).height =
        12;


    const encabezados = [
        'IMAGEN',
        'DETALLE RUBRO',
        'DETALLE AÑO',
        'DETALLE TEMPORADA',
        'DETALLE_MODELO',
        'DETALLE_CURVA',
        'PARES',
        'DETALLE_EDAD',
        'DETALLE_CLASIFICACION',
        'DETALLE_COLOR',
        'CODIGO_ALFA',
        'CO_NEW',
        'MUESTRA',
        'COMENTARIO',
        'CORRECCIONES',
        'MATERIAL_CALZADO',
        'MATERIAL_SUELA',
        'TIPO_AJUSTE',
        'DESCRIPCION',
        'FLOW'
    ];


    hoja.addRow(
        encabezados
    );


    const filaEncabezado =
        hoja.getRow(
            3
        );


    filaEncabezado.height =
        28;


    filaEncabezado.eachCell(
        celda => {

            celda.font = {
                name:
                    'Calibri',

                size:
                    11,

                bold:
                    true
            };


            celda.alignment = {
                horizontal:
                    'center',

                vertical:
                    'middle',

                wrapText:
                    true
            };


            celda.fill = {
                type:
                    'pattern',

                pattern:
                    'solid',

                fgColor: {
                    argb:
                        'FFDCE6F1'
                }
            };


            celda.border = {
                top: {
                    style:
                        'thin',

                    color: {
                        argb:
                            'FF9BA8B5'
                    }
                },

                left: {
                    style:
                        'thin',

                    color: {
                        argb:
                            'FF9BA8B5'
                    }
                },

                bottom: {
                    style:
                        'thin',

                    color: {
                        argb:
                            'FF9BA8B5'
                    }
                },

                right: {
                    style:
                        'thin',

                    color: {
                        argb:
                            'FF9BA8B5'
                    }
                }
            };
        }
    );


    hoja.columns = [
        {
            key:
                'imagen',

            width:
                24
        },
        {
            key:
                'rubro',

            width:
                20
        },
        {
            key:
                'ano',

            width:
                14
        },
        {
            key:
                'temporada',

            width:
                20
        },
        {
            key:
                'modelo',

            width:
                32
        },
        {
            key:
                'curva',

            width:
                32
        },
        {
            key:
                'pares',

            width:
                10
        },
        {
            key:
                'edad',

            width:
                18
        },
        {
            key:
                'clasificacion',

            width:
                22
        },
        {
            key:
                'color',

            width:
                24
        },
        {
            key: 'codigoAlfa',
            width: 28
        },
        {
            key: 'coNew',
            width: 18
        },
        {
            key: 'muestra',
            width: 18
        },
        {
            key: 'comentario',
            width: 32
        },
        {
            key: 'correcciones',
            width: 32
        },
        {
            key: 'materialCalzado',
            width: 24
        },
        {
            key: 'materialSuela',
            width: 24
        },
        {
            key: 'tipoAjuste',
            width: 22
        },
        {
            key: 'descripcion',
            width: 42
        },
        {
            key: 'flow',
            width: 20
        }
    ];


    for (
        const detalle
        of productosPrincipales
    ) {

        const fila =
            hoja.addRow([
                '',
                detalleRubro,
                detalleAno,
                detalleTemporada,
                texto(
                    detalle.DETALLE_MODELO
                ),
                texto(
                    detalle.DETALLE_MODULO ||
                    detalle.DETALLE_TALLE ||
                    detalle.CODIGO_MODULO ||
                    detalle.CODIGO_TALLE
                ),
                Number(
                    detalle.PARES || 0
                ),
                texto(
                    detalle.DETALLE_EDAD
                ),
                texto(
                    detalle.DETALLE_CLASIFICACION
                ),
                texto(
                    detalle.DETALLE_COLOR
                ),
                texto(detalle.CODIGO_ALFA),
                texto(detalle.CO_NEW),
                texto(detalle.MUESTRA),
                texto(detalle.COMENTARIO),
                texto(detalle.CORRECCIONES),
                texto(detalle.MATERIAL_CALZADO),
                texto(detalle.MATERIAL_SUELA),
                texto(detalle.TIPO_AJUSTE),
                texto(detalle.DESCRIPCION),
                texto(detalle.FLOW)
            ]);


        /*
         * 115 pt equivale aproximadamente a 153 px.
         * Deja una imagen generosa sin hacer gigantesco el archivo.
         */
        fila.height =
            115;


        fila.eachCell(
            {
                includeEmpty:
                    true
            },

            celda => {

                celda.alignment = {
                    horizontal:
                        celda.col === 7
                            ? 'center'
                            : 'left',

                    vertical:
                        'middle',

                    wrapText:
                        true
                };


                celda.border = {
                    top: {
                        style:
                            'thin',

                        color: {
                            argb:
                                'FFD9DEE4'
                        }
                    },

                    left: {
                        style:
                            'thin',

                        color: {
                            argb:
                                'FFD9DEE4'
                        }
                    },

                    bottom: {
                        style:
                            'thin',

                        color: {
                            argb:
                                'FFD9DEE4'
                        }
                    },

                    right: {
                        style:
                            'thin',

                        color: {
                            argb:
                                'FFD9DEE4'
                        }
                    }
                };
            }
        );


        fila.getCell(
            7
        ).font = {
            bold:
                true
        };


        const imagen =
            await cargarImagenModulo(
                baseUrl,
                alta,
                detalle
            );


        if (
            imagen
        ) {

            const idImagen =
                libro.addImage({
                    buffer:
                        imagen.buffer,

                    extension:
                        imagen.extension
                });


            /*
             * La imagen queda centrada visualmente dentro de la
             * primera columna con aprox. 145 x 145 px.
             */
            hoja.addImage(
                idImagen,
                {
                    tl: {
                        col:
                            0.12,

                        row:
                            fila.number -
                            1 +
                            0.07
                    },

                    ext: {
                        width:
                            145,

                        height:
                            145
                    },

                    editAs:
                        'oneCell'
                }
            );
        }
    }


    hoja.autoFilter = {
        from: {
            row:
                3,

            column:
                1
        },

        to: {
            row:
                3,

            column:
                20
        }
    };


    hoja.getColumn(
        1
    ).alignment = {
        horizontal:
            'center',

        vertical:
            'middle'
    };


    const buffer =
        await libro.xlsx
            .writeBuffer();


    return {
        buffer:
            Buffer.from(
                buffer
            ),

        nombreArchivo:
            `${estadoAlta !== 'BORRADOR' ? 'ALTA_VALIDADA' : 'BORRADOR'}_${limpiarNombreArchivo(
                codigoAlta
            )}.xlsx`,

        cantidadProductos:
            productosPrincipales.length,

        cantidadModulos:
            productosPrincipales.filter(
                detalle =>
                    normalizarTipoProducto(
                        detalle.TIPO_PRODUCTO_DETALLE ||
                        alta.TIPO_PRODUCTO
                    ) === 'MODULO'
            ).length,

        titulo:
            titulo.value
    };
}


module.exports = {
    generarBorradorExcel
};
