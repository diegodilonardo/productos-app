require('dotenv').config();

const fs =
    require('fs');

const path =
    require('path');

const exportacionRepository =
    require('../src/repositories/exportacion.repository');

const {
    escribirDBFGenerico
} =
    require('../src/services/dbfWriterGenerico.service');

const {
    escribirDBF
} =
    require('../src/services/dbfWriter.service');


function texto(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return '';
    }


    return String(valor).trim();
}


function normalizarTipoProducto(
    valor
) {

    return texto(
        valor
    )
        .toUpperCase()
        .replace(
            /[\s-]+/g,
            '_'
        );
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


    throw new Error(
        `No se pudo determinar la columna de cantidad para el talle ` +
        `"${detalle || codigo}" del módulo ${relacion.COD_ALFA_MODULO}.`
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
                    `Cantidad inválida para ${relacion.COD_ALFA_INSUMO} ` +
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
                        relacion.DETALLE_MODULO
                    ),

                DETAINSU:
                    texto(
                        relacion.DETALLE_INSUMO
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



/* ============================================================
   DBF VACIO CON ESTRUCTURA
   ============================================================ */

function escribirDBFVacio(
    rutaArchivo,
    campos
) {

    if (
        !Array.isArray(campos) ||
        campos.length === 0
    ) {

        throw new Error(
            'No hay definición de campos para generar el DBF vacío.'
        );
    }


    const cantidadCampos =
        campos.length;


    const largoCabecera =
        32 +
        (
            cantidadCampos * 32
        ) +
        1;


    const largoRegistro =
        1 +
        campos.reduce(
            (
                total,
                campo
            ) =>
                total +
                Number(
                    campo.largo || 0
                ),
            0
        );


    /*
     * Sin registros:
     * cabecera + EOF.
     */
    const buffer =
        Buffer.alloc(
            largoCabecera + 1,
            0
        );


    /*
     * dBASE III
     */
    buffer[0] =
        0x03;


    const ahora =
        new Date();


    buffer[1] =
        ahora.getFullYear() - 1900;

    buffer[2] =
        ahora.getMonth() + 1;

    buffer[3] =
        ahora.getDate();


    /*
     * Cantidad de registros = 0.
     */
    buffer.writeUInt32LE(
        0,
        4
    );


    buffer.writeUInt16LE(
        largoCabecera,
        8
    );


    buffer.writeUInt16LE(
        largoRegistro,
        10
    );


    /*
     * Driver ANSI / Windows.
     */
    buffer[29] =
        0x57;


    let offset =
        32;


    for (
        const campo
        of campos
    ) {

        const descriptor =
            Buffer.alloc(
                32,
                0
            );


        const nombre =
            Buffer.from(
                String(
                    campo.nombre || ''
                ),
                'ascii'
            );


        nombre
            .subarray(
                0,
                11
            )
            .copy(
                descriptor,
                0
            );


        descriptor[11] =
            String(
                campo.tipo || 'C'
            )
                .charAt(0)
                .charCodeAt(0);


        descriptor[16] =
            Number(
                campo.largo || 0
            );


        descriptor[17] =
            Number(
                campo.decimales || 0
            );


        descriptor.copy(
            buffer,
            offset
        );


        offset +=
            32;
    }


    /*
     * Fin de descriptores.
     */
    buffer[offset] =
        0x0d;


    /*
     * EOF DBF.
     */
    buffer[
        largoCabecera
    ] =
        0x1a;


    fs.writeFileSync(
        rutaArchivo,
        buffer
    );
}


function escribirDBFGenericoPermitiendoVacio(
    rutaArchivo,
    registros,
    campos
) {

    if (
        Array.isArray(registros) &&
        registros.length > 0
    ) {

        return escribirDBFGenerico(
            rutaArchivo,
            registros,
            campos
        );
    }


    escribirDBFVacio(
        rutaArchivo,
        campos
    );


    return {
        campos:
            campos.length,

        registros:
            0
    };
}


async function main() {

    const idAlta =
        Number(
            process.argv[2] || 1
        );


    if (
        !Number.isInteger(
            idAlta
        ) ||
        idAlta <= 0
    ) {

        throw new Error(
            'Indicá un ID_ALTA válido. Ejemplo: node scripts/probar-exportacion-id.js 1'
        );
    }


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
     * Para esta prueba NO importa el estado del Alta.
     * Se toman los productos que originalmente formaron parte
     * de la exportación o que siguen siendo exportables.
     */
    const detalles =
        detallesTodos.filter(
            detalle => [
                'VALIDO',
                'EXPORTADO',
                'EXISTE_ERP'
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
            `El ID_ALTA ${idAlta} no tiene detalles VALIDO/EXPORTADO/EXISTE_ERP para probar.`
        );
    }


    const relaciones =
        await exportacionRepository
            .obtenerRelacionesModuloPrimeraPrueba(
                idAlta
            );


    const registrosRELFORMU =
        armarRegistrosRELFORMU(
            alta,
            detalles
        );


    /*
     * Si el Alta no contiene productos MODULO (por ejemplo PAR_SUELTO),
     * RELFORMU y RELACION se generan igualmente con 0 registros.
     * El escritor genérico conserva la estructura correcta del DBI.
     */


    /*
     * IMPORTANTE:
     * RELACION debe incluir solamente módulos que realmente forman
     * parte de RELFORMU / de la exportación.
     *
     * En lotes históricos puede haber módulos EXISTE_ERP dentro del
     * mismo ID_ALTA. Esos módulos no deben aparecer en RELACION.
     */
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


    const registrosRELACION =
        armarRegistrosRELACION(
            relacionesExportables
        );


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


    const rutaRELFORMU =
        path.join(
            carpeta,
            `RELFORMU_${sufijo}.DBI`
        );


    const rutaRELACION =
        path.join(
            carpeta,
            `RELACION_${sufijo}.DBI`
        );


    escribirDBFGenericoPermitiendoVacio(
        rutaRELFORMU,
        registrosRELFORMU,
        camposRELFORMU
    );


    escribirDBFGenericoPermitiendoVacio(
        rutaRELACION,
        registrosRELACION,
        camposRELACION
    );


    console.log('');
    console.log('==============================================');
    console.log(' PRUEBA DE EXPORTACION SIN IMPACTO');
    console.log('==============================================');
    console.log(`ID_ALTA: ${idAlta}`);
    console.log(`Estado actual del Alta: ${alta.ESTADO}`);
    console.log(`Tipo de Alta: ${alta.TIPO_PRODUCTO}`);
    console.log('');
    console.log(`RELFORMU: ${registrosRELFORMU.length} registro(s)`);
    console.log(`  ${rutaRELFORMU}`);
    console.log('');
    console.log(`RELACION: ${registrosRELACION.length} registro(s)`);
    console.log(`  ${rutaRELACION}`);

    if (
        registrosRELFORMU.length === 0 &&
        registrosRELACION.length === 0
    ) {
        console.log('');
        console.log(
            'Alta sin relaciones de MODULO: se generaron ambos DBI vacíos con su estructura.'
        );
    }

    if (
        relaciones.length !==
        relacionesExportables.length
    ) {

        console.log(
            `  Relaciones excluidas por pertenecer a módulos no exportados: ` +
            `${relaciones.length - relacionesExportables.length}`
        );
    }
    console.log('');
    console.log('NO se envió nada al FTP.');
    console.log('NO se modificó el estado del Alta.');
    console.log('NO se modificaron estados de detalle.');
    console.log('NO se insertó ALTAS_PRODUCTOS_EXPORTADOS.');
    console.log('==============================================');
    console.log('');


    process.exit(
        0
    );
}


main()
    .catch(
        error => {

            console.error('');
            console.error(
                'ERROR PRUEBA EXPORTACION:'
            );
            console.error(
                error.message
            );
            console.error('');

            process.exit(
                1
            );
        }
    );
