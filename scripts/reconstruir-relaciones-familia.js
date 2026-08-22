require('dotenv').config();

const {
  getConnection,
  sql
} = require('../src/config/database');

const mapaTallesModulo = [
  ['T01','01'], ['T02','02'], ['T03','03'], ['T04','04'],
  ['T05','05'], ['T06','06'], ['T07','07'], ['T08','08'],
  ['T10','10'], ['T12','12'], ['T14','14'], ['T15','15'],
  ['T16','16'], ['T17','17'], ['T18','18'], ['T19','19'],
  ['T20','20'], ['T21','21'], ['T22','22'], ['T23','23'],
  ['T24','24'], ['T25','25'], ['T26','26'], ['T27','27'],
  ['T28','28'], ['T29','29'], ['T30','30'], ['T31','31'],
  ['T32','32'], ['T33','33'], ['T34','34'], ['T35','35'],
  ['T36','36'], ['T37','37'], ['T38','38'], ['T385','38.5'],
  ['T39','39'], ['T395','39.5'], ['T40','40'], ['T405','40.5'],
  ['T41','41'], ['T415','41.5'], ['T42','42'], ['T425','42.5'],
  ['T43','43'], ['T435','43.5'], ['T44','44'], ['T445','44.5'],
  ['T45','45'], ['T455','45.5'], ['T46','46'], ['T47','47'],
  ['T48','48'], ['T49','49'], ['T50','50'],
  ['T_XS','XS'], ['T_S','S'], ['T_M','M'], ['T_L','L'],
  ['T_XL','XL'], ['T_2XL','2XL'], ['T_3XL','3XL']
];

function norm(v) {
  return String(v ?? '').trim().toUpperCase();
}

function tallesActivos(modulo) {
  const set = new Set();

  for (const [columna, talle] of mapaTallesModulo) {
    if (Number(modulo[columna] || 0) > 0) {
      set.add(norm(talle));
    }
  }

  return set;
}

async function main() {
  const pool = await getConnection();

  const existeTabla = await pool.request().query(`
    SELECT
      CASE
        WHEN OBJECT_ID(
          'dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE',
          'U'
        ) IS NULL
          THEN 0
        ELSE 1
      END AS EXISTE;
  `);

  if (!existeTabla.recordset[0]?.EXISTE) {
    throw new Error(
      'Primero debe ejecutar sql/010_familias_muchos_a_muchos.sql.'
    );
  }

  const [detallesRes, modulosRes] = await Promise.all([
    pool.request().query(`
      SELECT
        ID_DETALLE,
        ID_ALTA,
        CODIGO_MODELO,
        CODIGO_COLOR,
        CODIGO_MODULO,
        DETALLE_TALLE,
        TIPO_PRODUCTO_DETALLE,
        GENERADO_AUTOMATICO
      FROM dbo.ALTAS_PRODUCTOS_DETALLE;
    `),

    pool.request().query(`
      SELECT *
      FROM dbo.MAESTRO_TALLES_MODULOS
      WHERE ACTIVO = 1;
    `)
  ]);

  const maestroModulo = new Map(
    modulosRes.recordset.map(m => [
      norm(m.CODIGO_MODULO),
      m
    ])
  );

  const porAlta = new Map();

  for (const d of detallesRes.recordset) {
    const idAlta = Number(d.ID_ALTA);

    if (!porAlta.has(idAlta)) {
      porAlta.set(idAlta, []);
    }

    porAlta.get(idAlta).push(d);
  }

  let insertadas = 0;
  let revisadas = 0;

  for (const [idAlta, detalles] of porAlta) {
    const principalesModulo =
      detalles.filter(d =>
        !d.GENERADO_AUTOMATICO &&
        norm(d.TIPO_PRODUCTO_DETALLE) === 'MODULO'
      );

    const automaticos =
      detalles.filter(d =>
        Boolean(d.GENERADO_AUTOMATICO) &&
        norm(d.TIPO_PRODUCTO_DETALLE) === 'PAR_SUELTO'
      );

    for (const padre of principalesModulo) {
      const modulo =
        maestroModulo.get(
          norm(padre.CODIGO_MODULO)
        );

      if (!modulo) {
        console.warn(
          `Alta ${idAlta}: no se encontró maestro del módulo ${padre.CODIGO_MODULO}.`
        );
        continue;
      }

      const talles =
        tallesActivos(modulo);

      const candidatos =
        automaticos.filter(hijo =>
          norm(hijo.CODIGO_MODELO) === norm(padre.CODIGO_MODELO) &&
          norm(hijo.CODIGO_COLOR) === norm(padre.CODIGO_COLOR) &&
          talles.has(norm(hijo.DETALLE_TALLE))
        );

      for (const hijo of candidatos) {
        revisadas++;

        const r = await pool
          .request()
          .input('ID_ALTA', sql.BigInt, idAlta)
          .input(
            'ID_DETALLE_PADRE',
            sql.BigInt,
            padre.ID_DETALLE
          )
          .input(
            'ID_DETALLE_HIJO',
            sql.BigInt,
            hijo.ID_DETALLE
          )
          .query(`
            IF NOT EXISTS
            (
              SELECT 1
              FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
              WHERE
                ID_ALTA = @ID_ALTA
                AND ID_DETALLE_PADRE = @ID_DETALLE_PADRE
                AND ID_DETALLE_HIJO = @ID_DETALLE_HIJO
            )
            BEGIN
              INSERT INTO dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
              (
                ID_ALTA,
                ID_DETALLE_PADRE,
                ID_DETALLE_HIJO
              )
              VALUES
              (
                @ID_ALTA,
                @ID_DETALLE_PADRE,
                @ID_DETALLE_HIJO
              );

              SELECT 1 AS INSERTADO;
            END
            ELSE
            BEGIN
              SELECT 0 AS INSERTADO;
            END;
          `);

        insertadas +=
          Number(
            r.recordset?.[0]?.INSERTADO || 0
          );
      }
    }
  }

  console.log('Reconstrucción finalizada.');
  console.log(`Relaciones revisadas: ${revisadas}`);
  console.log(`Relaciones nuevas: ${insertadas}`);

  await pool.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
