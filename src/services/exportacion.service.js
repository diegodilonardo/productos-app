const fs =
    require('fs');

const path =
    require('path');


const exportacionRepository =
    require('../repositories/exportacion.repository');


const {
    escribirDBF,
    camposERP
} =
    require('./dbfWriter.service');


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
            0,


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


    /* ========================================================
       OBTENER ARRAYS
       ======================================================== */

    const preparacion =
        await prepararExportacion(
            idAlta
        );


    const alta =
        preparacion.alta;


    const detalles =
        preparacion.detalles;


    const registros =
        preparacion.registros;


    /* ========================================================
       CONTROLES EXPLICITOS
       ======================================================== */

    if (
        !Array.isArray(
            detalles
        )
    ) {

        throw new Error(
            'detalles no es un array antes de exportar.'
        );
    }


    if (
        !Array.isArray(
            registros
        )
    ) {

        throw new Error(
            'registros no es un array antes de exportar.'
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


    /* ========================================================
       CARPETA
       ======================================================== */

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


    /* ========================================================
       NOMBRE ARCHIVO
       ======================================================== */

    const codigoAlta =
        limpiarNombreArchivo(
            alta.CODIGO_ALTA
        );


    const nombreBase =
        `PRODUCTOS_${codigoAlta}`;


    const archivoDBF =
        `${nombreBase}.DBF`;


    const archivoDBI =
        `${nombreBase}.DBI`;


    const rutaDBF =
        path.join(
            carpeta,
            archivoDBF
        );


    const rutaDBI =
        path.join(
            carpeta,
            archivoDBI
        );


    /* ========================================================
       NO SOBREESCRIBIR
       ======================================================== */

    if (
        fs.existsSync(
            rutaDBF
        ) ||
        fs.existsSync(
            rutaDBI
        )
    ) {

        throw new Error(
            `Ya existe un archivo de exportación ` +
            `para el alta ${alta.CODIGO_ALTA}.`
        );
    }


    try {

        /* ====================================================
           CREAR DBF
           ==================================================== */

        const resultadoDBF =
            escribirDBF(
                rutaDBF,
                registros
            );


        /* ====================================================
           RENOMBRAR A DBI
           ==================================================== */

        fs.renameSync(
            rutaDBF,
            rutaDBI
        );


        /* ====================================================
           REGISTRAR EN SQL

           MUY IMPORTANTE:
           SON 5 PARAMETROS
           ==================================================== */

        const altaExportada =
            await exportacionRepository
                .registrarExportacion(

                    alta.ID_ALTA,

                    detalles,

                    registros,

                    archivoDBI,

                    usuario
                );


        /* ====================================================
           RESPUESTA
           ==================================================== */

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
                archivoDBI,

            ruta:
                rutaDBI,

            cantidadDetalles:
                detalles.length,

            cantidadRegistros:
                registros.length,

            campos:
                resultadoDBF.campos,

            largoRegistro:
                resultadoDBF.largoRegistro,

            largoCabecera:
                resultadoDBF.largoCabecera
        };


    } catch (error) {

        /* ====================================================
           LIMPIAR ARCHIVOS SI SQL FALLA
           ==================================================== */

        try {

            if (
                fs.existsSync(
                    rutaDBF
                )
            ) {

                fs.unlinkSync(
                    rutaDBF
                );
            }


            if (
                fs.existsSync(
                    rutaDBI
                )
            ) {

                fs.unlinkSync(
                    rutaDBI
                );
            }

        } catch (
            errorLimpieza
        ) {

            console.error(
                'Error eliminando archivo incompleto:',
                errorLimpieza
            );
        }


        throw error;
    }
}


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {

    obtenerPreview,

    exportar
};