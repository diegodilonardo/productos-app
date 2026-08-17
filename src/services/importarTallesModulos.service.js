const fs = require('fs');

const {
    maestros,
    obtenerRutaMaestro
} = require('../config/masters');

const {
    obtenerMetadataArchivo,
    calcularHashArchivo,
    leerArchivoPipe
} = require('../utils/fileParser');

const {
    obtenerUltimoHashOK,
    crearControlImportacion,
    finalizarControlImportacion
} = require('./controlImportaciones.service');

const {
    getConnection,
    sql
} = require('../config/database');


/* =============================================================
   COLUMNAS DE TALLES DEL ARCHIVO
   ============================================================= */

const columnasTalles = [

    'T01',
    'T02',
    'T03',
    'T04',
    'T05',
    'T06',
    'T07',
    'T08',

    'T10',
    'T12',
    'T14',
    'T15',
    'T16',
    'T17',
    'T18',
    'T19',

    'T20',
    'T21',
    'T22',
    'T23',
    'T24',
    'T25',
    'T26',
    'T27',
    'T28',
    'T29',

    'T30',
    'T31',
    'T32',
    'T33',
    'T34',
    'T35',
    'T36',
    'T37',
    'T38',
    'T385',
    'T39',
    'T395',

    'T40',
    'T405',
    'T41',
    'T415',
    'T42',
    'T425',
    'T43',
    'T435',
    'T44',
    'T445',
    'T45',
    'T455',

    'T46',
    'T47',
    'T48',
    'T49',
    'T50',

    'T_XS',
    'T_S',
    'T_L',
    'T_M',
    'T_XL',
    'T_2XL',
    'T_3XL'
];


/* =============================================================
   ESTRUCTURA COMPLETA DEL TXT
   ============================================================= */

const columnasArchivo = [

    'CODIGO_MODULO',
    'DETALLE_MODULO',

    ...columnasTalles,

    'PARES'
];


/* =============================================================
   CONVERTIR CANTIDAD
   ============================================================= */

function convertirCantidad(
    valor,
    nombreCampo,
    numeroLinea
) {

    const texto =
        valor === undefined ||
        valor === null

            ? ''

            : String(valor).trim();


    /*
     * En las columnas de talles:
     *
     * vacío = 0
     */

    if (texto === '') {

        return 0;
    }


    /*
     * Solamente números enteros positivos
     * o cero.
     */

    if (!/^\d+$/.test(texto)) {

        throw new Error(
            `Valor inválido en ${nombreCampo}, ` +
            `línea ${numeroLinea}: "${texto}".`
        );
    }


    const numero =
        Number(texto);


    if (
        !Number.isInteger(numero) ||
        numero < 0
    ) {

        throw new Error(
            `${nombreCampo} debe ser un entero ` +
            `mayor o igual a cero en línea ` +
            `${numeroLinea}.`
        );
    }


    return numero;
}


/* =============================================================
   CARGAR STAGING EN BULK
   ============================================================= */

