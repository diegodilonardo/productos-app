const fs = require('fs');
const path = require('path');

const { obtenerRutaMaestro } = require('../config/masters');

const {
    obtenerMetadataArchivo,
    calcularHashArchivo,
    leerArchivoPipe,
} = require('../utils/fileParser');

const {
    obtenerUltimoHashOK,
    crearControlImportacion,
    finalizarControlImportacion,
} = require('./controlImportaciones.service');

const { getConnection, sql } = require('../config/database');


function validarNombreSQL(nombre) {
    if (!/^[A-Z0-9_]+$/i.test(nombre)) {
        throw new Error(`Nombre SQL inválido: ${nombre}`);
    }

    return nombre;
}


function obtenerTipoSQL(configColumna) {
    const tipo = String(configColumna.tipo || 'VARCHAR').toUpperCase();

    switch (tipo) {
        case 'VARCHAR':
            return sql.VarChar(configColumna.longitud);

        case 'NVARCHAR':
            return sql.NVarChar(configColumna.longitud);

        case 'INT':
            return sql.Int;

        case 'BIGINT':
            return sql.BigInt;

        case 'DECIMAL':
            return sql.Decimal(
                configColumna.precision || 18,
                configColumna.escala || 2
            );

        case 'BIT':
            return sql.Bit;

        default:
            throw new Error(`Tipo SQL no soportado: ${tipo}`);
    }
}


function convertirValor(valor, configColumna) {
    if (valor === undefined || valor === null || valor === '') {
        if (configColumna.requerido) {
            return '';
        }

        return null;
    }

    const tipo = String(configColumna.tipo || 'VARCHAR').toUpperCase();

    switch (tipo) {
        case 'INT':
            return parseInt(valor, 10);

        case 'BIGINT':
            return valor;

        case 'DECIMAL':
            return Number(String(valor).replace(',', '.'));

        case 'BIT':
            return valor === '1' || String(valor).toUpperCase() === 'TRUE';

        default:
            return String(valor);
    }
}


function obtenerClaves(maestro) {
    if (Array.isArray(maestro.clave)) {
        return maestro.clave.map(validarNombreSQL);
    }

    return [validarNombreSQL(maestro.clave)];
}


function resolverContextoEmpresa(contextoEmpresa) {
    if (!contextoEmpresa) {
        return {
            idEmpresa: 1,
            codigoEmpresa: '0',
            razonSocial: 'VICBOR',
            carpetaLocal: null
        };
    }

    const idEmpresa = Number(
        contextoEmpresa.idEmpresa ??
        contextoEmpresa.ID_EMPRESA
    );

    const codigoEmpresa = String(
        contextoEmpresa.codigoEmpresa ??
        contextoEmpresa.CODIGO_EMPRESA ??
        ''
    ).trim();

    const razonSocial = String(
        contextoEmpresa.empresa ??
        contextoEmpresa.razonSocial ??
        contextoEmpresa.RAZON_SOCIAL ??
        ''
    ).trim();

    const carpetaLocal =
        contextoEmpresa.carpetaLocal
            ? String(contextoEmpresa.carpetaLocal)
            : null;

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        throw new Error('ID_EMPRESA inválido para la importación.');
    }

    if (!codigoEmpresa) {
        throw new Error('CODIGO_EMPRESA vacío para la importación.');
    }

    return {
        idEmpresa,
        codigoEmpresa,
        razonSocial,
        carpetaLocal
    };
}


function obtenerRutaArchivo(maestro, empresa) {
    if (empresa.carpetaLocal) {
        return path.join(
            empresa.carpetaLocal,
            maestro.archivo
        );
    }

    return obtenerRutaMaestro(maestro);
}


async function cargarStagingBulk(
    transaction,
    maestro,
    registros,
    idImportacion,
    idEmpresa
) {
    const staging = validarNombreSQL(maestro.staging);

    const table = new sql.Table(`dbo.${staging}`);
    table.create = false;

    table.columns.add('ID_IMPORTACION', sql.BigInt, {
        nullable: false,
    });

    table.columns.add('ID_EMPRESA', sql.Int, {
        nullable: false,
    });

    for (const configColumna of maestro.columnas) {
        table.columns.add(
            configColumna.nombre,
            obtenerTipoSQL(configColumna),
            {
                nullable: !configColumna.requerido,
            }
        );
    }

    for (const registro of registros) {
        const valores = [
            idImportacion,
            idEmpresa
        ];

        for (const configColumna of maestro.columnas) {
            valores.push(
                convertirValor(
                    registro[configColumna.nombre],
                    configColumna
                )
            );
        }

        table.rows.add(...valores);
    }

    const request = new sql.Request(transaction);
    await request.bulk(table);
}


