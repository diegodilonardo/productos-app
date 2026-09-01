const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,

    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
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