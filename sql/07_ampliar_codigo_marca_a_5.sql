/* ============================================================
   AMPLIAR CODIGO_MARCA A 5 CARACTERES

   Tablas impactadas por el relevamiento del 01/09/2026:
   - dbo.MAESTRO_MARCAS      varchar(2) -> varchar(5)
   - dbo.STG_MAESTRO_MARCAS  varchar(3) -> varchar(5)

   ALTAS_PRODUCTOS (varchar(10)) y EMPRESAS_MARCAS
   (varchar(30)) ya admiten códigos de esta longitud.

   El script es transaccional e idempotente.
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.MAESTRO_MARCAS', 'U') IS NULL
        THROW 51020, 'No existe dbo.MAESTRO_MARCAS.', 1;

    IF OBJECT_ID('dbo.STG_MAESTRO_MARCAS', 'U') IS NULL
        THROW 51021, 'No existe dbo.STG_MAESTRO_MARCAS.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.MAESTRO_MARCAS
        WHERE LEN(LTRIM(RTRIM(CODIGO_MARCA))) > 5
    )
        THROW 51022, 'MAESTRO_MARCAS contiene códigos de más de 5 caracteres.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.STG_MAESTRO_MARCAS
        WHERE LEN(LTRIM(RTRIM(CODIGO_MARCA))) > 5
    )
        THROW 51023, 'STG_MAESTRO_MARCAS contiene códigos de más de 5 caracteres.', 1;

    /* Las PK dependen de CODIGO_MARCA y deben recrearse. */
    IF EXISTS
    (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.MAESTRO_MARCAS')
          AND name = 'PK_MAESTRO_MARCAS'
    )
        ALTER TABLE dbo.MAESTRO_MARCAS
            DROP CONSTRAINT PK_MAESTRO_MARCAS;

    IF EXISTS
    (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.STG_MAESTRO_MARCAS')
          AND name = 'PK_STG_MAESTRO_MARCAS'
    )
        ALTER TABLE dbo.STG_MAESTRO_MARCAS
            DROP CONSTRAINT PK_STG_MAESTRO_MARCAS;

    ALTER TABLE dbo.MAESTRO_MARCAS
        ALTER COLUMN CODIGO_MARCA VARCHAR(5) NOT NULL;

    ALTER TABLE dbo.STG_MAESTRO_MARCAS
        ALTER COLUMN CODIGO_MARCA VARCHAR(5) NOT NULL;

    ALTER TABLE dbo.MAESTRO_MARCAS
        ADD CONSTRAINT PK_MAESTRO_MARCAS
            PRIMARY KEY (ID_EMPRESA, CODIGO_MARCA);

    ALTER TABLE dbo.STG_MAESTRO_MARCAS
        ADD CONSTRAINT PK_STG_MAESTRO_MARCAS
            PRIMARY KEY (ID_EMPRESA, CODIGO_MARCA);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    T.name AS TABLA,
    C.name AS COLUMNA,
    TY.name AS TIPO,
    C.max_length AS LARGO,
    C.is_nullable AS ADMITE_NULL
FROM sys.tables T
INNER JOIN sys.columns C
    ON C.object_id = T.object_id
INNER JOIN sys.types TY
    ON TY.user_type_id = C.user_type_id
WHERE T.schema_id = SCHEMA_ID('dbo')
  AND T.name IN ('MAESTRO_MARCAS', 'STG_MAESTRO_MARCAS')
  AND C.name = 'CODIGO_MARCA'
ORDER BY T.name;
