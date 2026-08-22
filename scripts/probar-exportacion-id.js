require('dotenv').config();

const fs = require('fs');
const path = require('path');

const exportacionRepository =
    require('../src/repositories/exportacion.repository');

const {
    escribirDBF
} =
    require('../src/services/dbfWriter.service');

const {
    escribirDBFGenerico
} =
    require('../src/services/dbfWriterGenerico.service');


const ftpService =
    require('../src/services/ftp.service');


function texto(valor) {

    if (
        valor === undefined ||
        valor === null
    ) {
        return '';
    }

    return String(valor).trim();
}


function normalizarTipoProducto(valor) {

    return texto(valor)
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}

function obtenerTalleERP(
    tipoProducto,
    detalle
) {

    if (
        tipoProducto === 'MODULO'
    ) {

        return texto(
            detalle.CODIGO_MODULO
        );
    }


    return texto(
        detalle.CODIGO_TALLE
    );
}

function obtenerDetalleTalleERP(
    tipoProducto,
    detalle
) {

    if (
        tipoProducto === 'MODULO'
    ) {

        return texto(
            detalle.DETALLE_MODULO
        );
    }


    return texto(
        detalle.DETALLE_TALLE
    );
}

function armarRegistroERP(
    alta,
    detalle
) {

    const tipoProducto =
        normalizarTipoProducto(
            detalle.TIPO_PRODUCTO_DETALLE ||
            alta.TIPO_PRODUCTO
        );


    return {

        DETALLE:
            texto(
                detalle.DETALLE_PRODUCTO
            ),


        NIVEL:
            Number(
                detalle.NIVEL
            ),


        FECHA_ALTA:
            detalle.FECHA_CREACION ||
            alta.FECHA_CREACION,


        COD_ALFA:
            texto(
                detalle.CODIGO_ALFA
            ),


        MARCA:
            Number(
                alta.CODIGO_MARCA
            ),


        COD_SUBG:
            texto(
                detalle.CODIGO_SUBGRUPO
            ),


        COD_TEM:
            texto(
                alta.CODIGO_TEMPORADA
            ),


        COD_GRUPOC:
            texto(
                detalle.CODIGO_GRUPO
            ),


        SEXO:
            texto(
                detalle.SEXO
            ),


        CLASIFIC:
            texto(
                detalle.CODIGO_CLASIFICACION
            ),


        COLORC:
            texto(
                detalle.CODIGO_COLOR
            ),


        LINEA:
            texto(
                detalle.CODIGO_LINEA
            ),


        MODC:
            texto(
                detalle.CODIGO_MODELO
            ),


        NOMB_ART:
            texto(
                detalle.DETALLE_MODELO
            ),


        ORIG_PRO:
            texto(
                detalle.CODIGO_ORIGEN
            ),


        RUBROS:
            texto(
                alta.DETALLE_RUBRO
            ),


        RUBRO:
            texto(
                alta.CODIGO_RUBRO
            ),


        TALLC:
            obtenerTalleERP(
                tipoProducto,
                detalle
            ),


        PARES:
            Number(
                detalle.PARES
            ),


        COD_ANO:
            texto(
                alta.CODIGO_ANO
            ),


        COD_EDAD:
            texto(
                detalle.CODIGO_EDAD
            ),


        RUBRO_FACT:
            texto(
                detalle.RUBRO_FACT
            ),


        PAIS:
            Number(
                detalle.CODIGO_PAIS
            ),


        COD_DISCIP:
            texto(
                detalle.CODIGO_DEPORTE
            ),


        LICENCIAS:
            texto(
                detalle.LICENCIA
            ),


        DCLASIFIC:
            texto(
                detalle.DETALLE_CLASIFICACION
            ),


        DCOD_TEM:
            texto(
                alta.DETALLE_TEMPORADA
            ),


        DCOLORC:
            texto(
                detalle.DETALLE_COLOR
            ),


        COSTO:
            0.001,


        DET_LINEA:
            texto(
                detalle.DETALLE_LINEA
            ),


        DET_ORIGEN:
            texto(
                detalle.DETALLE_ORIGEN
            ),


        DGRUPO:
            texto(
                detalle.DETALLE_GRUPO
            ),


        DISCIPLINA:
            texto(
                detalle.DETALLE_DEPORTE
            ),


        DMARCA:
            texto(
                alta.DETALLE_MARCA
            ),


        DMODC:
            texto(
                detalle.DETALLE_MODELO
            ),


        DSUBG:
            texto(
                detalle.DETALLE_SUBGRUPO
            ),


        DTALLC:
            obtenerDetalleTalleERP(
                tipoProducto,
                detalle
            ),


        EDAD:
            texto(
                detalle.DETALLE_EDAD
            )
    };
}

