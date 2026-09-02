const ftp =
    require('basic-ftp');

const path =
    require('path');

const fs =
    require('fs');

const crypto =
    require('crypto');


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


function enteroSeguro(valor, defecto, minimo, maximo) {

    const numero = Number(valor);

    if (!Number.isInteger(numero)) {
        return defecto;
    }

    return Math.min(
        maximo,
        Math.max(minimo, numero)
    );
}


function esperar(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function esErrorTransitorio(error) {

    const codigo =
        error && error.code !== undefined
            ? error.code
            : null;

    const codigosRed = new Set([
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'ECONNABORTED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EPIPE'
    ]);

    if (codigosRed.has(String(codigo || '').toUpperCase())) {
        return true;
    }

    /*
     * Códigos FTP temporales: el servidor indica que la operación
     * podría funcionar si se vuelve a intentar más tarde.
     * No incluimos 530/550 porque autenticación, permisos o rutas
     * incorrectas no se corrigen repitiendo inmediatamente.
     */
    if ([421, 425, 426, 450, 451, 452].includes(Number(codigo))) {
        return true;
    }

    const mensaje =
        texto(
            error && error.message
                ? error.message
                : error
        ).toLowerCase();

    return [
        'timeout',
        'timed out',
        'control socket',
        'data socket',
        'socket closed',
        'connection closed',
        'connection reset',
        'connection refused',
        'network is unreachable',
        'host is unreachable',
        'econnreset',
        'econnrefused',
        'etimedout'
    ].some(fragmento =>
        mensaje.includes(fragmento)
    );
}


async function ejecutarConRetry(
    etiqueta,
    operacion
) {

    const intentosMaximos =
        enteroSeguro(
            process.env.FTP_RETRY_ATTEMPTS,
            2,
            1,
            3
        );

    const demoraMs =
        enteroSeguro(
            process.env.FTP_RETRY_DELAY_MS,
            1500,
            0,
            30000
        );

    let ultimoError = null;

    for (
        let intento = 1;
        intento <= intentosMaximos;
        intento++
    ) {

        try {

            return await operacion(intento);

        } catch (error) {

            ultimoError = error;

            const transitorio =
                esErrorTransitorio(error);

            const quedanIntentos =
                intento < intentosMaximos;

            if (
                !transitorio ||
                !quedanIntentos
            ) {
                throw error;
            }

            console.warn(
                `[FTP] ${etiqueta} falló por error transitorio. ` +
                `Reintento ${intento + 1}/${intentosMaximos} ` +
                `en ${demoraMs} ms. Detalle: ${
                    error && error.message
                        ? error.message
                        : String(error)
                }`
            );

            if (demoraMs > 0) {
                await esperar(demoraMs);
            }
        }
    }

    throw ultimoError;
}




class FtpCircuitOpenError extends Error {

    constructor(mensaje) {
        super(mensaje);
        this.name = 'FtpCircuitOpenError';
        this.code = 'FTP_CIRCUIT_OPEN';
    }
}


function configuracionCircuitBreaker() {

    return {
        umbral:
            enteroSeguro(
                process.env.FTP_CIRCUIT_FAILURE_THRESHOLD,
                2,
                1,
                20
            ),

        abiertoMs:
            enteroSeguro(
                process.env.FTP_CIRCUIT_OPEN_MS,
                15 * 60 * 1000,
                1000,
                3600000
            ),

        pruebaMaxMs:
            enteroSeguro(
                process.env.FTP_CIRCUIT_HALF_OPEN_MAX_MS,
                30000,
                1000,
                300000
            ),

        carpeta:
            texto(
                process.env.FTP_CIRCUIT_STATE_PATH
            ) ||
            path.join(
                process.cwd(),
                'tmp',
                'ftp-circuit-breaker'
            )
    };
}


function claveCircuito(config) {

    return `${config.host}:${config.port}`;
}


function archivoCircuito(config) {

    const cfg =
        configuracionCircuitBreaker();

    const hash =
        crypto
            .createHash('sha256')
            .update(claveCircuito(config))
            .digest('hex')
            .slice(0, 24);

    return {
        cfg,
        estado:
            path.join(
                cfg.carpeta,
                `${hash}.state`
            ),
        lock:
            path.join(
                cfg.carpeta,
                `${hash}.lock`
            )
    };
}


async function leerEstadoCircuito(ruta) {

    try {
        const contenido =
            await fs.promises.readFile(
                ruta,
                'utf8'
            );

        const estado =
            JSON.parse(contenido);

        return estado && typeof estado === 'object'
            ? estado
            : null;

    } catch (error) {

        if (error && error.code === 'ENOENT') {
            return null;
        }

        /*
         * Un archivo de estado ilegible no debe bloquear FTP.
         * Lo tratamos como circuito cerrado y permitimos autocorrección.
         */
        console.warn(
            '[FTP] No se pudo leer el estado del circuit breaker:',
            error && error.message
                ? error.message
                : String(error)
        );

        return null;
    }
}


async function escribirEstadoCircuito(
    ruta,
    estado
) {

    const temporal =
        `${ruta}.${process.pid}.${Date.now()}.tmp`;

    await fs.promises.writeFile(
        temporal,
        JSON.stringify(estado, null, 2),
        'utf8'
    );

    /*
     * Estamos bajo lock. Eliminamos primero el destino para que el
     * reemplazo sea portable también en Windows.
     */
    await fs.promises.rm(
        ruta,
        {
            force: true
        }
    );

    await fs.promises.rename(
        temporal,
        ruta
    );
}


async function conLockCircuito(
    config,
    accion
) {

    const rutas =
        archivoCircuito(config);

    await fs.promises.mkdir(
        rutas.cfg.carpeta,
        {
            recursive: true
        }
    );

    const inicio = Date.now();
    const maxEsperaMs = 3000;
    const lockStaleMs = 60000;

    while (true) {

        try {
            await fs.promises.mkdir(
                rutas.lock
            );
            break;

        } catch (error) {

            if (!error || error.code !== 'EEXIST') {
                throw error;
            }

            try {
                const stat =
                    await fs.promises.stat(
                        rutas.lock
                    );

                if (
                    Date.now() - stat.mtimeMs >
                    lockStaleMs
                ) {
                    await fs.promises.rm(
                        rutas.lock,
                        {
                            recursive: true,
                            force: true
                        }
                    );
                    continue;
                }
            } catch (_) {}

            if (
                Date.now() - inicio >=
                maxEsperaMs
            ) {
                throw new Error(
                    'No se pudo obtener el lock del circuit breaker FTP.'
                );
            }

            await esperar(50);
        }
    }

    try {
        return await accion(rutas);
    } finally {
        await fs.promises.rm(
            rutas.lock,
            {
                recursive: true,
                force: true
            }
        );
    }
}


async function autorizarOperacionCircuito(config) {

    return conLockCircuito(
        config,
        async rutas => {

            const ahora = Date.now();
            const clave = claveCircuito(config);
            const estado =
                await leerEstadoCircuito(
                    rutas.estado
                );

            if (!estado) {
                return {
                    modo: 'CLOSED'
                };
            }

            if (estado.estado === 'OPEN') {

                if (
                    Number(estado.abiertoHasta || 0) >
                    ahora
                ) {
                    const faltanMs =
                        Number(estado.abiertoHasta) -
                        ahora;

                    throw new FtpCircuitOpenError(
                        `Circuit breaker OPEN para ${clave}. ` +
                        `Nuevo intento habilitado en aproximadamente ` +
                        `${Math.ceil(faltanMs / 1000)} s.`
                    );
                }

                const nuevoEstado = {
                    ...estado,
                    estado: 'HALF_OPEN',
                    pruebaPid: process.pid,
                    pruebaDesde: ahora,
                    pruebaHasta:
                        ahora +
                        rutas.cfg.pruebaMaxMs,
                    actualizadoEn: ahora
                };

                await escribirEstadoCircuito(
                    rutas.estado,
                    nuevoEstado
                );

                console.log(
                    `[FTP] Circuit breaker HALF_OPEN para ${clave}. ` +
                    'Se habilita una única prueba.'
                );

                return {
                    modo: 'HALF_OPEN'
                };
            }

            if (estado.estado === 'HALF_OPEN') {

                if (
                    Number(estado.pruebaHasta || 0) >
                    ahora
                ) {
                    throw new FtpCircuitOpenError(
                        `Circuit breaker HALF_OPEN para ${clave}. ` +
                        'Ya hay una prueba FTP en curso.'
                    );
                }

                const nuevoEstado = {
                    ...estado,
                    estado: 'HALF_OPEN',
                    pruebaPid: process.pid,
                    pruebaDesde: ahora,
                    pruebaHasta:
                        ahora +
                        rutas.cfg.pruebaMaxMs,
                    actualizadoEn: ahora
                };

                await escribirEstadoCircuito(
                    rutas.estado,
                    nuevoEstado
                );

                return {
                    modo: 'HALF_OPEN'
                };
            }

            return {
                modo: 'CLOSED'
            };
        }
    );
}


async function registrarExitoCircuito(config) {

    await conLockCircuito(
        config,
        async rutas => {

            const estado =
                await leerEstadoCircuito(
                    rutas.estado
                );

            if (estado) {
                await fs.promises.rm(
                    rutas.estado,
                    {
                        force: true
                    }
                );

                console.log(
                    `[FTP] Circuit breaker CLOSED para ${claveCircuito(config)}.`
                );
            }
        }
    );
}


async function registrarFalloCircuito(
    config,
    error,
    modoOperacion
) {

    if (!esErrorTransitorio(error)) {
        return;
    }

    await conLockCircuito(
        config,
        async rutas => {

            const ahora = Date.now();
            const clave = claveCircuito(config);
            const estadoActual =
                await leerEstadoCircuito(
                    rutas.estado
                );

            const fallosPrevios =
                Number(
                    estadoActual &&
                    estadoActual.fallosConsecutivos
                        ? estadoActual.fallosConsecutivos
                        : 0
                );

            const fallos =
                modoOperacion === 'HALF_OPEN'
                    ? rutas.cfg.umbral
                    : fallosPrevios + 1;

            if (
                modoOperacion === 'HALF_OPEN' ||
                fallos >= rutas.cfg.umbral
            ) {

                const abiertoHasta =
                    ahora +
                    rutas.cfg.abiertoMs;

                await escribirEstadoCircuito(
                    rutas.estado,
                    {
                        version: 1,
                        clave,
                        estado: 'OPEN',
                        fallosConsecutivos: fallos,
                        abiertoDesde: ahora,
                        abiertoHasta,
                        ultimoError:
                            error && error.message
                                ? error.message
                                : String(error),
                        actualizadoEn: ahora
                    }
                );

                console.warn(
                    `[FTP] Circuit breaker OPEN para ${clave} ` +
                    `durante ${Math.ceil(rutas.cfg.abiertoMs / 1000)} s. ` +
                    `Fallos consecutivos: ${fallos}.`
                );

                return;
            }

            await escribirEstadoCircuito(
                rutas.estado,
                {
                    version: 1,
                    clave,
                    estado: 'CLOSED',
                    fallosConsecutivos: fallos,
                    ultimoError:
                        error && error.message
                            ? error.message
                            : String(error),
                    actualizadoEn: ahora
                }
            );

            console.warn(
                `[FTP] Fallo transitorio ${fallos}/${rutas.cfg.umbral} ` +
                `para ${clave}. Circuit breaker continúa CLOSED.`
            );
        }
    );
}


async function ejecutarConCircuitBreaker(
    config,
    operacion
) {

    const autorizacion =
        await autorizarOperacionCircuito(
            config
        );

    try {

        const resultado =
            await operacion();

        await registrarExitoCircuito(
            config
        );

        return resultado;

    } catch (error) {

        await registrarFalloCircuito(
            config,
            error,
            autorizacion.modo
        );

        throw error;
    }
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
    nombreRemoto = null,
    rutaRemota = null
) {

    const config =
        obtenerConfiguracion();


    const archivoRemoto =
        texto(
            nombreRemoto
        ) ||
        config.remoteFilename;


    const carpetaRemota =
        (
            texto(
                rutaRemota
            ) ||
            config.remotePath
        )
            .replace(
                /\\+/g,
                '/'
            )
            .replace(
                /\/+$/g,
                ''
            );


    try {

        return await ejecutarConCircuitBreaker(
            config,
            async () => ejecutarConRetry(
                `Subida ${archivoRemoto}`,
                async () => {

                const cliente =
                    new ftp.Client(
                        config.timeout
                    );

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


                    await cliente.ensureDir(
                        carpetaRemota
                    );


                    await cliente.uploadFrom(
                        rutaLocal,
                        archivoRemoto
                    );


                    const rutaRemotaFinal =
                        [
                            carpetaRemota,
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
                            carpetaRemota,

                        archivoLocal:
                            nombreArchivo,

                        archivoFTP:
                            archivoRemoto,

                        rutaRemota:
                            rutaRemotaFinal,

                        secure:
                            config.secure
                    };

                } finally {

                    cliente.close();
                }
                }
            )
        );

    } catch (error) {

        const mensajeOriginal =
            error && error.message
                ? error.message
                : String(error);


        throw new Error(
            `No se pudo enviar el DBI al FTP ` +
            `${config.host}:${config.port}/` +
            `${carpetaRemota}. ` +
            `El archivo local quedó conservado para reintentar. ` +
            `Detalle: ${mensajeOriginal}`
        );
    }
}

