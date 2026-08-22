const fs =
    require('fs');

const iconv =
    require('iconv-lite');


const DBF_ENCODING =
    'win1252';


function crearCampoTexto(
    valor,
    largo
) {

    const contenido =
        valor === null ||
        valor === undefined
            ? ''
            : String(valor);


    let buffer =
        iconv.encode(
            contenido,
            DBF_ENCODING
        );


    if (
        buffer.length > largo
    ) {

        buffer =
            buffer.subarray(
                0,
                largo
            );
    }


    const salida =
        Buffer.alloc(
            largo,
            0x20
        );


    buffer.copy(
        salida,
        0
    );


    return salida;
}


function crearCampoNumero(
    valor,
    largo,
    decimales
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ''
    ) {

        return Buffer.from(
            ' '.repeat(largo),
            'ascii'
        );
    }


    const numero =
        Number(valor);


    if (
        !Number.isFinite(numero)
    ) {

        throw new Error(
            `Valor numérico inválido: ${valor}`
        );
    }


    let contenido =
        decimales > 0
            ? numero.toFixed(decimales)
            : Math.trunc(numero).toString();


    if (
        contenido.length > largo
    ) {

        throw new Error(
            `El número ${contenido} supera el largo DBF ${largo}.`
        );
    }


    contenido =
        contenido.padStart(
            largo,
            ' '
        );


    return Buffer.from(
        contenido,
        'ascii'
    );
}


function crearCampoLogico(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ''
    ) {

        return Buffer.from(
            '?',
            'ascii'
        );
    }


    const verdadero =
        valor === true ||
        valor === 1 ||
        [
            '1',
            'T',
            '.T.',
            'TRUE',
            'SI',
            'SÍ',
            'YES'
        ].includes(
            String(valor)
                .trim()
                .toUpperCase()
        );


    return Buffer.from(
        verdadero
            ? 'T'
            : 'F',
        'ascii'
    );
}


function crearValorCampo(
    campo,
    valor
) {

    switch (
        campo.tipo
    ) {

        case 'C':

            return crearCampoTexto(
                valor,
                campo.largo
            );


        case 'N':

            return crearCampoNumero(
                valor,
                campo.largo,
                campo.decimales || 0
            );


        case 'L':

            return crearCampoLogico(
                valor
            );


        default:

            throw new Error(
                `Tipo DBF no soportado en archivo auxiliar: ${campo.tipo}`
            );
    }
}


function validarCampos(
    campos
) {

    if (
        !Array.isArray(campos) ||
        campos.length === 0
    ) {

        throw new Error(
            'No se definieron campos para generar el DBF auxiliar.'
        );
    }


    for (
        const campo
        of campos
    ) {

        if (
            !campo.nombre ||
            !campo.tipo ||
            !Number.isInteger(campo.largo) ||
            campo.largo <= 0
        ) {

            throw new Error(
                'Definición de campo DBF auxiliar inválida.'
            );
        }


        if (
            Buffer.byteLength(
                campo.nombre,
                'ascii'
            ) > 11
        ) {

            throw new Error(
                `El nombre de campo DBF "${campo.nombre}" supera 11 caracteres.`
            );
        }
    }
}


function escribirDBFGenerico(
    rutaArchivo,
    registros,
    campos
) {

    validarCampos(
        campos
    );


    if (
        !Array.isArray(registros) ||
        registros.length === 0
    ) {

        throw new Error(
            'No existen registros para generar el DBF auxiliar.'
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
                acumulado,
                campo
            ) =>
                acumulado +
                campo.largo,

            0
        );


    const cantidadRegistros =
        registros.length;


    const largoTotal =
        largoCabecera +
        (
            largoRegistro *
            cantidadRegistros
        ) +
        1;


    const buffer =
        Buffer.alloc(
            largoTotal,
            0
        );


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


    buffer.writeUInt32LE(
        cantidadRegistros,
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
     * ANSI / Windows-1252
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


        Buffer
            .from(
                campo.nombre,
                'ascii'
            )
            .subarray(
                0,
                11
            )
            .copy(
                descriptor,
                0
            );


        descriptor[11] =
            campo.tipo.charCodeAt(0);


        descriptor[16] =
            campo.largo;


        descriptor[17] =
            campo.decimales || 0;


        descriptor.copy(
            buffer,
            offset
        );


        offset +=
            32;
    }


    buffer[offset] =
        0x0D;


    offset =
        largoCabecera;


    for (
        const registro
        of registros
    ) {

        buffer[offset] =
            0x20;


        offset +=
            1;


        for (
            const campo
            of campos
        ) {

            const valor =
                crearValorCampo(
                    campo,
                    registro[
                        campo.nombre
                    ]
                );


            valor.copy(
                buffer,
                offset
            );


            offset +=
                campo.largo;
        }
    }


    buffer[offset] =
        0x1A;


    fs.writeFileSync(
        rutaArchivo,
        buffer
    );


    return {

        ruta:
            rutaArchivo,

        registros:
            cantidadRegistros,

        campos:
            cantidadCampos,

        largoRegistro,

        largoCabecera
    };
}


module.exports = {

    escribirDBFGenerico
};