async function importarMaestroGenerico(
    maestro,
    contextoEmpresa = null
) {
    const empresa = resolverContextoEmpresa(contextoEmpresa);
    const rutaArchivo = obtenerRutaArchivo(maestro, empresa);

    let idImportacion = null;

    try {
        if (!fs.existsSync(rutaArchivo)) {
            throw new Error(`No se encontró el archivo: ${rutaArchivo}`);
        }

        const metadata = await obtenerMetadataArchivo(rutaArchivo);
        const hash = await calcularHashArchivo(rutaArchivo);

        const ultimoHash = await obtenerUltimoHashOK(
            maestro.nombre,
            empresa.idEmpresa
        );

        if (ultimoHash === hash) {
            idImportacion = await crearControlImportacion({
                maestro: maestro.nombre,
                archivo: maestro.archivo,
                estado: 'SIN_CAMBIOS',
                hash,
                tamano: metadata.tamano,
                fechaArchivo: metadata.fechaModificacion,
                idEmpresa: empresa.idEmpresa
            });

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'SIN_CAMBIOS',
                    mensaje:
                        `El archivo no presenta cambios. ` +
                        `Empresa: ${empresa.codigoEmpresa}.`
                }
            );

            return {
                maestro: maestro.nombre,
                empresa: empresa.codigoEmpresa,
                estado: 'SIN_CAMBIOS',
            };
        }

        idImportacion = await crearControlImportacion({
            maestro: maestro.nombre,
            archivo: maestro.archivo,
            estado: 'EJECUTANDO',
            hash,
            tamano: metadata.tamano,
            fechaArchivo: metadata.fechaModificacion,
            idEmpresa: empresa.idEmpresa
        });

        /*
         * Todos los archivos tienen CODIGO_EMPRESA como último campo.
         * Por eso esperamos columnas configuradas + 1.
         */
        const filas = await leerArchivoPipe(
            rutaArchivo,
            maestro.columnas.length + 1
        );

        const claves = obtenerClaves(maestro);
        const registros = [];
        const clavesEncontradas = new Set();

        for (let i = 0; i < filas.length; i++) {
            const registro = {};

            for (let c = 0; c < maestro.columnas.length; c++) {
                const configColumna = maestro.columnas[c];

                const valorOriginal =
                    filas[i][configColumna.archivo];

                const valor =
                    valorOriginal === undefined ||
                    valorOriginal === null
                        ? ''
                        : String(valorOriginal).trim();

                if (configColumna.requerido && valor === '') {
                    throw new Error(
                        `Campo ${configColumna.nombre} ` +
                        `vacío en línea ${i + 1}.`
                    );
                }

                if (
                    valor !== '' &&
                    configColumna.longitud &&
                    valor.length > configColumna.longitud
                ) {
                    throw new Error(
                        `Campo ${configColumna.nombre} demasiado largo ` +
                        `en línea ${i + 1}. Valor: "${valor}". ` +
                        `Máximo: ${configColumna.longitud}.`
                    );
                }

                if (
                    valor !== '' &&
                    String(configColumna.tipo).toUpperCase() === 'INT' &&
                    !/^-?\d+$/.test(valor)
                ) {
                    throw new Error(
                        `Campo ${configColumna.nombre} debe ser entero ` +
                        `en línea ${i + 1}.`
                    );
                }

                registro[configColumna.nombre] = valor;
            }

            /*
             * Regla multiempresa:
             * el último campo del TXT es siempre CODIGO_EMPRESA.
             */
            const codigoEmpresaArchivo =
                String(
                    filas[i][maestro.columnas.length] ?? ''
                ).trim();

            if (!codigoEmpresaArchivo) {
                throw new Error(
                    `CODIGO_EMPRESA vacío en línea ${i + 1} ` +
                    `de ${maestro.nombre}.`
                );
            }

            if (codigoEmpresaArchivo !== empresa.codigoEmpresa) {
                throw new Error(
                    `Empresa incorrecta en ${maestro.nombre}, ` +
                    `línea ${i + 1}. ` +
                    `Carpeta/configuración: ${empresa.codigoEmpresa}. ` +
                    `Archivo: ${codigoEmpresaArchivo}.`
                );
            }

            /*
             * RUBRO_FACT ya contiene CODIGO_EMPRESA como dato funcional
             * en la primera columna. Debe coincidir también con el campo
             * estándar agregado al final del archivo.
             */
            if (
                maestro.nombre === 'TBL_RUBRO_FACT' &&
                String(registro.CODIGO_EMPRESA || '').trim() !==
                    codigoEmpresaArchivo
            ) {
                throw new Error(
                    `CODIGO_EMPRESA inconsistente en TBL_RUBRO_FACT, ` +
                    `línea ${i + 1}. ` +
                    `Inicial: "${registro.CODIGO_EMPRESA}". ` +
                    `Final: "${codigoEmpresaArchivo}".`
                );
            }

            const valoresClave =
                claves.map(
                    clave => registro[clave]
                );

            for (let k = 0; k < valoresClave.length; k++) {
                if (
                    valoresClave[k] === undefined ||
                    valoresClave[k] === null ||
                    valoresClave[k] === ''
                ) {
                    throw new Error(
                        `Clave ${claves[k]} vacía ` +
                        `en línea ${i + 1}.`
                    );
                }
            }

            const claveCompuesta =
                valoresClave.join('|||');

            if (clavesEncontradas.has(claveCompuesta)) {
                throw new Error(
                    `Clave duplicada "${claveCompuesta}" ` +
                    `en ${maestro.nombre}.`
                );
            }

            clavesEncontradas.add(claveCompuesta);
            registros.push(registro);
        }

        if (registros.length === 0) {
            throw new Error(
                `${maestro.nombre} no contiene registros válidos.`
            );
        }

        const tabla = validarNombreSQL(maestro.tabla);
        const staging = validarNombreSQL(maestro.staging);

        const columnas =
            maestro.columnas.map(
                columna => validarNombreSQL(columna.nombre)
            );

        const columnasNoClave =
            columnas.filter(
                columna => !claves.includes(columna)
            );

        const primeraClave = claves[0];

        const condicionJoin = [
            'M.ID_EMPRESA = T.ID_EMPRESA',
            ...claves.map(
                clave => `M.${clave} = T.${clave}`
            )
        ].join(' AND ');

        let condicionesCambio = '1 = 0';

        if (columnasNoClave.length > 0) {
            condicionesCambio =
                columnasNoClave
                    .map(
                        columna =>
                            `ISNULL(CONVERT(VARCHAR(MAX), M.${columna}), '') ` +
                            `<> ` +
                            `ISNULL(CONVERT(VARCHAR(MAX), T.${columna}), '')`
                    )
                    .join(' OR ');
        }

        const asignacionesUpdate =
            columnasNoClave.map(
                columna =>
                    `M.${columna} = T.${columna}`
            );

        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {
            const requestBase = () =>
                new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .input(
                        'ID_EMPRESA',
                        sql.Int,
                        empresa.idEmpresa
                    );

            await requestBase().query(`
                DELETE
                FROM dbo.${staging}
                WHERE ID_IMPORTACION = @ID_IMPORTACION
                  AND ID_EMPRESA = @ID_EMPRESA;
            `);

            console.log(
                `${maestro.nombre} / ${empresa.codigoEmpresa}: ` +
                `cargando ${registros.length} registros al staging...`
            );

            const inicioBulk = Date.now();

            await cargarStagingBulk(
                transaction,
                maestro,
                registros,
                idImportacion,
                empresa.idEmpresa
            );

            const tiempoBulk = Date.now() - inicioBulk;

            const nuevosResult = await requestBase().query(`
                SELECT
                    COUNT(*) AS CANTIDAD
                FROM dbo.${staging} T
                LEFT JOIN dbo.${tabla} M
                    ON ${condicionJoin}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND M.${primeraClave} IS NULL;
            `);

            const nuevos =
                nuevosResult.recordset[0].CANTIDAD;

            const modificadosResult = await requestBase().query(`
                SELECT
                    COUNT(*) AS CANTIDAD
                FROM dbo.${staging} T
                INNER JOIN dbo.${tabla} M
                    ON ${condicionJoin}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND (
                        ${condicionesCambio}
                        OR M.ACTIVO = 0
                  );
            `);

            const modificados =
                modificadosResult.recordset[0].CANTIDAD;

            const inactivosResult = await requestBase().query(`
                SELECT
                    COUNT(*) AS CANTIDAD
                FROM dbo.${tabla} M
                LEFT JOIN dbo.${staging} T
                    ON ${condicionJoin}
                   AND T.ID_IMPORTACION = @ID_IMPORTACION
                   AND T.ID_EMPRESA = @ID_EMPRESA
                WHERE M.ID_EMPRESA = @ID_EMPRESA
                  AND T.${primeraClave} IS NULL
                  AND M.ACTIVO = 1;
            `);

            const inactivos =
                inactivosResult.recordset[0].CANTIDAD;

            let setUpdate = '';

            if (asignacionesUpdate.length > 0) {
                setUpdate =
                    asignacionesUpdate.join(', ') +
                    ', ';
            }

            await requestBase().query(`
                UPDATE M
                SET
                    ${setUpdate}
                    M.ACTIVO = 1,
                    M.FECHA_ACTUALIZACION = SYSDATETIME()
                FROM dbo.${tabla} M
                INNER JOIN dbo.${staging} T
                    ON ${condicionJoin}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND (
                        ${condicionesCambio}
                        OR M.ACTIVO = 0
                  );
            `);

            const columnasSelect =
                columnas
                    .map(
                        columna => `T.${columna}`
                    )
                    .join(', ');

            await requestBase().query(`
                INSERT INTO dbo.${tabla}
                (
                    ID_EMPRESA,
                    ${columnas.join(', ')},
                    ACTIVO,
                    FECHA_ACTUALIZACION
                )
                SELECT
                    T.ID_EMPRESA,
                    ${columnasSelect},
                    1,
                    SYSDATETIME()
                FROM dbo.${staging} T
                LEFT JOIN dbo.${tabla} M
                    ON ${condicionJoin}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND M.${primeraClave} IS NULL;
            `);

            /*
             * Fundamental:
             * solo se inactivan registros de la empresa procesada.
             */
            await requestBase().query(`
                UPDATE M
                SET
                    M.ACTIVO = 0,
                    M.FECHA_ACTUALIZACION = SYSDATETIME()
                FROM dbo.${tabla} M
                LEFT JOIN dbo.${staging} T
                    ON ${condicionJoin}
                   AND T.ID_IMPORTACION = @ID_IMPORTACION
                   AND T.ID_EMPRESA = @ID_EMPRESA
                WHERE M.ID_EMPRESA = @ID_EMPRESA
                  AND T.${primeraClave} IS NULL
                  AND M.ACTIVO = 1;
            `);

            await requestBase().query(`
                DELETE
                FROM dbo.${staging}
                WHERE ID_IMPORTACION = @ID_IMPORTACION
                  AND ID_EMPRESA = @ID_EMPRESA;
            `);

            await transaction.commit();

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'OK',
                    registrosArchivo: registros.length,
                    nuevos,
                    modificados,
                    inactivos,
                    errores: 0,
                    mensaje:
                        `Importación finalizada. ` +
                        `Empresa ${empresa.codigoEmpresa}. ` +
                        `Bulk staging: ${tiempoBulk} ms.`
                }
            );

            return {
                maestro: maestro.nombre,
                empresa: empresa.codigoEmpresa,
                estado: 'OK',
                registros: registros.length,
                nuevos,
                modificados,
                inactivos,
                bulkMs: tiempoBulk,
            };
        } catch (error) {
            try {
                await transaction.rollback();
            } catch (_) {}

            throw error;
        }
    } catch (error) {
        console.error(
            `Error importando ${maestro.nombre} ` +
            `[empresa ${empresa.codigoEmpresa}]:`,
            error.message
        );

        if (idImportacion) {
            try {
                await finalizarControlImportacion(
                    idImportacion,
                    {
                        estado: 'ERROR',
                        errores: 1,
                        mensaje: error.message.substring(0, 1000),
                    }
                );
            } catch (errorControl) {
                console.error(
                    'No se pudo actualizar CONTROL_IMPORTACIONES:',
                    errorControl.message
                );
            }
        }

        throw error;
    }
}


module.exports = {
    importarMaestroGenerico,
};