async function cargarStagingBulk(
    transaction,
    registros,
    idImportacion
) {

    const table =
        new sql.Table(
            'dbo.STG_MAESTRO_TALLES_MODULOS'
        );


    table.create = false;


    /* ---------------------------------------------------------
       ID IMPORTACION
       --------------------------------------------------------- */

    table.columns.add(
        'ID_IMPORTACION',
        sql.BigInt,
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       CODIGO
       --------------------------------------------------------- */

    table.columns.add(
        'CODIGO_MODULO',
        sql.VarChar(2),
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       DETALLE
       --------------------------------------------------------- */

    table.columns.add(
        'DETALLE_MODULO',
        sql.VarChar(100),
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       TALLES
       --------------------------------------------------------- */

    for (
        const columna
        of columnasTalles
    ) {

        table.columns.add(
            columna,
            sql.Int,
            {
                nullable: false
            }
        );
    }


    /* ---------------------------------------------------------
       PARES
       --------------------------------------------------------- */

    table.columns.add(
        'PARES',
        sql.Int,
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       TOTAL CALCULADO
       --------------------------------------------------------- */

    table.columns.add(
        'TOTAL_CALCULADO',
        sql.Int,
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       CONSISTENCIA
       --------------------------------------------------------- */

    table.columns.add(
        'ES_CONSISTENTE',
        sql.Bit,
        {
            nullable: false
        }
    );


    /* ---------------------------------------------------------
       OBSERVACION
       --------------------------------------------------------- */

    table.columns.add(
        'OBSERVACION',
        sql.VarChar(300),
        {
            nullable: true
        }
    );


    /* =========================================================
       AGREGAR FILAS
       ========================================================= */

    for (
        const registro
        of registros
    ) {

        const valores = [

            idImportacion,

            registro.CODIGO_MODULO,

            registro.DETALLE_MODULO
        ];


        for (
            const columna
            of columnasTalles
        ) {

            valores.push(
                registro[columna]
            );
        }


        valores.push(
            registro.PARES
        );


        valores.push(
            registro.TOTAL_CALCULADO
        );


        valores.push(
            registro.ES_CONSISTENTE
        );


        valores.push(
            registro.OBSERVACION
        );


        table.rows.add(
            ...valores
        );
    }


    /* =========================================================
       BULK INSERT
       ========================================================= */

    const request =
        new sql.Request(
            transaction
        );


    await request.bulk(
        table
    );
}


/* =============================================================
   IMPORTAR TALLES MODULOS
   ============================================================= */

async function importarTallesModulos() {

    const maestro =
        maestros.TALLES_MODULOS;


    if (!maestro) {

        throw new Error(
            'No está configurado TALLES_MODULOS ' +
            'en masters.js'
        );
    }


    const rutaArchivo =
        obtenerRutaMaestro(
            maestro
        );


    let idImportacion = null;


    try {

        /* =====================================================
           1. VERIFICAR ARCHIVO
           ===================================================== */

        if (
            !fs.existsSync(
                rutaArchivo
            )
        ) {

            throw new Error(
                `No se encontró el archivo: ` +
                `${rutaArchivo}`
            );
        }


        /* =====================================================
           2. METADATA
           ===================================================== */

        const metadata =
            await obtenerMetadataArchivo(
                rutaArchivo
            );


        /* =====================================================
           3. HASH
           ===================================================== */

        const hash =
            await calcularHashArchivo(
                rutaArchivo
            );


        /* =====================================================
           4. VERIFICAR CAMBIOS
           ===================================================== */

        const ultimoHash =
            await obtenerUltimoHashOK(
                maestro.nombre
            );


        /* =====================================================
           5. SIN CAMBIOS
           ===================================================== */

        if (
            ultimoHash === hash
        ) {

            idImportacion =
                await crearControlImportacion({

                    maestro:
                        maestro.nombre,

                    archivo:
                        maestro.archivo,

                    estado:
                        'SIN_CAMBIOS',

                    hash,

                    tamano:
                        metadata.tamano,

                    fechaArchivo:
                        metadata.fechaModificacion
                });


            await finalizarControlImportacion(

                idImportacion,

                {
                    estado:
                        'SIN_CAMBIOS',

                    mensaje:
                        'El archivo no presenta cambios.'
                }
            );


            return {

                maestro:
                    maestro.nombre,

                estado:
                    'SIN_CAMBIOS'
            };
        }


        /* =====================================================
           6. CREAR CONTROL
           ===================================================== */

        idImportacion =
            await crearControlImportacion({

                maestro:
                    maestro.nombre,

                archivo:
                    maestro.archivo,

                estado:
                    'EJECUTANDO',

                hash,

                tamano:
                    metadata.tamano,

                fechaArchivo:
                    metadata.fechaModificacion
            });


        /* =====================================================
           7. LEER ARCHIVO
           ===================================================== */

        const filas =
            await leerArchivoPipe(

                rutaArchivo,

                columnasArchivo.length
            );


        /* =====================================================
           8. ARCHIVO VACIO
           ===================================================== */

        if (
            filas.length === 0
        ) {

            throw new Error(
                'TBL_TALLES_MODULOS está vacío.'
            );
        }


        /* =====================================================
           9. VALIDAR REGISTROS
           ===================================================== */

        const registros = [];

        const codigos =
            new Set();


        for (
            let i = 0;
            i < filas.length;
            i++
        ) {

            const numeroLinea =
                i + 1;


            const fila =
                filas[i];


            /* =================================================
               CODIGO MODULO
               ================================================= */

            const codigo =
                String(
                    fila[0] || ''
                ).trim();


            if (!codigo) {

                throw new Error(
                    `CODIGO_MODULO vacío ` +
                    `en línea ${numeroLinea}.`
                );
            }


            if (
                codigo.length > 2
            ) {

                throw new Error(
                    `CODIGO_MODULO "${codigo}" ` +
                    `supera los 2 caracteres ` +
                    `en línea ${numeroLinea}.`
                );
            }


            if (
                codigos.has(
                    codigo
                )
            ) {

                throw new Error(
                    `CODIGO_MODULO duplicado ` +
                    `"${codigo}" ` +
                    `en línea ${numeroLinea}.`
                );
            }


            codigos.add(
                codigo
            );


            /* =================================================
               DETALLE
               ================================================= */

            const detalle =
                String(
                    fila[1] || ''
                ).trim();


            if (!detalle) {

                throw new Error(
                    `DETALLE_MODULO vacío ` +
                    `para el módulo ${codigo}.`
                );
            }


            if (
                detalle.length > 100
            ) {

                throw new Error(
                    `DETALLE_MODULO del módulo ` +
                    `${codigo} supera ` +
                    `100 caracteres.`
                );
            }


            /* =================================================
               CREAR REGISTRO
               ================================================= */

            const registro = {

                CODIGO_MODULO:
                    codigo,

                DETALLE_MODULO:
                    detalle
            };


            /* =================================================
               CANTIDADES POR TALLE
               ================================================= */

            let totalCalculado = 0;

            let indiceArchivo = 2;


            for (
                const columna
                of columnasTalles
            ) {

                const cantidad =
                    convertirCantidad(

                        fila[
                            indiceArchivo
                        ],

                        columna,

                        numeroLinea
                    );


                registro[
                    columna
                ] = cantidad;


                totalCalculado +=
                    cantidad;


                indiceArchivo++;
            }


            /* =================================================
               PARES
               ================================================= */

            const textoPares =
                String(
                    fila[
                        indiceArchivo
                    ] || ''
                ).trim();


            if (
                !/^\d+$/.test(
                    textoPares
                )
            ) {

                throw new Error(
                    `PARES inválido para ` +
                    `el módulo ${codigo}, ` +
                    `línea ${numeroLinea}: ` +
                    `"${textoPares}".`
                );
            }


            const pares =
                Number(
                    textoPares
                );


            if (
                !Number.isInteger(
                    pares
                ) ||
                pares <= 0
            ) {

                throw new Error(
                    `PARES debe ser mayor ` +
                    `a cero para el módulo ` +
                    `${codigo}.`
                );
            }


            registro.PARES =
                pares;


            /* =================================================
               TOTAL
               ================================================= */

            registro.TOTAL_CALCULADO =
                totalCalculado;


            /* =================================================
               VALIDAR CONSISTENCIA
               ================================================= */

            let observacion = null;


            /*
             * La curva debe tener al menos
             * un talle con cantidad.
             */

            if (
                totalCalculado === 0
            ) {

                observacion =
                    'La curva no contiene cantidades por talle.';
            }


            /*
             * TOTAL debe coincidir con PARES.
             */

            if (
                totalCalculado !== pares
            ) {

                const mensaje =
                    `PARES=${pares}, ` +
                    `TOTAL_CALCULADO=${totalCalculado}.`;


                if (observacion) {

                    observacion +=
                        ' ' + mensaje;

                } else {

                    observacion =
                        mensaje;
                }
            }


            /*
             * Consistente solamente si:
             *
             * - tiene cantidades
             * - suma = PARES
             */

            registro.ES_CONSISTENTE =
                (
                    totalCalculado > 0 &&
                    totalCalculado === pares
                )
                    ? 1
                    : 0;


            registro.OBSERVACION =
                observacion;


            registros.push(
                registro
            );
        }


        /* =====================================================
           10. CONEXION SQL
           ===================================================== */

        const pool =
            await getConnection();


        const transaction =
            new sql.Transaction(
                pool
            );


        await transaction.begin();


        try {

            /* =================================================
               11. LIMPIAR STAGING
               ================================================= */

            await new sql.Request(
                transaction
            )
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    DELETE
                    FROM dbo.STG_MAESTRO_TALLES_MODULOS

                    WHERE
                        ID_IMPORTACION =
                            @ID_IMPORTACION;
                `);


            /* =================================================
               12. BULK STAGING
               ================================================= */

            console.log(
                `${maestro.nombre}: ` +
                `cargando ${registros.length} ` +
                `curvas al staging...`
            );


            const inicioBulk =
                Date.now();


            await cargarStagingBulk(

                transaction,

                registros,

                idImportacion
            );


            const bulkMs =
                Date.now() -
                inicioBulk;


            console.log(
                `${maestro.nombre}: ` +
                `staging cargado en ` +
                `${bulkMs} ms.`
            );


            /* =================================================
               13. CONDICIONES DE CAMBIO
               ================================================= */

            const comparacionesTalles =
                columnasTalles
                    .map(
                        columna =>

                            `ISNULL(M.${columna}, 0) ` +
                            `<> ` +
                            `ISNULL(T.${columna}, 0)`
                    )
                    .join(
                        ' OR '
                    );


            const condicionCambio = `

                ISNULL(M.DETALLE_MODULO, '')
                    <> ISNULL(T.DETALLE_MODULO, '')

                OR ${comparacionesTalles}

                OR ISNULL(M.PARES, 0)
                    <> ISNULL(T.PARES, 0)

                OR ISNULL(M.TOTAL_CALCULADO, 0)
                    <> ISNULL(T.TOTAL_CALCULADO, 0)

                OR ISNULL(M.ES_CONSISTENTE, 0)
                    <> ISNULL(T.ES_CONSISTENTE, 0)

                OR ISNULL(M.OBSERVACION, '')
                    <> ISNULL(T.OBSERVACION, '')

                OR M.ACTIVO = 0
            `;


            /* =================================================
               14. NUEVOS
               ================================================= */

            const nuevosResult =
                await new sql.Request(
                    transaction
                )
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM
                            dbo.STG_MAESTRO_TALLES_MODULOS T

                        LEFT JOIN
                            dbo.MAESTRO_TALLES_MODULOS M

                            ON
                                M.CODIGO_MODULO =
                                T.CODIGO_MODULO

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            M.CODIGO_MODULO
                                IS NULL;
                    `);


            const nuevos =
                nuevosResult
                    .recordset[0]
                    .CANTIDAD;


            /* =================================================
               15. MODIFICADOS
               ================================================= */

            const modificadosResult =
                await new sql.Request(
                    transaction
                )
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM
                            dbo.STG_MAESTRO_TALLES_MODULOS T

                        INNER JOIN
                            dbo.MAESTRO_TALLES_MODULOS M

                            ON
                                M.CODIGO_MODULO =
                                T.CODIGO_MODULO

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            (
                                ${condicionCambio}
                            );
                    `);


            const modificados =
                modificadosResult
                    .recordset[0]
                    .CANTIDAD;


            /* =================================================
               16. INACTIVOS
               ================================================= */

            const inactivosResult =
                await new sql.Request(
                    transaction
                )
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM
                            dbo.MAESTRO_TALLES_MODULOS M

                        LEFT JOIN
                            dbo.STG_MAESTRO_TALLES_MODULOS T

                            ON
                                T.CODIGO_MODULO =
                                M.CODIGO_MODULO

                                AND
                                T.ID_IMPORTACION =
                                    @ID_IMPORTACION

                        WHERE
                            T.CODIGO_MODULO
                                IS NULL

                            AND
                            M.ACTIVO = 1;
                    `);


            const inactivos =
                inactivosResult
                    .recordset[0]
                    .CANTIDAD;


            /* =================================================
               17. SET DE COLUMNAS DE TALLES
               ================================================= */

            const setsTalles =
                columnasTalles
                    .map(
                        columna =>

                            `M.${columna} = ` +
                            `T.${columna}`
                    )
                    .join(
                        ',\n'
                    );


            /* =================================================
               18. UPDATE
               ================================================= */

            await new sql.Request(
                transaction
            )
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    UPDATE M

                    SET
                        M.DETALLE_MODULO =
                            T.DETALLE_MODULO,

                        ${setsTalles},

                        M.PARES =
                            T.PARES,

                        M.TOTAL_CALCULADO =
                            T.TOTAL_CALCULADO,

                        M.ES_CONSISTENTE =
                            T.ES_CONSISTENTE,

                        M.OBSERVACION =
                            T.OBSERVACION,

                        M.ACTIVO = 1,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM
                        dbo.MAESTRO_TALLES_MODULOS M

                    INNER JOIN
                        dbo.STG_MAESTRO_TALLES_MODULOS T

                        ON
                            T.CODIGO_MODULO =
                            M.CODIGO_MODULO

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND
                        (
                            ${condicionCambio}
                        );
                `);


            /* =================================================
               19. INSERT
               ================================================= */

            const columnasInsert =
                columnasTalles.join(
                    ', '
                );


            const columnasSelect =
                columnasTalles
                    .map(
                        columna =>
                            `T.${columna}`
                    )
                    .join(
                        ', '
                    );


            await new sql.Request(
                transaction
            )
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    INSERT INTO
                        dbo.MAESTRO_TALLES_MODULOS
                    (
                        CODIGO_MODULO,
                        DETALLE_MODULO,

                        ${columnasInsert},

                        PARES,

                        TOTAL_CALCULADO,

                        ES_CONSISTENTE,

                        OBSERVACION,

                        ACTIVO,

                        FECHA_ACTUALIZACION
                    )

                    SELECT
                        T.CODIGO_MODULO,

                        T.DETALLE_MODULO,

                        ${columnasSelect},

                        T.PARES,

                        T.TOTAL_CALCULADO,

                        T.ES_CONSISTENTE,

                        T.OBSERVACION,

                        1,

                        SYSDATETIME()

                    FROM
                        dbo.STG_MAESTRO_TALLES_MODULOS T

                    LEFT JOIN
                        dbo.MAESTRO_TALLES_MODULOS M

                        ON
                            M.CODIGO_MODULO =
                            T.CODIGO_MODULO

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND
                        M.CODIGO_MODULO
                            IS NULL;
                `);


            /* =================================================
               20. INACTIVAR AUSENTES
               ================================================= */

            await new sql.Request(
                transaction
            )
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    UPDATE M

                    SET
                        M.ACTIVO = 0,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM
                        dbo.MAESTRO_TALLES_MODULOS M

                    LEFT JOIN
                        dbo.STG_MAESTRO_TALLES_MODULOS T

                        ON
                            T.CODIGO_MODULO =
                            M.CODIGO_MODULO

                            AND
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                    WHERE
                        T.CODIGO_MODULO
                            IS NULL

                        AND
                        M.ACTIVO = 1;
                `);


            /* =================================================
               21. CONTAR INCONSISTENTES
               ================================================= */

            const inconsistentesResult =
                await new sql.Request(
                    transaction
                )
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM
                            dbo.STG_MAESTRO_TALLES_MODULOS

                        WHERE
                            ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            ES_CONSISTENTE = 0;
                    `);


            const inconsistentes =
                inconsistentesResult
                    .recordset[0]
                    .CANTIDAD;


            /* =================================================
               22. LIMPIAR STAGING
               ================================================= */

            await new sql.Request(
                transaction
            )
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    DELETE
                    FROM
                        dbo.STG_MAESTRO_TALLES_MODULOS

                    WHERE
                        ID_IMPORTACION =
                            @ID_IMPORTACION;
                `);


            /* =================================================
               23. COMMIT
               ================================================= */

            await transaction.commit();


            /* =================================================
               24. MENSAJE
               ================================================= */

            let mensaje;


            if (
                inconsistentes === 0
            ) {

                mensaje =
                    `Importación correcta. ` +
                    `Todas las curvas son consistentes. ` +
                    `Bulk: ${bulkMs} ms.`;

            } else {

                mensaje =
                    `Importación correcta. ` +
                    `${inconsistentes} curva(s) ` +
                    `inconsistente(s). ` +
                    `Bulk: ${bulkMs} ms.`;
            }


            /* =================================================
               25. CONTROL OK
               ================================================= */

            await finalizarControlImportacion(

                idImportacion,

                {
                    estado:
                        'OK',

                    registrosArchivo:
                        registros.length,

                    nuevos,

                    modificados,

                    inactivos,

                    errores:
                        0,

                    mensaje
                }
            );


            /* =================================================
               26. RESULTADO
               ================================================= */

            return {

                maestro:
                    maestro.nombre,

                estado:
                    'OK',

                registros:
                    registros.length,

                nuevos,

                modificados,

                inactivos,

                inconsistentes,

                bulkMs
            };


        } catch (error) {

            try {

                await transaction.rollback();

            } catch (_) {

                /*
                 * No hacemos nada si la
                 * transacción ya estaba cerrada.
                 */
            }


            throw error;
        }


    } catch (error) {

        console.error(
            `Error importando ` +
            `${maestro.nombre}:`,
            error.message
        );


        /* =====================================================
           REGISTRAR ERROR
           ===================================================== */

        if (
            idImportacion
        ) {

            try {

                await finalizarControlImportacion(

                    idImportacion,

                    {
                        estado:
                            'ERROR',

                        errores:
                            1,

                        mensaje:
                            error.message.substring(
                                0,
                                1000
                            )
                    }
                );


            } catch (
                errorControl
            ) {

                console.error(
                    'No se pudo actualizar ' +
                    'CONTROL_IMPORTACIONES:',
                    errorControl.message
                );
            }
        }


        throw error;
    }
}


module.exports = {
    importarTallesModulos,
    columnasTalles
};