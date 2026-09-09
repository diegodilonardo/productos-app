require('dotenv').config();
const path = require('path');
const { regenerarArchivosAlta } = require('../src/services/exportacion.service');

async function main() {
  const idAlta = Number(process.argv[2]);
  if (!Number.isInteger(idAlta) || idAlta <= 0) throw new Error('Indicá un ID_ALTA válido. Ejemplo: npm run regenerar-dbi-alta -- 123');
  const carpetaIndicada = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
  const resultado = await regenerarArchivosAlta(idAlta, { carpeta: carpetaIndicada });
  console.log(`Alta ${resultado.codigoAlta} (${resultado.idAlta}) regenerada sin impacto en SQL ni Presea.`);
  console.log(`Carpeta: ${resultado.carpeta}`);
  for (const archivo of resultado.archivos) console.log(`- ${archivo.archivo}: ${archivo.registros} registro(s)`);
}

main().then(() => process.exit(0)).catch(error => { console.error(`ERROR: ${error.message}`); process.exit(1); });