const camposRELFORMU = [

    {
        nombre: 'CA_ARTICUL',
        tipo: 'C',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'DETALLE',
        tipo: 'C',
        largo: 50,
        decimales: 0
    },

    {
        nombre: 'FORMULA',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'PROVEEDOR',
        tipo: 'N',
        largo: 6,
        decimales: 0
    },

    {
        nombre: 'DEPO_PROXI',
        tipo: 'C',
        largo: 1,
        decimales: 0
    },

    {
        nombre: 'DESARME',
        tipo: 'L',
        largo: 1,
        decimales: 0
    },

    {
        /*
         * El dato siempre se envía vacío.
         * El ancho solicitado es 15.
         */
        nombre: 'ARTICULO',
        tipo: 'N',
        largo: 15,
        decimales: 0
    }
];

const camposRELACION = [

    {
        nombre: 'ARTICULO',
        tipo: 'N',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'CANTIDAD',
        tipo: 'N',
        largo: 3,
        decimales: 0
    },

    {
        nombre: 'INSUMO',
        tipo: 'N',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'CA_ARTICUL',
        tipo: 'C',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'CA_INSUMO',
        tipo: 'C',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'DETAARTI',
        tipo: 'C',
        largo: 50,
        decimales: 0
    },

    {
        nombre: 'DETAINSU',
        tipo: 'C',
        largo: 50,
        decimales: 0
    },

    {
        nombre: 'MEDIDAARTI',
        tipo: 'C',
        largo: 2,
        decimales: 0
    },

    {
        nombre: 'MEDIDAINSU',
        tipo: 'C',
        largo: 2,
        decimales: 0
    },

    {
        nombre: 'FORMULA',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'ALTERNATIV',
        tipo: 'C',
        largo: 1,
        decimales: 0
    }
];

const mapaColumnaModuloPorTalle = {

    '01': 'T01',
    '02': 'T02',
    '03': 'T03',
    '04': 'T04',
    '05': 'T05',
    '06': 'T06',
    '07': 'T07',
    '08': 'T08',

    '10': 'T10',
    '12': 'T12',
    '14': 'T14',
    '15': 'T15',
    '16': 'T16',
    '17': 'T17',
    '18': 'T18',
    '19': 'T19',

    '20': 'T20',
    '21': 'T21',
    '22': 'T22',
    '23': 'T23',
    '24': 'T24',
    '25': 'T25',
    '26': 'T26',
    '27': 'T27',
    '28': 'T28',
    '29': 'T29',

    '30': 'T30',
    '31': 'T31',
    '32': 'T32',
    '33': 'T33',
    '34': 'T34',
    '35': 'T35',
    '36': 'T36',
    '37': 'T37',
    '38': 'T38',
    '38.5': 'T385',
    '39': 'T39',
    '39.5': 'T395',

    '40': 'T40',
    '40.5': 'T405',
    '41': 'T41',
    '41.5': 'T415',
    '42': 'T42',
    '42.5': 'T425',
    '43': 'T43',
    '43.5': 'T435',
    '44': 'T44',
    '44.5': 'T445',
    '45': 'T45',
    '45.5': 'T455',

    '46': 'T46',
    '47': 'T47',
    '48': 'T48',
    '49': 'T49',
    '50': 'T50',

    'XS': 'T_XS',
    'S': 'T_S',
    'M': 'T_M',
    'L': 'T_L',
    'XL': 'T_XL',
    '2XL': 'T_2XL',
    '3XL': 'T_3XL'
};

