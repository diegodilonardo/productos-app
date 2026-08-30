USE PRODUCTOS_APP;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '============================================================';
PRINT ' LIMPIEZA DE DATOS TRANSACCIONALES - PRODUCTOS_APP';
PRINT ' PEDIDOS + ALTAS';
PRINT '============================================================';
PRINT '';

BEGIN TRY

    BEGIN TRANSACTION;


    /* ============================================================
       1. PEDIDOS
       Se eliminan primero las tablas hijas.
       ============================================================ */

    IF OBJECT_ID('dbo.PEDIDOS_EXPORTACIONES', 'U') IS NOT NULL
    BEGIN
        DELETE FROM dbo.PEDIDOS_EXPORTACIONES;

        PRINT 'PEDIDOS_EXPORTACIONES eliminada.';
    END;


    IF OBJECT_ID('dbo.PEDIDOS_DETALLE', 'U') IS NOT NULL
    BEGIN
        DELETE FROM dbo.PEDIDOS_DETALLE;

        PRINT 'PEDIDOS_DETALLE eliminada.';
    END;


    IF OBJECT_ID('dbo.PEDIDOS', 'U') IS NOT NULL
    BEGIN
        DELETE FROM dbo.PEDIDOS;

        PRINT 'PEDIDOS eliminada.';
    END;


    /* ============================================================
       2. ALTAS
       Primero relaciones y tablas hijas.
       ============================================================ */

    IF OBJECT_ID(
        'dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE',
        'U'
    ) IS NOT NULL
    BEGIN

        DELETE
        FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE;

        PRINT 'ALTAS_PRODUCTOS_FAMILIAS_DETALLE eliminada.';
    END;


    IF OBJECT_ID(
        'dbo.ALTAS_PRODUCTOS_EXPORTADOS',
        'U'
    ) IS NOT NULL
    BEGIN

        DELETE
        FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS;

        PRINT 'ALTAS_PRODUCTOS_EXPORTADOS eliminada.';
    END;


    IF OBJECT_ID(
        'dbo.ALTAS_PRODUCTOS_DETALLE',
        'U'
    ) IS NOT NULL
    BEGIN

        DELETE
        FROM dbo.ALTAS_PRODUCTOS_DETALLE;

        PRINT 'ALTAS_PRODUCTOS_DETALLE eliminada.';
    END;


    IF OBJECT_ID(
        'dbo.ALTAS_PRODUCTOS',
        'U'
    ) IS NOT NULL
    BEGIN

        DELETE
        FROM dbo.ALTAS_PRODUCTOS;

        PRINT 'ALTAS_PRODUCTOS eliminada.';
    END;



    /* ============================================================
       3. RESET DE IDENTITIES - PEDIDOS

       RESEED 0:
       Si la tabla queda vacía, el próximo IDENTITY será 1.
       ============================================================ */

    IF
        OBJECT_ID(
            'dbo.PEDIDOS_EXPORTACIONES',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.PEDIDOS_EXPORTACIONES'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.PEDIDOS_EXPORTACIONES',
            RESEED,
            0
        );

        PRINT 'Identity PEDIDOS_EXPORTACIONES reiniciado.';
    END;


    IF
        OBJECT_ID(
            'dbo.PEDIDOS_DETALLE',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.PEDIDOS_DETALLE'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.PEDIDOS_DETALLE',
            RESEED,
            0
        );

        PRINT 'Identity PEDIDOS_DETALLE reiniciado.';
    END;


    IF
        OBJECT_ID(
            'dbo.PEDIDOS',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.PEDIDOS'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.PEDIDOS',
            RESEED,
            0
        );

        PRINT 'Identity PEDIDOS reiniciado.';
    END;



    /* ============================================================
       4. RESET DE IDENTITIES - ALTAS
       ============================================================ */

    IF
        OBJECT_ID(
            'dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE',
            RESEED,
            0
        );

        PRINT 'Identity ALTAS_PRODUCTOS_FAMILIAS_DETALLE reiniciado.';
    END;


    IF
        OBJECT_ID(
            'dbo.ALTAS_PRODUCTOS_EXPORTADOS',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.ALTAS_PRODUCTOS_EXPORTADOS'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.ALTAS_PRODUCTOS_EXPORTADOS',
            RESEED,
            0
        );

        PRINT 'Identity ALTAS_PRODUCTOS_EXPORTADOS reiniciado.';
    END;


    IF
        OBJECT_ID(
            'dbo.ALTAS_PRODUCTOS_DETALLE',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.ALTAS_PRODUCTOS_DETALLE'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.ALTAS_PRODUCTOS_DETALLE',
            RESEED,
            0
        );

        PRINT 'Identity ALTAS_PRODUCTOS_DETALLE reiniciado.';
    END;


    IF
        OBJECT_ID(
            'dbo.ALTAS_PRODUCTOS',
            'U'
        ) IS NOT NULL
        AND
        OBJECTPROPERTY(
            OBJECT_ID(
                'dbo.ALTAS_PRODUCTOS'
            ),
            'TableHasIdentity'
        ) = 1
    BEGIN

        DBCC CHECKIDENT (
            'dbo.ALTAS_PRODUCTOS',
            RESEED,
            0
        );

        PRINT 'Identity ALTAS_PRODUCTOS reiniciado.';
    END;



    /* ============================================================
       5. CONFIRMAR TRANSACCION
       ============================================================ */

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '============================================================';
    PRINT ' LIMPIEZA FINALIZADA CORRECTAMENTE';
    PRINT '============================================================';
    PRINT 'Altas y Pedidos: ELIMINADOS';
    PRINT 'Identities: REINICIADOS';
    PRINT 'PRODUCTOS: CONSERVADO';
    PRINT 'Maestros: CONSERVADOS';
    PRINT 'Usuarios / Empresas / Permisos: CONSERVADOS';
    PRINT '============================================================';

