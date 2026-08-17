const fs = require('fs');
const crypto = require('crypto');

async function obtenerMetadataArchivo(rutaArchivo) {

    const stats = await fs.promises.stat(rutaArchivo);

    return {
        tamano: stats.size,
        fechaModificacion: stats.mtime
    };
}


async function calcularHashArchivo(rutaArchivo) {

    return new Promise((resolve, reject) => {

        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(rutaArchivo);

        stream.on('data', data => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', reject);
    });
}


async function leerArchivoPipe(
    rutaArchivo,
    columnasEsperadas
) {

    const contenido = await fs.promises.readFile(
        rutaArchivo,
        'utf8'
    );

    const lineas = contenido
        .replace(/^\uFEFF/, '') // elimina BOM
        .split(/\r?\n/)
        .map(linea => linea.trim())
        .filter(linea => linea.length > 0);

    if (lineas.length === 0) {
        throw new Error(
            'El archivo está vacío. No se realizará ninguna actualización.'
        );
    }

    const registros = [];

    for (let i = 0; i < lineas.length; i++) {

        const columnas = lineas[i]
            .split('|')
            .map(valor => valor.trim());

        if (columnas.length !== columnasEsperadas) {

            throw new Error(
                `Estructura inválida en línea ${i + 1}. ` +
                `Se esperaban ${columnasEsperadas} columnas ` +
                `y se encontraron ${columnas.length}.`
            );
        }

        registros.push(columnas);
    }

    return registros;
}


module.exports = {
    obtenerMetadataArchivo,
    calcularHashArchivo,
    leerArchivoPipe
};