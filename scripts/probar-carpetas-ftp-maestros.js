require('dotenv').config({ quiet: true });
const ftp = require('basic-ftp');
const { Readable } = require('node:stream');
const { getConnection } = require('../src/config/database');
const { agruparArchivosMaestros, resolverRutaDestinoMaestros } = require('../src/services/altasMaestros.service');

(async () => {
  const pool = await getConnection();
  const client = new ftp.Client(Number(process.env.FTP_TIMEOUT || 30000));
  try {
    const result = await pool.request().query('SELECT ID_EMPRESA,RUTA_DESTINO FROM dbo.ALTAS_MAESTROS_CONFIGURACION WHERE ACTIVO=1 ORDER BY ID_EMPRESA');
    const marcas = { 1: ['ATOMIK'], 2: ['47_STREET','MONTAGNE'], 3: ['WAKE','MARCEL','MASSIMO'], 4: ['BAGUNZA'] };
    const nombre = `PRUEBA_RUTAS_MAESTROS_${Date.now()}.txt`;
    const rutas = new Set();
    for (const config of result.recordset) {
      const base = resolverRutaDestinoMaestros(config.RUTA_DESTINO);
      if (!base || !marcas[config.ID_EMPRESA]) throw new Error(`Configuración no prevista para empresa ${config.ID_EMPRESA}`);
      rutas.add(base);
      const registros = [];
      for (const marca of marcas[config.ID_EMPRESA]) {
        for (const rubro of ['ACCESORIOS','CALZADO','INDUMENTARIA']) {
          const licencias = marca === 'ATOMIK' ? ['SIN LICENCIA','SAN LORENZO','VELEZ SARSFIELD','TALLERES'] : ['SIN LICENCIA'];
          for (const licencia of licencias) registros.push({ TIPO:'MODELO', MARCA:marca, RUBRO:rubro, LICENCIA:licencia });
        }
      }
      for (const grupo of agruparArchivosMaestros(registros, base)) rutas.add(grupo.ruta);
    }
    await client.access({ host:process.env.FTP_HOST, port:Number(process.env.FTP_PORT || 21), user:process.env.FTP_USER, password:process.env.FTP_PASSWORD, secure:['true','1'].includes(String(process.env.FTP_SECURE).toLowerCase()) });
    let confirmados = 0;
    for (const ruta of rutas) {
      const contenido = Buffer.from(`PRUEBA DE CONECTIVIDAD - NO IMPORTAR EN PRESEA\r\nDestino: ${ruta}\r\n`);
      await client.ensureDir(ruta);
      if ((await client.list()).some(item => item.name === nombre)) throw new Error(`El archivo ya existe en ${ruta}`);
      await client.uploadFrom(Readable.from(contenido), nombre);
      const archivo = (await client.list()).find(item => item.name === nombre);
      if (!archivo || archivo.size !== contenido.length) throw new Error(`No se verificó la recepción en ${ruta}`);
      confirmados++;
      console.log(`VERIFICADO ${ruta}/${nombre} (${archivo.size} bytes)`);
    }
    console.log(`RESULTADO: ${confirmados}/${rutas.size} carpetas verificadas. Archivo: ${nombre}`);
  } finally {
    client.close();
    await pool.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