/* =============================================================
   DESCARGAR ARCHIVOS DESDE UNA CARPETA FTP
   ============================================================= */

async function descargarArchivos(
    remotePath,
    archivos,
    carpetaLocal
) {

    const config =
        obtenerConfiguracion();

    const carpetaFTP =
        texto(remotePath);

    if (!carpetaFTP) {

        throw new Error(
            'La ruta remota FTP de maestros está vacía.'
        );
    }

    if (
        !Array.isArray(archivos) ||
        archivos.length === 0
    ) {

        throw new Error(
            'No se informaron archivos para descargar.'
        );
    }

    await fs.promises.mkdir(
        carpetaLocal,
        {
            recursive: true
        }
    );


    try {

        return await ejecutarConCircuitBreaker(
            config,
            async () => ejecutarConRetry(
                `Descarga ${carpetaFTP}`,
                async () => {

                const cliente =
                    new ftp.Client(
                        config.timeout
                    );

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


                    await cliente.cd(
                        carpetaFTP
                    );


                    const descargados = [];

                    for (
                        const nombreArchivo
                        of archivos
                    ) {

                        const nombre =
                            texto(
                                nombreArchivo
                            );

                        if (!nombre) {
                            continue;
                        }


                        const rutaLocal =
                            path.join(
                                carpetaLocal,
                                nombre
                            );


                        await cliente.downloadTo(
                            rutaLocal,
                            nombre
                        );


                        descargados.push({
                            archivo:
                                nombre,

                            rutaLocal
                        });
                    }


                    return {
                        carpetaFTP,

                        carpetaLocal,

                        cantidad:
                            descargados.length,

                        archivos:
                            descargados
                    };

                } finally {

                    cliente.close();
                }
                }
            )
        );

    } catch (error) {

        const mensajeOriginal =
            error && error.message
                ? error.message
                : String(error);


        throw new Error(
            `No se pudieron descargar los maestros desde ` +
            `${config.host}:${config.port}${carpetaFTP}. ` +
            `Detalle: ${mensajeOriginal}`
        );
    }
}