function obtenerColumnaCantidadModulo(
    relacion
) {

    const codigo =
        texto(
            relacion.CODIGO_TALLE_INSUMO
        ).toUpperCase();


    const detalle =
        texto(
            relacion.DETALLE_TALLE_INSUMO
        ).toUpperCase();


    if (
        codigo &&
        Object.prototype.hasOwnProperty.call(
            relacion,
            codigo
        )
    ) {

        return codigo;
    }


    if (
        mapaColumnaModuloPorTalle[
            codigo
        ]
    ) {

        return mapaColumnaModuloPorTalle[
            codigo
        ];
    }


    if (
        mapaColumnaModuloPorTalle[
            detalle
        ]
    ) {

        return mapaColumnaModuloPorTalle[
            detalle
        ];
    }


    if (
        codigo.startsWith('T_') &&
        Object.prototype.hasOwnProperty.call(
            relacion,
            codigo
        )
    ) {

        return codigo;
    }


    if (
        codigo.startsWith('T') &&
        Object.prototype.hasOwnProperty.call(
            relacion,
            codigo
        )
    ) {

        return codigo;
    }


    throw new Error(
        `No se pudo determinar la columna de cantidad ` +
        `para el talle "${detalle || codigo}" ` +
        `del módulo ${relacion.COD_ALFA_MODULO}.`
    );
}

function armarRegistrosRELFORMU(
    alta,
    detalles
) {

    return detalles
        .filter(
            detalle =>
                normalizarTipoProducto(
                    detalle.TIPO_PRODUCTO_DETALLE ||
                    alta.TIPO_PRODUCTO
                ) === 'MODULO'
        )
        .map(
            detalle => ({

                CA_ARTICUL:
                    texto(
                        detalle.CODIGO_ALFA
                    ),

                DETALLE:
                    texto(
                        detalle.DETALLE_PRODUCTO
                    ),

                FORMULA:
                    'EMBALAJE MODULO',

                PROVEEDOR:
                    80005,

                DEPO_PROXI:
                    'S',

                DESARME:
                    true,

                ARTICULO:
                    null
            })
        );
}

function armarRegistrosRELACION(
    relaciones
) {

    return relaciones.map(
        relacion => {

            const columnaCantidad =
                obtenerColumnaCantidadModulo(
                    relacion
                );


            const cantidad =
                Number(
                    relacion[
                        columnaCantidad
                    ] || 0
                );


            if (
                !Number.isInteger(
                    cantidad
                ) ||
                cantidad <= 0
            ) {

                throw new Error(
                    `Cantidad inválida para el insumo ` +
                    `${relacion.COD_ALFA_INSUMO} ` +
                    `del módulo ${relacion.COD_ALFA_MODULO}.`
                );
            }


            return {

                ARTICULO:
                    null,

                CANTIDAD:
                    cantidad,

                INSUMO:
                    null,

                CA_ARTICUL:
                    texto(
                        relacion.COD_ALFA_MODULO
                    ),

                CA_INSUMO:
                    texto(
                        relacion.COD_ALFA_INSUMO
                    ),

                DETAARTI:
                    texto(
                        relacion.DETALLE_PRODUCTO_MODULO
                    ),

                DETAINSU:
                    texto(
                        relacion.DETALLE_PRODUCTO_INSUMO
                    ),

                MEDIDAARTI:
                    '07',

                MEDIDAINSU:
                    '07',

                FORMULA:
                    'EMBALAJE MODULO',

                ALTERNATIV:
                    'N'
            };
        }
    );
}

const camposMODELOS = [

    {
        nombre: 'COD_MODELO',
        tipo: 'C',
        largo: 6,
        decimales: 0
    },

    {
        nombre: 'MODELO',
        tipo: 'C',
        largo: 60,
        decimales: 0
    },

    {
        nombre: 'MARCA',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'RUBRO',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'COD_CURVA',
        tipo: 'C',
        largo: 10,
        decimales: 0
    },

    {
        nombre: 'SUBGRUPO',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'TEMPORADA',
        tipo: 'C',
        largo: 20,
        decimales: 0
    },

    {
        nombre: 'CURVA',
        tipo: 'C',
        largo: 100,
        decimales: 0
    },

    {
        nombre: 'GRUPO',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'ANO',
        tipo: 'C',
        largo: 2,
        decimales: 0
    },

    {
        nombre: 'COLOR',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'LICENCIAS',
        tipo: 'C',
        largo: 30,
        decimales: 0
    },

    {
        nombre: 'CO_PROV',
        tipo: 'C',
        largo: 6,
        decimales: 0
    }
];