END TRY

BEGIN CATCH

    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '============================================================';
    PRINT ' ERROR - SE REALIZO ROLLBACK';
    PRINT '============================================================';

    PRINT CONCAT(
        'Numero: ',
        ERROR_NUMBER()
    );

    PRINT CONCAT(
        'Linea: ',
        ERROR_LINE()
    );

    PRINT CONCAT(
        'Mensaje: ',
        ERROR_MESSAGE()
    );

    PRINT '============================================================';

    THROW;

END CATCH;
GO



/* ==============================================================
   6. CONTROL FINAL
   ============================================================== */

PRINT '';
PRINT 'CONTROL FINAL';
PRINT '-------------';


SELECT
    'ALTAS_PRODUCTOS' AS TABLA,
    COUNT(*) AS REGISTROS
FROM dbo.ALTAS_PRODUCTOS

UNION ALL

SELECT
    'ALTAS_PRODUCTOS_DETALLE',
    COUNT(*)
FROM dbo.ALTAS_PRODUCTOS_DETALLE

UNION ALL

SELECT
    'ALTAS_PRODUCTOS_EXPORTADOS',
    COUNT(*)
FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS

UNION ALL

SELECT
    'ALTAS_PRODUCTOS_FAMILIAS_DETALLE',
    COUNT(*)
FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE

UNION ALL

SELECT
    'PEDIDOS',
    COUNT(*)
FROM dbo.PEDIDOS

UNION ALL

SELECT
    'PEDIDOS_DETALLE',
    COUNT(*)
FROM dbo.PEDIDOS_DETALLE

UNION ALL

SELECT
    'PEDIDOS_EXPORTACIONES',
    COUNT(*)
FROM dbo.PEDIDOS_EXPORTACIONES;
GO



/* ==============================================================
   7. PRODUCTOS ERP DEBE QUEDAR INTACTO
   ============================================================== */

SELECT
    COUNT(*) AS PRODUCTOS_ERP_PRESERVADOS
FROM dbo.PRODUCTOS;
GO



/* ==============================================================
   8. VERIFICAR VALOR ACTUAL DE LOS IDENTITY PRINCIPALES
   ============================================================== */

DBCC CHECKIDENT (
    'dbo.ALTAS_PRODUCTOS',
    NORESEED
);

DBCC CHECKIDENT (
    'dbo.PEDIDOS',
    NORESEED
);
GO