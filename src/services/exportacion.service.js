const fs =
    require('fs');

const path =
    require('path');

const XLSX =
    require('xlsx');


const exportacionRepository =
    require('../repositories/exportacion.repository');


const ftpService =
    require('./ftp.service');


const {
    escribirDBF,
    camposERP
} =
    require('./dbfWriter.service');


const {
    escribirDBFGenerico
} =
    require('./dbfWriterGenerico.service');


/* ============================================================
   UTILIDADES
   ============================================================ */

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


function validarId(idAlta) {

    const id =
        Number(idAlta);


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


function limpiarNombreArchivo(valor) {

    return texto(valor)
        .replace(
            /[^A-Za-z0-9_-]/g,
            '_'
        );
}


/* ============================================================
   TALLE ERP
   ============================================================ */

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


/* ============================================================
   DESCRIPCION TALLE ERP
   ============================================================ */

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


/* ============================================================
   ARMAR REGISTRO ERP
   ============================================================ */

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
                alta.CODIGO_RUBRO
            ),


        RUBRO:
            texto(
                alta.DETALLE_RUBRO
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


/* ============================================================
   VALIDAR REGISTRO ERP
   ============================================================ */

function validarRegistroERP(
    registro,
    idDetalle
) {

    for (
        const campo
        of camposERP
    ) {

        const valor =
            registro[
                campo.nombre
            ];


        /* ====================================================
           CARACTER
           ==================================================== */

        if (
            campo.tipo === 'C'
        ) {

            const contenido =
                texto(valor);


            if (
                contenido.length >
                campo.largo
            ) {

                throw new Error(
                    `${campo.nombre} supera ` +
                    `${campo.largo} caracteres ` +
                    `en ID_DETALLE ${idDetalle}: ` +
                    `"${contenido}"`
                );
            }
        }


        /* ====================================================
           NUMERICO
           ==================================================== */

        if (
            campo.tipo === 'N' &&
            valor !== null &&
            valor !== undefined &&
            valor !== ''
        ) {

            const numero =
                Number(valor);


            if (
                !Number.isFinite(numero)
            ) {

                throw new Error(
                    `${campo.nombre} no es numérico ` +
                    `en ID_DETALLE ${idDetalle}.`
                );
            }
        }
    }


    /* ========================================================
       CONTROLES CLAVE
       ======================================================== */

    if (!registro.COD_ALFA) {

        throw new Error(
            `COD_ALFA vacío en ID_DETALLE ${idDetalle}.`
        );
    }


    if (
        registro.COD_ALFA.length !== 15
    ) {

        throw new Error(
            `COD_ALFA debe tener exactamente 15 caracteres. ` +
            `ID_DETALLE ${idDetalle}: ` +
            `"${registro.COD_ALFA}" ` +
            `(${registro.COD_ALFA.length} caracteres).`
        );
    }


    if (!registro.DETALLE) {

        throw new Error(
            `DETALLE vacío en ID_DETALLE ${idDetalle}.`
        );
    }


    if (!registro.MODC) {

        throw new Error(
            `MODC vacío en ID_DETALLE ${idDetalle}.`
        );
    }


    if (!registro.TALLC) {

        throw new Error(
            `TALLC vacío en ID_DETALLE ${idDetalle}.`
        );
    }


    if (
        !Number.isInteger(
            registro.PARES
        ) ||
        registro.PARES <= 0
    ) {

        throw new Error(
            `PARES inválido en ID_DETALLE ${idDetalle}.`
        );
    }


    if (
        !Number.isInteger(
            registro.MARCA
        )
    ) {

        throw new Error(
            `MARCA debe ser numérica en ID_DETALLE ${idDetalle}.`
        );
    }


    if (
        !Number.isInteger(
            registro.PAIS
        )
    ) {

        throw new Error(
            `PAIS debe ser numérico en ID_DETALLE ${idDetalle}.`
        );
    }
}



/* ============================================================
   ARCHIVOS AUXILIARES PRESEA
   RELFORMU / RELACION
   ============================================================ */

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


function validarArchivoAuxiliar(
    nombre,
    registros,
    campos
) {

    for (
        let indice = 0;
        indice < registros.length;
        indice++
    ) {

        const registro =
            registros[
                indice
            ];


        for (
            const campo
            of campos
        ) {

            const valor =
                registro[
                    campo.nombre
                ];


            if (
                campo.tipo === 'C'
            ) {

                const contenido =
                    texto(
                        valor
                    );


                if (
                    contenido.length >
                    campo.largo
                ) {

                    throw new Error(
                        `${nombre}: ${campo.nombre} supera ` +
                        `${campo.largo} caracteres en registro ${indice + 1}.`
                    );
                }
            }


            if (
                campo.tipo === 'N' &&
                valor !== null &&
                valor !== undefined &&
                valor !== ''
            ) {

                if (
                    !Number.isFinite(
                        Number(valor)
                    )
                ) {

                    throw new Error(
                        `${nombre}: ${campo.nombre} no es numérico ` +
                        `en registro ${indice + 1}.`
                    );
                }
            }
        }
    }
}


function validarCoberturaRelaciones(
    registrosRELFORMU,
    relaciones
) {

    if (
        registrosRELFORMU.length === 0
    ) {

        return;
    }


    const modulosConRelacion =
        new Set(
            relaciones.map(
                relacion =>
                    texto(
                        relacion.COD_ALFA_MODULO
                    )
            )
        );


    for (
        const modulo
        of registrosRELFORMU
    ) {

        if (
            !modulosConRelacion.has(
                modulo.CA_ARTICUL
            )
        ) {

            throw new Error(
                `El módulo ${modulo.CA_ARTICUL} no tiene ` +
                `relaciones con productos PRIMERA para generar RELACION.DBI.`
            );
        }
    }
}


/* ============================================================
   ARCHIVO MODELOS
   FTP: MODELOS_VICBOR_TBL_PRODBASE.DBI

   REGLA:
   - Alta MODULO: toma únicamente productos MODULO exportables.
   - Alta PAR_SUELTO: toma únicamente PAR_SUELTO exportables.
   - Se genera una sola fila por MODELO + COLOR + CURVA/TALLE.
   - CO_PROV proviene exclusivamente de CODIGO_PROVEEDOR,
     que corresponde al código PBXXXX del maestro Excel de proveedores.
   ============================================================ */

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


/* ============================================================
   ARCHIVO PRIMERAS / SEGUNDAS
   FTP: PRIMERAS_SEGUNDAS_ATOMIK.DBI

   REGLA:
   - No reconstruye COD_ALFA.
   - Usa los CODIGO_ALFA y DETALLE_PRODUCTO ya generados por el Alta.
   - Solo contempla productos NUEVOS / VALIDO.
   - Empareja PRIMERA (clasificación 1) con SEGUNDA (clasificación 2)
     del mismo modelo + color + talle + sexo.
   ============================================================ */

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
                'EXISTE_ERP'
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


        const estadoPrimera =
            texto(
                primera.ESTADO_VALIDACION
            ).toUpperCase();

        const estadoSegunda =
            texto(
                segunda.ESTADO_VALIDACION
            ).toUpperCase();


        /*
         * Si ambos productos ya existen en Presea no hay nada nuevo
         * que relacionar en este lote.
         *
         * Si al menos uno es VALIDO, generamos la relación usando
         * ambos CODIGO_ALFA, aunque su pareja ya exista en ERP.
         */
        if (
            estadoPrimera === 'EXISTE_ERP' &&
            estadoSegunda === 'EXISTE_ERP'
        ) {
            continue;
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




function archivoLocalValido(
    ruta
) {

    if (
        !fs.existsSync(
            ruta
        )
    ) {

        return false;
    }


    const estadisticas =
        fs.statSync(
            ruta
        );


    if (
        !estadisticas.isFile() ||
        estadisticas.size <= 0
    ) {

        throw new Error(
            `El DBI local pendiente no es válido: ${ruta}`
        );
    }


    return true;
}


function eliminarSiExiste(
    ruta
) {

    if (
        fs.existsSync(
            ruta
        )
    ) {

        fs.unlinkSync(
            ruta
        );
    }
}


/* ============================================================
   PREPARAR EXPORTACION
   ============================================================ */

async function prepararExportacion(
    idAlta
) {

    const id =
        validarId(
            idAlta
        );


    const alta =
        await exportacionRepository
            .obtenerAltaParaExportacion(
                id
            );


    if (!alta) {

        throw new Error(
            'Alta no encontrada.'
        );
    }


    if (
        texto(
            alta.ESTADO
        ).toUpperCase() !==
        'VALIDADO'
    ) {

        throw new Error(
            `El alta debe estar en estado VALIDADO. ` +
            `Estado actual: ${alta.ESTADO}.`
        );
    }


    const detallesTodos =
        await exportacionRepository
            .obtenerDetallesParaExportacion(
                id
            );


    if (
        !Array.isArray(detallesTodos)
    ) {

        throw new Error(
            'El repository no devolvió un array de detalles.'
        );
    }


    const estadosNoPermitidos =
        detallesTodos.filter(detalle => {
            const estado =
                texto(
                    detalle.ESTADO_VALIDACION
                ).toUpperCase();

            return ![
                'VALIDO',
                'EXISTE_ERP'
            ].includes(estado);
        });


    if (estadosNoPermitidos.length > 0) {
        const primero = estadosNoPermitidos[0];

        throw new Error(
            `El detalle ${primero.ID_DETALLE} tiene estado ` +
            `${primero.ESTADO_VALIDACION} y no puede procesarse.`
        );
    }


    const detalles =
        detallesTodos.filter(
            detalle =>
                texto(
                    detalle.ESTADO_VALIDACION
                ).toUpperCase() === 'VALIDO'
        );


    const existentesERP =
        detallesTodos.filter(
            detalle =>
                texto(
                    detalle.ESTADO_VALIDACION
                ).toUpperCase() === 'EXISTE_ERP'
        );


    if (
        detalles.length === 0
    ) {

        throw new Error(
            'El alta no contiene productos nuevos para exportar. ' +
            'Todos los productos ya existen en Presea.'
        );
    }


    const registros =
        [];


    for (
        const detalle
        of detalles
    ) {


        const registro =
            armarRegistroERP(
                alta,
                detalle
            );


        validarRegistroERP(
            registro,
            detalle.ID_DETALLE
        );


        registros.push(
            registro
        );
    }


    return {

        alta,

        detalles,
        detallesTodos,
        existentesERP,

        registros
    };
}


/* ============================================================
   PREVIEW
   ============================================================ */

async function obtenerPreview(
    idAlta
) {

    const {
        alta,
        detalles,
        detallesTodos,
        existentesERP,
        registros
    } =
        await prepararExportacion(
            idAlta
        );


    return {

        idAlta:
            alta.ID_ALTA,

        codigoAlta:
            alta.CODIGO_ALTA,

        tipoProducto:
            normalizarTipoProducto(
                alta.TIPO_PRODUCTO
            ),

        estado:
            alta.ESTADO,

        cantidadDetalles:
            detallesTodos.length,

        cantidadExistentesERP:
            existentesERP.length,

        cantidadAExportar:
            detalles.length,

        cantidadRegistros:
            registros.length,

        cantidadCampos:
            camposERP.length,

        campos:
            camposERP.map(
                campo => ({

                    nombre:
                        campo.nombre,

                    tipo:
                        campo.tipo,

                    largo:
                        campo.largo,

                    decimales:
                        campo.decimales || 0
                })
            ),

        registros
    };
}


/* ============================================================
   EXPORTAR PREVIEW A EXCEL
   ============================================================ */

async function exportarPreviewExcel(
    idAlta
) {

    const preview =
        await obtenerPreview(
            idAlta
        );


    const campos =
        Array.isArray(
            preview.campos
        )
            ? preview.campos
            : [];


    const registros =
        Array.isArray(
            preview.registros
        )
            ? preview.registros
            : [];


    const nombresCampos =
        campos.map(
            campo =>
                campo.nombre
        );


    const filas =
        registros.map(
            registro => {

                const fila = {};

                for (
                    const nombre
                    of nombresCampos
                ) {

                    const valor =
                        registro[
                            nombre
                        ];

                    fila[
                        nombre
                    ] =
                        valor === undefined ||
                        valor === null
                            ? ''
                            : valor;
                }

                return fila;
            }
        );


    const libro =
        XLSX.utils.book_new();


    /*
     * Hoja principal:
     * mismos campos, mismo orden y mismos registros
     * que el Preview / DBI.
     */
    const hojaPreview =
        XLSX.utils.json_to_sheet(
            filas,
            {
                header:
                    nombresCampos,
                skipHeader:
                    false
            }
        );


    if (
        nombresCampos.length > 0
    ) {

        const ultimaFila =
            Math.max(
                1,
                filas.length + 1
            );

        hojaPreview[
            '!autofilter'
        ] = {
            ref:
                XLSX.utils.encode_range({
                    s: {
                        r: 0,
                        c: 0
                    },
                    e: {
                        r:
                            ultimaFila - 1,
                        c:
                            nombresCampos.length - 1
                    }
                })
        };


        hojaPreview[
            '!cols'
        ] =
            nombresCampos.map(
                nombre => {

                    let ancho =
                        Math.max(
                            10,
                            String(
                                nombre
                            ).length + 2
                        );


                    for (
                        const fila
                        of filas.slice(
                            0,
                            300
                        )
                    ) {

                        ancho =
                            Math.max(
                                ancho,
                                Math.min(
                                    45,
                                    String(
                                        fila[
                                            nombre
                                        ] ?? ''
                                    ).length + 2
                                )
                            );
                    }


                    return {
                        wch:
                            Math.min(
                                45,
                                ancho
                            )
                    };
                }
            );
    }


    XLSX.utils.book_append_sheet(
        libro,
        hojaPreview,
        'PREVIEW_DBI'
    );


    /*
     * Hoja de control del lote.
     */
    const resumen = [
        [
            'DATO',
            'VALOR'
        ],
        [
            'ID_ALTA',
            preview.idAlta
        ],
        [
            'CODIGO_ALTA',
            preview.codigoAlta
        ],
        [
            'TIPO_PRODUCTO',
            preview.tipoProducto
        ],
        [
            'ESTADO',
            preview.estado
        ],
        [
            'PRODUCTOS_EXPORTABLES',
            preview.cantidadRegistros
        ],
        [
            'CAMPOS_ERP',
            preview.cantidadCampos
        ],
        [
            'GENERADO_EN',
            new Date()
        ]
    ];


    const hojaResumen =
        XLSX.utils.aoa_to_sheet(
            resumen
        );


    hojaResumen[
        '!cols'
    ] = [
        {
            wch:
                24
        },
        {
            wch:
                40
        }
    ];


    XLSX.utils.book_append_sheet(
        libro,
        hojaResumen,
        'RESUMEN'
    );


    const buffer =
        XLSX.write(
            libro,
            {
                type:
                    'buffer',
                bookType:
                    'xlsx',
                compression:
                    true
            }
        );


    const codigoAlta =
        limpiarNombreArchivo(
            preview.codigoAlta ||
            `ALTA_${preview.idAlta}`
        );


    return {
        buffer,

        nombreArchivo:
            `PREVIEW_DBI_${codigoAlta}.xlsx`,

        cantidadRegistros:
            preview.cantidadRegistros,

        cantidadCampos:
            preview.cantidadCampos
    };
}


/* ============================================================
   EXPORTAR DBF -> DBI
   ============================================================ */

async function exportar(
    idAlta,
    datosEntrada = {}
) {

    const usuario =
        texto(
            datosEntrada.usuario
        ) || 'SISTEMA';


    const preparacion =
        await prepararExportacion(
            idAlta
        );


    const alta =
        preparacion.alta;


    const detalles =
        preparacion.detalles;


    const detallesTodos =
        preparacion.detallesTodos;


    const registros =
        preparacion.registros;


    if (
        !Array.isArray(
            detalles
        ) ||
        !Array.isArray(
            registros
        )
    ) {

        throw new Error(
            'Los detalles y registros de exportación deben ser arrays.'
        );
    }


    if (
        detalles.length !==
        registros.length
    ) {

        throw new Error(
            `Cantidad inconsistente: ` +
            `${detalles.length} detalles / ` +
            `${registros.length} registros ERP.`
        );
    }


    /*
     * RELFORMU contiene únicamente los módulos nuevos/exportables.
     */
    const registrosRELFORMU =
        armarRegistrosRELFORMU(
            alta,
            detalles
        );


    let relacionesModuloPrimera =
        [];


    let registrosRELACION =
        [];


    if (
        registrosRELFORMU.length > 0
    ) {

        relacionesModuloPrimera =
            await exportacionRepository
                .obtenerRelacionesModuloPrimera(
                    alta.ID_ALTA
                );


        validarCoberturaRelaciones(
            registrosRELFORMU,
            relacionesModuloPrimera
        );


        registrosRELACION =
            armarRegistrosRELACION(
                relacionesModuloPrimera
            );


        validarArchivoAuxiliar(
            'RELFORMU',
            registrosRELFORMU,
            camposRELFORMU
        );


        validarArchivoAuxiliar(
            'RELACION',
            registrosRELACION,
            camposRELACION
        );
    }


    const registrosMODELOS =
        armarRegistrosMODELOS(
            alta,
            detalles
        );


    if (
        registrosMODELOS.length === 0
    ) {
        throw new Error(
            'No se pudieron generar registros para MODELOS.'
        );
    }


    validarArchivoAuxiliar(
        'MODELOS',
        registrosMODELOS,
        camposMODELOS
    );


    const registrosPRIMERAS_SEGUNDAS =
        armarRegistrosPRIMERAS_SEGUNDAS(
            alta,
            detallesTodos
        );


    if (
        registrosPRIMERAS_SEGUNDAS.length === 0
    ) {
        throw new Error(
            'No se pudieron generar relaciones PRIMERA / SEGUNDA.'
        );
    }


    validarArchivoAuxiliar(
        'PRIMERAS_SEGUNDAS',
        registrosPRIMERAS_SEGUNDAS,
        camposPRIMERAS_SEGUNDAS
    );


    const carpeta =
        process.env.EXPORT_PATH ||
        path.join(
            process.cwd(),
            'salidas'
        );


    fs.mkdirSync(
        carpeta,
        {
            recursive: true
        }
    );


    const codigoAlta =
        limpiarNombreArchivo(
            alta.CODIGO_ALTA
        );


    const definiciones = [

        {
            clave:
                'PRODUCTOS',

            nombreBase:
                `PRODUCTOS_${codigoAlta}`,

            registros,

            campos:
                null,

            nombreFTP:
                texto(
                    process.env.FTP_REMOTE_FILENAME
                ) ||
                'ALTAS_PRODUCTOS.DBI',

            principal:
                true
        },

        {
            clave:
                'MODELOS',

            nombreBase:
                `MODELOS_${codigoAlta}`,

            registros:
                registrosMODELOS,

            campos:
                camposMODELOS,

            nombreFTP:
                texto(
                    process.env.FTP_REMOTE_FILENAME_MODELOS
                ) ||
                'MODELOS_VICBOR_TBL_PRODBASE.DBI',

            principal:
                false
        },

        {
            clave:
                'PRIMERAS_SEGUNDAS',

            nombreBase:
                `PRIMERAS_SEGUNDAS_${codigoAlta}`,

            registros:
                registrosPRIMERAS_SEGUNDAS,

            campos:
                camposPRIMERAS_SEGUNDAS,

            nombreFTP:
                texto(
                    process.env.FTP_REMOTE_FILENAME_PRIMERAS_SEGUNDAS
                ) ||
                'PRIMERAS_SEGUNDAS_ATOMIK.DBI',

            principal:
                false
        }
    ];


    /*
     * Los dos archivos auxiliares existen solamente cuando
     * el Alta exporta al menos un producto MODULO.
     */
    if (
        registrosRELFORMU.length > 0
    ) {

        definiciones.push(
            {
                clave:
                    'RELFORMU',

                nombreBase:
                    `RELFORMU_${codigoAlta}`,

                registros:
                    registrosRELFORMU,

                campos:
                    camposRELFORMU,

                nombreFTP:
                    texto(
                        process.env.FTP_REMOTE_FILENAME_RELFORMU
                    ) ||
                    'PRODUCTOS_RELFORMU.DBI',

                principal:
                    false
            },

            {
                clave:
                    'RELACION',

                nombreBase:
                    `RELACION_${codigoAlta}`,

                registros:
                    registrosRELACION,

                campos:
                    camposRELACION,

                nombreFTP:
                    texto(
                        process.env.FTP_REMOTE_FILENAME_RELACION
                    ) ||
                    'PRODUCTOS_RELACION.DBI',

                principal:
                    false
            }
        );
    }


    for (
        const definicion
        of definiciones
    ) {

        definicion.archivoDBF =
            `${definicion.nombreBase}.DBF`;


        definicion.archivoDBI =
            `${definicion.nombreBase}.DBI`;


        definicion.rutaDBF =
            path.join(
                carpeta,
                definicion.archivoDBF
            );


        definicion.rutaDBI =
            path.join(
                carpeta,
                definicion.archivoDBI
            );


        /*
         * Un DBF intermedio nunca se reutiliza.
         */
        try {

            eliminarSiExiste(
                definicion.rutaDBF
            );

        } catch (_) {

            // La generación posterior dará un error descriptivo.
        }


        definicion.reutilizandoArchivoLocal =
            archivoLocalValido(
                definicion.rutaDBI
            );
    }


    const resultadosFTP =
        [];


    let resultadoDBFPrincipal =
        null;


    try {

        /* ====================================================
           GENERAR TODOS LOS ARCHIVOS LOCALES
           ==================================================== */

        for (
            const definicion
            of definiciones
        ) {

            if (
                definicion.reutilizandoArchivoLocal
            ) {

                continue;
            }


            let resultadoDBF;


            if (
                definicion.principal
            ) {

                resultadoDBF =
                    escribirDBF(
                        definicion.rutaDBF,
                        definicion.registros
                    );


                resultadoDBFPrincipal =
                    resultadoDBF;

            } else {

                resultadoDBF =
                    escribirDBFGenerico(
                        definicion.rutaDBF,
                        definicion.registros,
                        definicion.campos
                    );
            }


            fs.renameSync(
                definicion.rutaDBF,
                definicion.rutaDBI
            );


            definicion.resultadoDBF =
                resultadoDBF;
        }


        /* ====================================================
           ENVIAR TODOS LOS DBI AL FTP

           Si cualquiera falla:
           - no se registra exportación SQL;
           - el Alta sigue VALIDADO;
           - los DBI locales quedan para reintento.
           ==================================================== */

        for (
            const definicion
            of definiciones
        ) {

            const resultadoFTP =
                await ftpService
                    .subirArchivo(
                        definicion.rutaDBI,
                        definicion.archivoDBI,
                        definicion.nombreFTP
                    );


            resultadosFTP.push({
                clave:
                    definicion.clave,

                ...resultadoFTP
            });
        }


        /*
         * SQL se actualiza recién cuando TODOS los archivos
         * requeridos llegaron al FTP correctamente.
         */
        const definicionPrincipal =
            definiciones.find(
                item =>
                    item.principal
            );


        const altaExportada =
            await exportacionRepository
                .registrarExportacion(

                    alta.ID_ALTA,

                    detalles,

                    registros,

                    definicionPrincipal.archivoDBI,

                    usuario
                );


        const ftpPrincipal =
            resultadosFTP.find(
                item =>
                    item.clave === 'PRODUCTOS'
            ) ||
            {};


        return {

            idAlta:
                alta.ID_ALTA,

            codigoAlta:
                alta.CODIGO_ALTA,

            tipoProducto:
                normalizarTipoProducto(
                    alta.TIPO_PRODUCTO
                ),

            estadoAnterior:
                'VALIDADO',

            estado:
                altaExportada.ESTADO,

            archivo:
                definicionPrincipal.archivoDBI,

            ruta:
                definicionPrincipal.rutaDBI,

            archivos:
                definiciones.map(
                    definicion => ({

                        tipo:
                            definicion.clave,

                        archivo:
                            definicion.archivoDBI,

                        ruta:
                            definicion.rutaDBI,

                        cantidadRegistros:
                            definicion.registros.length,

                        reutilizandoArchivoLocal:
                            definicion.reutilizandoArchivoLocal,

                        archivoFTP:
                            definicion.nombreFTP
                    })
                ),

            cantidadArchivos:
                definiciones.length,

            cantidadDetalles:
                detalles.length,

            cantidadRegistros:
                registros.length,

            cantidadModulosRELFORMU:
                registrosRELFORMU.length,

            cantidadRelaciones:
                registrosRELACION.length,

            cantidadModelos:
                registrosMODELOS.length,

            cantidadPrimerasSegundas:
                registrosPRIMERAS_SEGUNDAS.length,

            campos:
                resultadoDBFPrincipal
                    ? resultadoDBFPrincipal.campos
                    : camposERP.length,

            largoRegistro:
                resultadoDBFPrincipal
                    ? resultadoDBFPrincipal.largoRegistro
                    : null,

            largoCabecera:
                resultadoDBFPrincipal
                    ? resultadoDBFPrincipal.largoCabecera
                    : null,

            reutilizandoArchivoLocal:
                definicionPrincipal.reutilizandoArchivoLocal,

            /*
             * Conservamos las propiedades antiguas del FTP principal
             * para compatibilidad con el frontend existente y agregamos
             * la colección completa.
             */
            ftp: {

                ...ftpPrincipal,

                enviados:
                    resultadosFTP.length,

                archivos:
                    resultadosFTP
            }
        };


    } catch (error) {

        /*
         * Eliminamos solo DBF intermedios.
         * Los DBI terminados se conservan para reintentar FTP.
         */
        for (
            const definicion
            of definiciones
        ) {

            try {

                eliminarSiExiste(
                    definicion.rutaDBF
                );

            } catch (
                errorLimpieza
            ) {

                console.error(
                    `Error eliminando DBF intermedio ${definicion.archivoDBF}:`,
                    errorLimpieza
                );
            }
        }


        throw error;
    }
}


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {

    obtenerPreview,

    exportarPreviewExcel,

    exportar
};