function armarRegistrosMODELOS(
    alta,
    detalles
) {

    const tipoAlta =
        normalizarTipoProducto(
            alta.TIPO_PRODUCTO
        );


    const registros = [];
    const claves = new Set();


    for (
        const detalle
        of detalles
    ) {

        const tipoDetalle =
            normalizarTipoProducto(
                detalle.TIPO_PRODUCTO_DETALLE ||
                alta.TIPO_PRODUCTO
            );


        if (
            tipoAlta === 'MODULO' &&
            tipoDetalle !== 'MODULO'
        ) {
            continue;
        }


        if (
            tipoAlta === 'PAR_SUELTO' &&
            tipoDetalle !== 'PAR_SUELTO'
        ) {
            continue;
        }


        const codigoCurva =
            tipoAlta === 'MODULO'
                ? texto(detalle.CODIGO_MODULO)
                : texto(detalle.CODIGO_TALLE);


        const curva =
            tipoAlta === 'MODULO'
                ? texto(detalle.DETALLE_MODULO)
                : texto(detalle.DETALLE_TALLE);


        const coProv =
            texto(
                detalle.CODIGO_PROVEEDOR
            );


        if (
            !coProv
        ) {
            throw new Error(
                `No se puede generar MODELOS: ` +
                `el proveedor seleccionado no tiene CODIGO (PBXXXX) ` +
                `informado en el maestro de proveedores.`
            );
        }


        const clave = [
            texto(detalle.CODIGO_MODELO),
            texto(detalle.CODIGO_COLOR),
            codigoCurva
        ].join('|');


        if (
            claves.has(
                clave
            )
        ) {
            continue;
        }


        claves.add(
            clave
        );


        registros.push({

            COD_MODELO:
                texto(
                    detalle.CODIGO_MODELO
                ),

            MODELO:
                texto(
                    detalle.DETALLE_MODELO
                ),

            MARCA:
                texto(
                    alta.DETALLE_MARCA
                ),

            RUBRO:
                texto(
                    alta.DETALLE_RUBRO
                ),

            COD_CURVA:
                codigoCurva,

            SUBGRUPO:
                texto(
                    detalle.DETALLE_SUBGRUPO
                ),

            TEMPORADA:
                texto(
                    alta.DETALLE_TEMPORADA
                ),

            CURVA:
                curva,

            GRUPO:
                texto(
                    detalle.DETALLE_GRUPO
                ),

            ANO:
                texto(
                    alta.CODIGO_ANO
                ),

            COLOR:
                texto(
                    detalle.DETALLE_COLOR
                ),

            LICENCIAS:
                texto(
                    detalle.LICENCIA
                ),

            CO_PROV:
                texto(
                    detalle.CODIGO_PROVEEDOR
                )
        });
    }


    return registros;
}

const camposPRIMERAS_SEGUNDAS = [

    {
        nombre: 'CODIGO',
        tipo: 'N',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'CODIGOR',
        tipo: 'N',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'COD_ALFA',
        tipo: 'C',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'COD_ALFAR',
        tipo: 'C',
        largo: 15,
        decimales: 0
    },

    {
        nombre: 'DETALLE',
        tipo: 'C',
        largo: 50,
        decimales: 0
    },

    {
        nombre: 'DETALLER',
        tipo: 'C',
        largo: 50,
        decimales: 0
    },

    {
        nombre: 'HABILITADO',
        tipo: 'L',
        largo: 1,
        decimales: 0
    }
];

function clavePrimeraSegunda(
    detalle
) {

    return [
        texto(detalle.CODIGO_MODELO),
        texto(detalle.CODIGO_COLOR),
        texto(detalle.CODIGO_TALLE),
        texto(detalle.SEXO).toUpperCase()
    ].join('|');
}