function firmaArchivoRemoto(
    archivo
) {

    const fecha =
        archivo &&
        archivo.modifiedAt instanceof Date
            ? archivo.modifiedAt.toISOString()
            : texto(
                archivo &&
                archivo.rawModifiedAt
            );

    return {
        tamano:
            Number(
                archivo &&
                archivo.size
            ) || 0,
        fecha
    };
}


function indiceArchivosRemotos(
    listado
) {

    return new Map(
        (listado || []).map(
            archivo => [
                texto(archivo.name).toUpperCase(),
                archivo
            ]
        )
    );
}


function mismaFirmaRemota(
    izquierda,
    derecha
) {

    return Boolean(
        izquierda &&
        derecha &&
        izquierda.tamano === derecha.tamano &&
        izquierda.fecha &&
        izquierda.fecha === derecha.fecha
    );
}


async function leerManifestMaestros(
    rutaManifest
) {

    try {
        return JSON.parse(
            await fs.promises.readFile(
                rutaManifest,
                'utf8'
            )
        );
    } catch (error) {
        if (
            error &&
            error.code !== 'ENOENT'
        ) {
            console.warn(
                `[FTP] No se pudo leer el manifiesto ${rutaManifest}: ` +
                error.message
            );
        }

        return {};
    }
}


async function guardarManifestMaestros(
    rutaManifest,
    firmas
) {

    const rutaTemporal =
        `${rutaManifest}.tmp`;

    await fs.promises.writeFile(
        rutaTemporal,
        JSON.stringify(
            firmas,
            null,
            2
        ),
        'utf8'
    );

    await fs.promises.rename(
        rutaTemporal,
        rutaManifest
    );
}


