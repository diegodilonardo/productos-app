const XLSX = require('xlsx');

const {
    getConnection,
    sql
} = require('../config/database');


const URL_DEFAULT =
    'https://docs.google.com/spreadsheets/d/' +
    '1Jto6ubnqJeE6pR1nyvtJ8faSAfa-JgCX/' +
    'edit?gid=448657304#gid=448657304';


function texto(valor) {
    if (
        valor === null ||
        valor === undefined
    ) {
        return '';
    }

    return String(valor).trim();
}


function obtenerIdYGid(url) {
    const valor =
        texto(url);

    const id =
        valor.match(
            /\/spreadsheets\/d\/([^/]+)/i
        )?.[1];

    const gid =
        valor.match(
            /[?&#]gid=(\d+)/i
        )?.[1];

    if (!id) {
        throw new Error(
            'No se pudo obtener el ID del Google Sheet de proveedores.'
        );
    }

    return {
        id,
        gid:
            gid || '0'
    };
}


function construirUrlCsv(url) {
    const {
        id,
        gid
    } =
        obtenerIdYGid(url);

    return (
        `https://docs.google.com/spreadsheets/d/${id}/gviz/tq` +
        `?tqx=out:csv&gid=${gid}`
    );
}


function normalizarCabecera(valor) {
    return texto(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ');
}


function obtenerCampoFila(fila, nombreBuscado) {
    const objetivo =
        normalizarCabecera(
            nombreBuscado
        );

    for (
        const [
            clave,
            valor
        ]
        of Object.entries(fila)
    ) {
        if (
            normalizarCabecera(clave) ===
            objetivo
        ) {
            return valor;
        }
    }

    return undefined;
}


function prepararProveedores(filas) {
    const mapa =
        new Map();

    for (const fila of filas) {
        const codigo =
            texto(
                obtenerCampoFila(
                    fila,
                    'CODIGO'
                )
            );

        const razonSocial =
            texto(
                obtenerCampoFila(
                    fila,
                    'NVA RAZON SOCIAL'
                )
            );

        if (
            !codigo ||
            !razonSocial
        ) {
            continue;
        }

        mapa.set(
            codigo,
            {
                CODIGO:
                    codigo,

                PRESEA:
                    texto(
                        obtenerCampoFila(
                            fila,
                            'PRESEA'
                        )
                    ) || null,

                RUBRO:
                    texto(
                        obtenerCampoFila(
                            fila,
                            'RUBRO'
                        )
                    ) || null,

                NVA_RAZON_SOCIAL:
                    razonSocial
            }
        );
    }

    return [
        ...mapa.values()
    ];
}


async function descargarProveedores() {
    const urlOriginal =
        process.env.PROVEEDORES_GOOGLE_SHEET_URL ||
        URL_DEFAULT;

    const urlCsv =
        construirUrlCsv(
            urlOriginal
        );

    const response =
        await fetch(
            urlCsv,
            {
                redirect:
                    'follow'
            }
        );

    if (!response.ok) {
        throw new Error(
            `Google Sheets respondió HTTP ${response.status}.`
        );
    }

    const contenido =
        await response.text();

    const inicio =
        contenido
            .trim()
            .slice(
                0,
                200
            )
            .toLowerCase();

    if (
        inicio.includes('<!doctype html') ||
        inicio.includes('<html')
    ) {
        throw new Error(
            'Google devolvió una pantalla de acceso en lugar del maestro. ' +
            'Verificá que el Sheet pueda leerse mediante enlace o configurá autenticación.'
        );
    }

    const workbook =
        XLSX.read(
            contenido,
            {
                type:
                    'string',
                raw:
                    false
            }
        );

    const nombreHoja =
        workbook.SheetNames[0];

    if (!nombreHoja) {
        throw new Error(
            'El archivo de proveedores no contiene una hoja legible.'
        );
    }

    const filas =
        XLSX.utils.sheet_to_json(
            workbook.Sheets[nombreHoja],
            {
                defval:
                    '',
                raw:
                    false
            }
        );

    const proveedores =
        prepararProveedores(
            filas
        );

    if (
        proveedores.length === 0
    ) {
        throw new Error(
            'No se encontraron proveedores válidos. ' +
            'Se esperan las columnas CODIGO, PRESEA, RUBRO y NVA RAZON SOCIAL.'
        );
    }

    return {
        proveedores,
        urlCsv
    };
}


async function sincronizarProveedores() {
    const {
        proveedores,
        urlCsv
    } =
        await descargarProveedores();

    const pool =
        await getConnection();

    const transaction =
        new sql.Transaction(
            pool
        );

    await transaction.begin();

    try {
        await new sql.Request(
            transaction
        ).query(`
            UPDATE dbo.MAESTRO_PROVEEDORES
            SET ACTIVO = 0;
        `);

        for (
            const proveedor
            of proveedores
        ) {
            await new sql.Request(
                transaction
            )
                .input(
                    'CODIGO',
                    sql.VarChar(30),
                    proveedor.CODIGO
                )
                .input(
                    'PRESEA',
                    sql.VarChar(30),
                    proveedor.PRESEA
                )
                .input(
                    'RUBRO',
                    sql.VarChar(100),
                    proveedor.RUBRO
                )
                .input(
                    'NVA_RAZON_SOCIAL',
                    sql.VarChar(200),
                    proveedor.NVA_RAZON_SOCIAL
                )
                .query(`
                    UPDATE dbo.MAESTRO_PROVEEDORES
                    SET
                        PRESEA = @PRESEA,
                        RUBRO = @RUBRO,
                        NVA_RAZON_SOCIAL = @NVA_RAZON_SOCIAL,
                        ACTIVO = 1,
                        FECHA_SINCRONIZACION = SYSDATETIME()
                    WHERE
                        CODIGO = @CODIGO;

                    IF @@ROWCOUNT = 0
                    BEGIN
                        INSERT INTO dbo.MAESTRO_PROVEEDORES
                        (
                            CODIGO,
                            PRESEA,
                            RUBRO,
                            NVA_RAZON_SOCIAL,
                            ACTIVO,
                            FECHA_SINCRONIZACION
                        )
                        VALUES
                        (
                            @CODIGO,
                            @PRESEA,
                            @RUBRO,
                            @NVA_RAZON_SOCIAL,
                            1,
                            SYSDATETIME()
                        );
                    END;
                `);
        }

        await transaction.commit();

        return {
            cantidad:
                proveedores.length,
            urlOrigen:
                urlCsv
        };

    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {}

        throw error;
    }
}


module.exports = {
    sincronizarProveedores,
    descargarProveedores
};
