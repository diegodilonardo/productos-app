/* ============================================================
   RELEVAR REGLAS ERP DE INDUSTRIAS GYD

   Solo lectura. Puede ejecutarse antes y después de importar
   los maestros de GYD para comparar los resultados.
   ============================================================ */

SET NOCOUNT ON;

SELECT
    ID_EMPRESA,
    CODIGO_EMPRESA,
    NOMBRE_EMPRESA,
    MARCA_EMPRESA,
    RUBRO_FACTURACION,
    ACTIVO
FROM dbo.MAESTRO_RUBRO_FACT
WHERE UPPER(LTRIM(RTRIM(MARCA_EMPRESA))) IN
      ('MASSIMO', 'WAKE', 'MARCEL')
ORDER BY
    MARCA_EMPRESA,
    RUBRO_FACTURACION,
    ID_EMPRESA;

SELECT
    ID_EMPRESA,
    MARCA_MODELO,
    LEN(LTRIM(RTRIM(CODIGO_MODELO))) AS LARGO_MODELO,
    COUNT_BIG(*) AS CANTIDAD
FROM dbo.MAESTRO_MODELOS
WHERE UPPER(LTRIM(RTRIM(MARCA_MODELO))) IN
      ('MASSIMO', 'WAKE', 'MARCEL')
GROUP BY
    ID_EMPRESA,
    MARCA_MODELO,
    LEN(LTRIM(RTRIM(CODIGO_MODELO)))
ORDER BY
    MARCA_MODELO,
    LARGO_MODELO,
    ID_EMPRESA;