function armarRegistrosPRIMERAS_SEGUNDAS(
    alta,
    detalles
) {

    const primeras = new Map();
    const segundas = new Map();


    for (
        const detalle
        of detalles
    ) {

        const tipoDetalle =
            normalizarTipoProducto(
                detalle.TIPO_PRODUCTO_DETALLE ||
                alta.TIPO_PRODUCTO
            );


        if (
            tipoDetalle !== 'PAR_SUELTO'
        ) {
            continue;
        }


        const estado =
            texto(
                detalle.ESTADO_VALIDACION
            ).toUpperCase();


        if (
            ![
                'VALIDO',
                'EXPORTADO'
            ].includes(
                estado
            )
        ) {
            continue;
        }


        const clasificacion =
            texto(
                detalle.CODIGO_CLASIFICACION
            );


        if (
            ![
                '1',
                '2'
            ].includes(
                clasificacion
            )
        ) {
            continue;
        }


        const clave =
            clavePrimeraSegunda(
                detalle
            );


        if (
            clasificacion === '1'
        ) {

            if (
                primeras.has(
                    clave
                )
            ) {
                throw new Error(
                    `Existe más de una PRIMERA para ${clave}.`
                );
            }

            primeras.set(
                clave,
                detalle
            );

        } else {

            if (
                segundas.has(
                    clave
                )
            ) {
                throw new Error(
                    `Existe más de una SEGUNDA para ${clave}.`
                );
            }

            segundas.set(
                clave,
                detalle
            );
        }
    }


    const registros = [];


    for (
        const [
            clave,
            primera
        ]
        of primeras
    ) {

        const segunda =
            segundas.get(
                clave
            );


        if (
            !segunda
        ) {
            throw new Error(
                `No se encontró la SEGUNDA correspondiente a ` +
                `${primera.CODIGO_ALFA} (${clave}).`
            );
        }


        registros.push({

            CODIGO:
                null,

            CODIGOR:
                null,

            COD_ALFA:
                texto(
                    primera.CODIGO_ALFA
                ),

            COD_ALFAR:
                texto(
                    segunda.CODIGO_ALFA
                ),

            DETALLE:
                texto(
                    primera.DETALLE_PRODUCTO
                ),

            DETALLER:
                texto(
                    segunda.DETALLE_PRODUCTO
                ),

            HABILITADO:
                true
        });
    }


    return registros;
}


function generarDBI(
    rutaDBI,
    registros,
    campos = null,
    principal = false
) {

    const rutaDBF =
        rutaDBI.replace(
            /\.DBI$/i,
            '.DBF'
        );


    if (
        fs.existsSync(rutaDBF)
    ) {
        fs.unlinkSync(rutaDBF);
    }


    if (
        fs.existsSync(rutaDBI)
    ) {
        fs.unlinkSync(rutaDBI);
    }


    if (
        principal
    ) {

        escribirDBF(
            rutaDBF,
            registros
        );

    } else {

        escribirDBFGenerico(
            rutaDBF,
            registros,
            campos
        );
    }


    fs.renameSync(
        rutaDBF,
        rutaDBI
    );
}


