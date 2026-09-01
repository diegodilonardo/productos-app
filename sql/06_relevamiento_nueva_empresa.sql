/* ============================================================
   RELEVAMIENTO PARA INCORPORAR UNA NUEVA EMPRESA

   Este script es de SOLO LECTURA. No modifica datos.
   Ejecutarlo en la base utilizada por Productos App y copiar
   todos los resultados antes de preparar el alta definitiva.
   ============================================================ */

SET NOCOUNT ON;

/* 1. Empresas y configuración general. */
SELECT
    E.*,
    C.*
FROM dbo.EMPRESAS E
LEFT JOIN dbo.EMPRESAS_CONFIG C
    ON C.ID_EMPRESA = E.ID_EMPRESA
ORDER BY E.ID_EMPRESA;

/* 2. Marcas vinculadas a cada empresa. */
SELECT
    E.ID_EMPRESA,
    E.CODIGO_EMPRESA,
    E.RAZON_SOCIAL,
    EM.*,
    MM.DETALLE_MARCA
FROM dbo.EMPRESAS E
INNER JOIN dbo.EMPRESAS_MARCAS EM
    ON EM.ID_EMPRESA = E.ID_EMPRESA
LEFT JOIN dbo.MAESTRO_MARCAS MM
    ON MM.ID_EMPRESA = EM.ID_EMPRESA
   AND MM.CODIGO_MARCA = EM.CODIGO_MARCA
ORDER BY E.ID_EMPRESA, EM.CODIGO_MARCA;

/* 3. Configuración de exportación de Altas por empresa/marca. */
SELECT
    E.ID_EMPRESA,
    E.RAZON_SOCIAL,
    EM.CODIGO_MARCA,
    MM.DETALLE_MARCA,
    C.*
FROM dbo.EMPRESAS_MARCAS_EXPORT_CONFIG C
INNER JOIN dbo.EMPRESAS_MARCAS EM
    ON EM.ID_EMPRESA_MARCA = C.ID_EMPRESA_MARCA
INNER JOIN dbo.EMPRESAS E
    ON E.ID_EMPRESA = EM.ID_EMPRESA
LEFT JOIN dbo.MAESTRO_MARCAS MM
    ON MM.ID_EMPRESA = EM.ID_EMPRESA
   AND MM.CODIGO_MARCA = EM.CODIGO_MARCA
ORDER BY E.ID_EMPRESA, EM.CODIGO_MARCA;

/* 4. Configuración de exportación de Pedidos. */
SELECT
    E.ID_EMPRESA,
    E.RAZON_SOCIAL,
    EM.CODIGO_MARCA,
    MM.DETALLE_MARCA,
    C.*
FROM dbo.PEDIDOS_EXPORT_CONFIG C
INNER JOIN dbo.EMPRESAS_MARCAS EM
    ON EM.ID_EMPRESA_MARCA = C.ID_EMPRESA_MARCA
INNER JOIN dbo.EMPRESAS E
    ON E.ID_EMPRESA = EM.ID_EMPRESA
LEFT JOIN dbo.MAESTRO_MARCAS MM
    ON MM.ID_EMPRESA = EM.ID_EMPRESA
   AND MM.CODIGO_MARCA = EM.CODIGO_MARCA
ORDER BY E.ID_EMPRESA, EM.CODIGO_MARCA;

/* 5. Rubros disponibles por empresa. */
SELECT
    ID_EMPRESA,
    CODIGO_RUBRO,
    DETALLE_RUBRO,
    ACTIVO
FROM dbo.MAESTRO_RUBROS
ORDER BY ID_EMPRESA, CODIGO_RUBRO;

/* 6. Volumen de maestros críticos actualmente importados. */
SELECT 'MAESTRO_MARCAS' AS TABLA, ID_EMPRESA, COUNT_BIG(*) AS REGISTROS
FROM dbo.MAESTRO_MARCAS GROUP BY ID_EMPRESA
UNION ALL
SELECT 'MAESTRO_MODELOS', ID_EMPRESA, COUNT_BIG(*)
FROM dbo.MAESTRO_MODELOS GROUP BY ID_EMPRESA
UNION ALL
SELECT 'MAESTRO_TALLES_MODULOS', ID_EMPRESA, COUNT_BIG(*)
FROM dbo.MAESTRO_TALLES_MODULOS GROUP BY ID_EMPRESA
UNION ALL
SELECT 'PRODUCTOS', ID_EMPRESA, COUNT_BIG(*)
FROM dbo.PRODUCTOS GROUP BY ID_EMPRESA
ORDER BY ID_EMPRESA, TABLA;