/* =============================================================
   DESCARGA INTELIGENTE DE MAESTROS

   Compara fecha + tamaño remoto, comprueba que los archivos estén
   estables y descarga únicamente los que cambiaron desde la última
   ejecución exitosa.
   ============================================================= */

async function descargarArchivosModificados(
    remotePath,
    archivos,
    carpetaLocal,
    opciones = {}
) {

    const config =
        obtenerConfiguracion();

    const carpetaFTP =
        texto(remotePath);

    if (!carpetaFTP) {
        throw new Error(
            'La ruta remota FTP de maestros está vacía.'
        );
    }

    if (
        !Array.isArray(archivos) ||
        archivos.length === 0
    ) {
        throw new Error(
            'No se informaron archivos para descargar.'
        );
    }

    const estabilidadMs =
        enteroSeguro(
            opciones.estabilidadMs ??
            process.env.MAESTROS_ESTABILIDAD_MS,
            5000,
            1000,
            60000
        );

    await fs.promises.mkdir(
        carpetaLocal,
        { recursive: true }
    );

    const rutaManifest =
        path.join(
            carpetaLocal,
            '.ftp-maestros.json'
        );

    const manifestAnterior =
        await leerManifestMaestros(
            rutaManifest
        );

    try {
        return await ejecutarConCircuitBreaker(
            config,
            async () => ejecutarConRetry(
                `Descarga inteligente ${carpetaFTP}`,
                async () => {
                    const cliente =
                        new ftp.Client(
                            config.timeout
                        );

                    cliente.ftp.verbose =
                        booleano(
                            process.env.FTP_VERBOSE
                        );

                    try {
                        await cliente.access({
                            host: config.host,
                            port: config.port,
                            user: config.user,
                            password: config.password,
                            secure: config.secure
                        });

                        await cliente.cd(
                            carpetaFTP
                        );

                        const primerIndice =
                            indiceArchivosRemotos(
                                await cliente.list()
                            );

                        await esperar(
                            estabilidadMs
                        );

                        const segundoIndice =
                            indiceArchivosRemotos(
                                await cliente.list()
                            );

                        const firmasActuales = {};
                        const modificados = [];

                        for (
                            const nombreOriginal
                            of archivos
                        ) {
                            const nombre =
                                texto(nombreOriginal);

                            if (!nombre) continue;

                            const clave =
                                nombre.toUpperCase();

                            const primero =
                                primerIndice.get(clave);

                            const segundo =
                                segundoIndice.get(clave);

                            if (!primero || !segundo) {
                                throw new Error(
                                    `No se encontró el archivo maestro ${nombre} en ${carpetaFTP}.`
                                );
                            }

                            const firmaPrimera =
                                firmaArchivoRemoto(
                                    primero
                                );

                            const firmaSegunda =
                                firmaArchivoRemoto(
                                    segundo
                                );

                            if (
                                !mismaFirmaRemota(
                                    firmaPrimera,
                                    firmaSegunda
                                )
                            ) {
                                const error =
                                    new Error(
                                        `El archivo ${nombre} todavía está siendo actualizado por el ERP.`
                                    );

                                error.code = 450;
                                throw error;
                            }

                            firmasActuales[nombre] =
                                firmaSegunda;

                            if (
                                !mismaFirmaRemota(
                                    manifestAnterior[nombre],
                                    firmaSegunda
                                )
                            ) {
                                modificados.push(
                                    nombre
                                );
                            }
                        }

                        const descargados = [];

                        for (
                            const nombre
                            of modificados
                        ) {
                            const rutaLocal =
                                path.join(
                                    carpetaLocal,
                                    nombre
                                );

                            await cliente.downloadTo(
                                rutaLocal,
                                nombre
                            );

                            descargados.push({
                                archivo: nombre,
                                rutaLocal
                            });
                        }

                        await guardarManifestMaestros(
                            rutaManifest,
                            firmasActuales
                        );

                        return {
                            carpetaFTP,
                            carpetaLocal,
                            cantidad:
                                descargados.length,
                            archivos:
                                descargados,
                            revisados:
                                archivos.length,
                            sinCambios:
                                descargados.length === 0,
                            estabilidadMs
                        };
                    } finally {
                        cliente.close();
                    }
                }
            )
        );
    } catch (error) {
        const mensajeOriginal =
            error && error.message
                ? error.message
                : String(error);

        throw new Error(
            `No se pudieron revisar los maestros desde ` +
            `${config.host}:${config.port}${carpetaFTP}. ` +
            `Detalle: ${mensajeOriginal}`
        );
    }
}


module.exports = {
    subirArchivo,
    descargarArchivos,
    descargarArchivosModificados,
    firmaArchivoRemoto,
    mismaFirmaRemota
};
