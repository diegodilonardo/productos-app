/* ============================================================
   PASO 3K25 - DESTINOS DE EXPORTACION DE PEDIDOS

   Configuracion independiente del circuito de Altas.
   Una fila por EMPRESA + MARCA, con un destino para cada archivo.

   IMPORTANTE:
   - El script no inventa rutas.
   - Las filas iniciales quedan inactivas y con destinos NULL.
   - El envio futuro debe bloquearse si ACTIVA = 0 o falta un destino.
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.PEDIDOS_EXPORT_CONFIG', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.PEDIDOS_EXPORT_CONFIG
        (
            ID_PEDIDO_EXPORT_CONFIG BIGINT IDENTITY(1,1) NOT NULL,
            ID_EMPRESA_MARCA        INT NOT NULL,
            RUTA_PEDIDO_EXCEL       VARCHAR(500) NULL,
            RUTA_MASTER_DATA_APP    VARCHAR(500) NULL,
            RUTA_PREC_FOB           VARCHAR(500) NULL,
            ACTIVA                  BIT NOT NULL
                CONSTRAINT DF_PEDIDOS_EXPORT_CONFIG_ACTIVA DEFAULT (0),
            FECHA_CREACION          DATETIME2(0) NOT NULL
                CONSTRAINT DF_PEDIDOS_EXPORT_CONFIG_CREACION DEFAULT (SYSDATETIME()),
            FECHA_ACTUALIZACION     DATETIME2(0) NOT NULL
                CONSTRAINT DF_PEDIDOS_EXPORT_CONFIG_ACTUALIZACION DEFAULT (SYSDATETIME()),

            CONSTRAINT PK_PEDIDOS_EXPORT_CONFIG
                PRIMARY KEY (ID_PEDIDO_EXPORT_CONFIG),
            CONSTRAINT UQ_PEDIDOS_EXPORT_CONFIG_EMPRESA_MARCA
                UNIQUE (ID_EMPRESA_MARCA),
            CONSTRAINT FK_PEDIDOS_EXPORT_CONFIG_EMPRESA_MARCA
                FOREIGN KEY (ID_EMPRESA_MARCA)
                REFERENCES dbo.EMPRESAS_MARCAS (ID_EMPRESA_MARCA),
            CONSTRAINT CK_PEDIDOS_EXPORT_CONFIG_ACTIVA_COMPLETA
                CHECK
                (
                    ACTIVA = 0
                    OR
                    (
                        NULLIF(LTRIM(RTRIM(RUTA_PEDIDO_EXCEL)), '') IS NOT NULL
                        AND NULLIF(LTRIM(RTRIM(RUTA_MASTER_DATA_APP)), '') IS NOT NULL
                        AND NULLIF(LTRIM(RTRIM(RUTA_PREC_FOB)), '') IS NOT NULL
                    )
                )
        );
    END;

    INSERT INTO dbo.PEDIDOS_EXPORT_CONFIG
    (
        ID_EMPRESA_MARCA,
        RUTA_PEDIDO_EXCEL,
        RUTA_MASTER_DATA_APP,
        RUTA_PREC_FOB,
        ACTIVA
    )
    SELECT
        EM.ID_EMPRESA_MARCA,
        NULL,
        NULL,
        NULL,
        0
    FROM dbo.EMPRESAS_MARCAS EM
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.PEDIDOS_EXPORT_CONFIG C
        WHERE C.ID_EMPRESA_MARCA = EM.ID_EMPRESA_MARCA
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    E.ID_EMPRESA,
    E.RAZON_SOCIAL,
    EM.CODIGO_MARCA,
    C.RUTA_PEDIDO_EXCEL,
    C.RUTA_MASTER_DATA_APP,
    C.RUTA_PREC_FOB,
    C.ACTIVA
FROM dbo.PEDIDOS_EXPORT_CONFIG C
INNER JOIN dbo.EMPRESAS_MARCAS EM
    ON EM.ID_EMPRESA_MARCA = C.ID_EMPRESA_MARCA
INNER JOIN dbo.EMPRESAS E
    ON E.ID_EMPRESA = EM.ID_EMPRESA
ORDER BY E.ID_EMPRESA, EM.CODIGO_MARCA;