/* 7. Definición real de las tablas que intervienen en el alta. */
SELECT
    T.name AS TABLA,
    C.column_id AS ORDEN,
    C.name AS COLUMNA,
    TY.name AS TIPO,
    C.max_length AS LARGO_BYTES,
    C.precision AS PRECISION,
    C.scale AS ESCALA,
    C.is_nullable AS ADMITE_NULL,
    C.is_identity AS ES_IDENTITY,
    DC.definition AS VALOR_DEFAULT
FROM sys.tables T
INNER JOIN sys.columns C
    ON C.object_id = T.object_id
INNER JOIN sys.types TY
    ON TY.user_type_id = C.user_type_id
LEFT JOIN sys.default_constraints DC
    ON DC.parent_object_id = C.object_id
   AND DC.parent_column_id = C.column_id
WHERE T.schema_id = SCHEMA_ID('dbo')
  AND T.name IN
  (
      'EMPRESAS',
      'EMPRESAS_CONFIG',
      'EMPRESAS_MARCAS',
      'MAESTRO_MARCAS',
      'EMPRESAS_MARCAS_EXPORT_CONFIG',
      'PEDIDOS_EXPORT_CONFIG',
      'MAESTRO_RUBROS'
  )
ORDER BY T.name, C.column_id;

/* 8. Impacto de ampliar CODIGO_MARCA para admitir códigos de hasta 5 caracteres. */
SELECT
    SCHEMA_NAME(T.schema_id) AS ESQUEMA,
    T.name AS TABLA,
    C.name AS COLUMNA,
    TY.name AS TIPO,
    C.max_length AS LARGO_BYTES,
    C.is_nullable AS ADMITE_NULL
FROM sys.tables T
INNER JOIN sys.columns C
    ON C.object_id = T.object_id
INNER JOIN sys.types TY
    ON TY.user_type_id = C.user_type_id
WHERE C.name = 'CODIGO_MARCA'
ORDER BY ESQUEMA, TABLA;

SELECT
    OBJECT_SCHEMA_NAME(I.object_id) AS ESQUEMA,
    OBJECT_NAME(I.object_id) AS TABLA,
    I.name AS INDICE,
    I.is_unique AS ES_UNICO,
    C.name AS COLUMNA,
    IC.key_ordinal AS ORDEN_CLAVE
FROM sys.indexes I
INNER JOIN sys.index_columns IC
    ON IC.object_id = I.object_id
   AND IC.index_id = I.index_id
INNER JOIN sys.columns C
    ON C.object_id = IC.object_id
   AND C.column_id = IC.column_id
WHERE C.name = 'CODIGO_MARCA'
ORDER BY ESQUEMA, TABLA, INDICE, IC.key_ordinal;

SELECT
    FK.name AS CLAVE_FORANEA,
    OBJECT_SCHEMA_NAME(FK.parent_object_id) AS ESQUEMA_HIJA,
    OBJECT_NAME(FK.parent_object_id) AS TABLA_HIJA,
    CP.name AS COLUMNA_HIJA,
    OBJECT_SCHEMA_NAME(FK.referenced_object_id) AS ESQUEMA_PADRE,
    OBJECT_NAME(FK.referenced_object_id) AS TABLA_PADRE,
    CR.name AS COLUMNA_PADRE
FROM sys.foreign_keys FK
INNER JOIN sys.foreign_key_columns FKC
    ON FKC.constraint_object_id = FK.object_id
INNER JOIN sys.columns CP
    ON CP.object_id = FKC.parent_object_id
   AND CP.column_id = FKC.parent_column_id
INNER JOIN sys.columns CR
    ON CR.object_id = FKC.referenced_object_id
   AND CR.column_id = FKC.referenced_column_id
WHERE CP.name = 'CODIGO_MARCA'
   OR CR.name = 'CODIGO_MARCA'
ORDER BY CLAVE_FORANEA;
