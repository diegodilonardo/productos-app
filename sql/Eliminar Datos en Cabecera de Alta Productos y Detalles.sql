USE [PRODUCTOS_APP];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/*
============================================================
 LIMPIEZA DE DATOS DE PRODUCTOS - PRODUCTOS_APP
============================================================

OBJETIVO
--------
Dejar la base lista para repetir el circuito de pruebas desde cero,
SIN eliminar maestros (MAESTRO_*), estructuras, tablas ni configuración.

SE LIMPIAN:
- ALTAS_PRODUCTOS_FAMILIAS_DETALLE
- ALTAS_PRODUCTOS_EXPORTADOS
- ALTAS_PRODUCTOS_DETALLE
- ALTAS_PRODUCTOS
- PRODUCTOS_ERP_STAGING
- PRODUCTOS

NO SE TOCAN:
- MAESTRO_*
- CONTROL_IMPORTACIONES
- estructura de tablas
- usuarios/configuración

IMPORTANTE
----------
Ejecutar sobre la base PRODUCTOS_APP.
El script usa una transacción: si algo falla, hace ROLLBACK.
============================================================
*/

BEGIN TRY

    BEGIN TRANSACTION;

    PRINT '==============================================';
    PRINT ' LIMPIEZA DE PRODUCTOS - INICIO';
    PRINT '==============================================';

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando ALTAS_PRODUCTOS_FAMILIAS_DETALLE...';
        DELETE FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando ALTAS_PRODUCTOS_EXPORTADOS...';
        DELETE FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando ALTAS_PRODUCTOS_DETALLE...';
        DELETE FROM dbo.ALTAS_PRODUCTOS_DETALLE;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando ALTAS_PRODUCTOS...';
        DELETE FROM dbo.ALTAS_PRODUCTOS;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    IF OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando PRODUCTOS_ERP_STAGING...';
        DELETE FROM dbo.PRODUCTOS_ERP_STAGING;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    IF OBJECT_ID('dbo.PRODUCTOS', 'U') IS NOT NULL
    BEGIN
        PRINT 'Limpiando PRODUCTOS...';
        DELETE FROM dbo.PRODUCTOS;
        PRINT CONCAT('  Registros eliminados: ', @@ROWCOUNT);
    END;

    PRINT 'Reiniciando identities...';

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE')
       )
        DBCC CHECKIDENT ('dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE', RESEED, 0) WITH NO_INFOMSGS;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS')
       )
        DBCC CHECKIDENT ('dbo.ALTAS_PRODUCTOS_EXPORTADOS', RESEED, 0) WITH NO_INFOMSGS;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE')
       )
        DBCC CHECKIDENT ('dbo.ALTAS_PRODUCTOS_DETALLE', RESEED, 0) WITH NO_INFOMSGS;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.ALTAS_PRODUCTOS')
       )
        DBCC CHECKIDENT ('dbo.ALTAS_PRODUCTOS', RESEED, 0) WITH NO_INFOMSGS;

    IF OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING')
       )
        DBCC CHECKIDENT ('dbo.PRODUCTOS_ERP_STAGING', RESEED, 0) WITH NO_INFOMSGS;

    IF OBJECT_ID('dbo.PRODUCTOS', 'U') IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM sys.identity_columns
            WHERE object_id = OBJECT_ID('dbo.PRODUCTOS')
       )
        DBCC CHECKIDENT ('dbo.PRODUCTOS', RESEED, 0) WITH NO_INFOMSGS;

    PRINT '';
    PRINT '==============================================';
    PRINT ' CONTROL FINAL';
    PRINT '==============================================';

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE', 'U') IS NOT NULL
        SELECT 'ALTAS_PRODUCTOS_FAMILIAS_DETALLE' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_EXPORTADOS', 'U') IS NOT NULL
        SELECT 'ALTAS_PRODUCTOS_EXPORTADOS' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS_DETALLE', 'U') IS NOT NULL
        SELECT 'ALTAS_PRODUCTOS_DETALLE' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.ALTAS_PRODUCTOS_DETALLE;

    IF OBJECT_ID('dbo.ALTAS_PRODUCTOS', 'U') IS NOT NULL
        SELECT 'ALTAS_PRODUCTOS' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.ALTAS_PRODUCTOS;

    IF OBJECT_ID('dbo.PRODUCTOS_ERP_STAGING', 'U') IS NOT NULL
        SELECT 'PRODUCTOS_ERP_STAGING' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.PRODUCTOS_ERP_STAGING;

    IF OBJECT_ID('dbo.PRODUCTOS', 'U') IS NOT NULL
        SELECT 'PRODUCTOS' AS TABLA, COUNT(*) AS REGISTROS
        FROM dbo.PRODUCTOS;

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '==============================================';
    PRINT ' LIMPIEZA FINALIZADA CORRECTAMENTE';
    PRINT ' Base lista para comenzar las pruebas desde 0.';
    PRINT '==============================================';

END TRY

BEGIN CATCH

    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '==============================================';
    PRINT ' ERROR - SE REALIZO ROLLBACK';
    PRINT '==============================================';

    THROW;

END CATCH;