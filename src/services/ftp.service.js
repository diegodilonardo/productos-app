const ftp =
    require('basic-ftp');

const path =
    require('path');


function texto(valor) {

    if (
        valor === undefined ||
        valor === null
    ) {
        return '';
    }

    return String(valor).trim();
}


function booleano(valor) {

    return [
        '1',
        'TRUE',
        'SI',
        'SÍ',
        'YES'
    ].includes(
        texto(valor).toUpperCase()
    );
}


function obtenerConfiguracion() {

    const host =
        texto(
            process.env.FTP_HOST
        );

    const port =
        Number(
            process.env.FTP_PORT ||
            21
        );

    const user =
        texto(
            process.env.FTP_USER
        );

    const password =
        texto(
            process.env.FTP_PASSWORD
        );

    const remotePath =
        texto(
            process.env.FTP_REMOTE_PATH
        ) ||
        'altas_productos_vicbor';

    const remoteFilename =
        texto(
            process.env.FTP_REMOTE_FILENAME
        ) ||
        'ALTAS_PRODUCTOS.DBI';

    const secure =
        booleano(
            process.env.FTP_SECURE
        );

    const timeout =
        Number(
            process.env.FTP_TIMEOUT ||
            30000
        );


    if (!host) {

        throw new Error(
            'Falta configurar FTP_HOST en .env.'
        );
    }


    if (!user) {

        throw new Error(
            'Falta configurar FTP_USER en .env.'
        );
    }


    if (!password) {

        throw new Error(
            'Falta configurar FTP_PASSWORD en .env.'
        );
    }


    if (
        !Number.isInteger(port) ||
        port <= 0
    ) {

        throw new Error(
            'FTP_PORT inválido en .env.'
        );
    }


    return {
        host,
        port,
        user,
        password,
        remotePath,
        remoteFilename,
        secure,
        timeout
    };
}


async function subirArchivo(
    rutaLocal,
    nombreArchivo,
    nombreRemoto = null
) {

    const config =
        obtenerConfiguracion();


    const archivoRemoto =
        texto(
            nombreRemoto
        ) ||
        config.remoteFilename;


    const cliente =
        new ftp.Client(
            config.timeout
        );


    /*
     * Dejar en false normalmente.
     * Activar temporalmente solo si necesitamos diagnosticar FTP.
     */
    cliente.ftp.verbose =
        booleano(
            process.env.FTP_VERBOSE
        );


    try {

        await cliente.access({
            host:
                config.host,

            port:
                config.port,

            user:
                config.user,

            password:
                config.password,

            secure:
                config.secure
        });


        /*
         * ensureDir acepta también rutas relativas.
         * Para este proyecto:
         * altas_productos_vicbor
         */
        await cliente.ensureDir(
            config.remotePath
        );


        /*
         * IMPORTANTE:
         * - nombreArchivo = nombre LOCAL del DBI (se conserva tal cual).
         * - config.remoteFilename = nombre GENERICO usado únicamente en FTP.
         *
         * Ejemplo:
         * Local: PRODUCTOS_ALTA_20260820_001.DBI
         * FTP:   ALTAS_PRODUCTOS.DBI
         */
        await cliente.uploadFrom(
            rutaLocal,
            archivoRemoto
        );


        const rutaRemota =
            [
                config.remotePath
                    .replace(
                        /[\\/]+$/g,
                        ''
                    ),

                archivoRemoto
            ]
                .filter(Boolean)
                .join('/');


        return {
            enviado:
                true,

            host:
                config.host,

            port:
                config.port,

            carpeta:
                config.remotePath,

            archivoLocal:
                nombreArchivo,

            archivoFTP:
                archivoRemoto,

            rutaRemota,

            secure:
                config.secure
        };


    } catch (error) {

        const mensajeOriginal =
            error &&
            error.message
                ? error.message
                : String(error);


        throw new Error(
            `No se pudo enviar el DBI al FTP ` +
            `${config.host}:${config.port}/` +
            `${config.remotePath}. ` +
            `El archivo local quedó conservado para reintentar. ` +
            `Detalle: ${mensajeOriginal}`
        );


    } finally {

        cliente.close();
    }
}


module.exports = {
    subirArchivo
};
