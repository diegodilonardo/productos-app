const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    connectionTimeout: Math.max(1000, Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000)),
    requestTimeout: Math.max(1000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 120000)),

    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        // Presea y la aplicación guardan DATETIME con la hora local del servidor.
        // Evita que tedious interprete esos valores como UTC y les reste tres
        // horas al mostrarlos en navegadores de Argentina.
        useUTC: false
    },

    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

async function getConnection() {

    if (!pool) {
        pool = await sql.connect(config);
        console.log('SQL Server conectado');
    }

    return pool;
}

module.exports = {
    sql,
    getConnection
};