async function main() {

    const idAlta =
        Number(
            process.argv[2]
        );


    if (
        !Number.isInteger(idAlta) ||
        idAlta <= 0
    ) {
        throw new Error(
            'Indicá un ID_ALTA válido. Ejemplo: node scripts/probar-exportacion-id.js 15 --ftp'
        );
    }


    const enviarFTP =
        process.argv
            .slice(3)
            .some(
                argumento =>
                    texto(argumento).toLowerCase() === '--ftp'
            );


    const alta =
        await exportacionRepository
            .obtenerAltaParaExportacion(
                idAlta
            );


    if (
        !alta
    ) {
        throw new Error(
            `No existe el ID_ALTA ${idAlta}.`
        );
    }


    const detallesTodos =
        await exportacionRepository
            .obtenerDetallesParaExportacion(
                idAlta
            );


    /*
     * PRUEBA SIN IMPACTO:
     * - VALIDO permite probar un Alta todavía no exportada.
     * - EXPORTADO permite regenerar los DBI de un Alta ya exportada.
     * - EXISTE_ERP queda siempre excluido porque no es producto nuevo.
     */
    const detalles =
        detallesTodos.filter(
            detalle =>
                [
                    'VALIDO',
                    'EXPORTADO'
                ].includes(
                    texto(
                        detalle.ESTADO_VALIDACION
                    ).toUpperCase()
                )
        );


    if (
        detalles.length === 0
    ) {
        throw new Error(
            `El ID_ALTA ${idAlta} no tiene productos nuevos ` +
            `con estado VALIDO/EXPORTADO para probar.`
        );
    }


    const registrosPRODUCTOS =
        detalles.map(
            detalle =>
                armarRegistroERP(
                    alta,
                    detalle
                )
        );


    const registrosMODELOS =
        armarRegistrosMODELOS(
            alta,
            detalles
        );


    const registrosPRIMERAS_SEGUNDAS =
        armarRegistrosPRIMERAS_SEGUNDAS(
            alta,
            detalles
        );


    const registrosRELFORMU =
        armarRegistrosRELFORMU(
            alta,
            detalles
        );


    let registrosRELACION = [];


    if (
        registrosRELFORMU.length > 0
    ) {

        const relaciones =
            await exportacionRepository
                .obtenerRelacionesModuloPrimeraPrueba(
                    idAlta
                );


        const codigosModulosExportados =
            new Set(
                registrosRELFORMU.map(
                    registro =>
                        texto(
                            registro.CA_ARTICUL
                        )
                )
            );


        const relacionesExportables =
            relaciones.filter(
                relacion =>
                    codigosModulosExportados.has(
                        texto(
                            relacion.COD_ALFA_MODULO
                        )
                    )
            );


        registrosRELACION =
            armarRegistrosRELACION(
                relacionesExportables
            );
    }


    const carpeta =
        path.join(
            process.cwd(),
            'salidas',
            `PRUEBA_ID_${idAlta}`
        );


    fs.mkdirSync(
        carpeta,
        {
            recursive: true
        }
    );


    const sufijo =
        `PRUEBA_ID_${idAlta}`;


    const archivos = [];


    const rutaPRODUCTOS =
        path.join(
            carpeta,
            `PRODUCTOS_${sufijo}.DBI`
        );


    generarDBI(
        rutaPRODUCTOS,
        registrosPRODUCTOS,
        null,
        true
    );


    archivos.push({
        nombre: 'PRODUCTOS',
        ruta: rutaPRODUCTOS,
        cantidad: registrosPRODUCTOS.length,
        nombreFTP:
            texto(
                process.env.FTP_REMOTE_FILENAME
            ) ||
            'ALTAS_PRODUCTOS.DBI'
    });


    const rutaMODELOS =
        path.join(
            carpeta,
            `MODELOS_${sufijo}.DBI`
        );


    generarDBI(
        rutaMODELOS,
        registrosMODELOS,
        camposMODELOS
    );


    archivos.push({
        nombre: 'MODELOS',
        ruta: rutaMODELOS,
        cantidad: registrosMODELOS.length,
        nombreFTP:
            texto(
                process.env.FTP_REMOTE_FILENAME_MODELOS
            ) ||
            'MODELOS_VICBOR_TBL_PRODBASE.DBI'
    });


    const rutaPRIMERAS_SEGUNDAS =
        path.join(
            carpeta,
            `PRIMERAS_SEGUNDAS_${sufijo}.DBI`
        );


    generarDBI(
        rutaPRIMERAS_SEGUNDAS,
        registrosPRIMERAS_SEGUNDAS,
        camposPRIMERAS_SEGUNDAS
    );


    archivos.push({
        nombre: 'PRIMERAS_SEGUNDAS',
        ruta: rutaPRIMERAS_SEGUNDAS,
        cantidad: registrosPRIMERAS_SEGUNDAS.length,
        nombreFTP:
            texto(
                process.env.FTP_REMOTE_FILENAME_PRIMERAS_SEGUNDAS
            ) ||
            'PRIMERAS_SEGUNDAS_ATOMIK.DBI'
    });


    if (
        registrosRELFORMU.length > 0
    ) {

        const rutaRELFORMU =
            path.join(
                carpeta,
                `RELFORMU_${sufijo}.DBI`
            );


        generarDBI(
            rutaRELFORMU,
            registrosRELFORMU,
            camposRELFORMU
        );


        archivos.push({
            nombre: 'RELFORMU',
            ruta: rutaRELFORMU,
            cantidad: registrosRELFORMU.length,
            nombreFTP:
                texto(
                    process.env.FTP_REMOTE_FILENAME_RELFORMU
                ) ||
                'PRODUCTOS_RELFORMU.DBI'
        });


        const rutaRELACION =
            path.join(
                carpeta,
                `RELACION_${sufijo}.DBI`
            );


        generarDBI(
            rutaRELACION,
            registrosRELACION,
            camposRELACION
        );


        archivos.push({
            nombre: 'RELACION',
            ruta: rutaRELACION,
            cantidad: registrosRELACION.length,
            nombreFTP:
                texto(
                    process.env.FTP_REMOTE_FILENAME_RELACION
                ) ||
                'PRODUCTOS_RELACION.DBI'
        });
    }


    const resultadosFTP = [];


    if (
        enviarFTP
    ) {

        console.log('');
        console.log('==============================================');
        console.log(' ENVIANDO ARCHIVOS DE PRUEBA AL FTP');
        console.log('==============================================');


        for (
            const archivo
            of archivos
        ) {

            console.log(
                `Subiendo ${archivo.nombre} -> ${archivo.nombreFTP}`
            );


            const resultadoFTP =
                await ftpService
                    .subirArchivo(
                        archivo.ruta,
                        path.basename(
                            archivo.ruta
                        ),
                        archivo.nombreFTP
                    );


            resultadosFTP.push({
                nombre:
                    archivo.nombre,

                nombreFTP:
                    archivo.nombreFTP,

                ...resultadoFTP
            });


            console.log(
                `OK: ${archivo.nombreFTP}`
            );
        }


        console.log('==============================================');
        console.log('');
    }


    console.log('');
    console.log('====================================================');
    console.log(
        enviarFTP
            ? ' PRUEBA COMPLETA DE DBI - CON ENVIO FTP'
            : ' PRUEBA COMPLETA DE DBI - LOCAL / SIN FTP'
    );
    console.log('====================================================');
    console.log(`ID_ALTA: ${idAlta}`);
    console.log(`CODIGO_ALTA: ${alta.CODIGO_ALTA}`);
    console.log(`Estado actual: ${alta.ESTADO}`);
    console.log(`Tipo: ${alta.TIPO_PRODUCTO}`);
    console.log('');
    console.log(
        `Productos considerados nuevos: ${detalles.length} ` +
        `(VALIDO/EXPORTADO)`
    );
    console.log(
        `Productos EXISTE_ERP excluidos: ` +
        `${detallesTodos.length - detalles.length}`
    );
    console.log('');


    for (
        const archivo
        of archivos
    ) {

        console.log(
            `${archivo.nombre}: ${archivo.cantidad} registro(s)`
        );

        console.log(
            `  Local: ${archivo.ruta}`
        );


        if (
            enviarFTP
        ) {
            console.log(
                `  FTP:   ${archivo.nombreFTP}`
            );
        }


        console.log('');
    }


    if (
        registrosRELFORMU.length === 0
    ) {
        console.log(
            'RELFORMU / RELACION: no corresponden porque no hay módulos nuevos.'
        );
        console.log('');
    }


    console.log('IMPORTANTE:');

    if (
        enviarFTP
    ) {
        console.log(
            `  - Se enviaron ${resultadosFTP.length} archivo(s) al FTP.`
        );
    } else {
        console.log(
            '  - NO se envió nada al FTP. Para enviarlos agregá --ftp.'
        );
    }

    console.log('  - NO se modificó el estado del Alta.');
    console.log('  - NO se modificaron estados de detalle.');
    console.log('  - NO se insertó ALTAS_PRODUCTOS_EXPORTADOS.');
    console.log('  - COSTO del archivo PRODUCTOS = 0.001.');
    console.log('====================================================');
    console.log('');


    process.exit(0);
}


main()
    .catch(
        error => {

            console.error('');
            console.error('ERROR PRUEBA EXPORTACION:');
            console.error(error.stack || error.message);
            console.error('');

            process.exit(1);
        }
    );
