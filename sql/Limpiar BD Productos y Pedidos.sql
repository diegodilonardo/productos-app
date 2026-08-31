USE PRODUCTOS_APP;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

/*
  SEGURO DE EJECUCION
  -------------------
  0 = solo muestra el alcance; no elimina datos.
  1 = ejecuta la limpieza transaccional.

  Cambiar a 1 unicamente después de revisar el diagnóstico previo.
*/
DECLARE @EJECUTAR_LIMPIEZA bit = 0;

IF @EJECUTAR_LIMPIEZA = 0
BEGIN
    PRINT 'MODO SEGURO: NO SE ELIMINARA NINGUN REGISTRO.';
    PRINT 'Para confirmar la limpieza, cambie @EJECUTAR_LIMPIEZA a 1.';

    SELECT TABLA, REGISTROS
    FROM (
        SELECT 10 AS ORDEN, 'PEDIDOS_EXPORTACIONES' AS TABLA, COUNT_BIG(*) AS REGISTROS FROM dbo.PEDIDOS_EXPORTACIONES
        UNION ALL SELECT 20, 'PEDIDOS_DETALLE', COUNT_BIG(*) FROM dbo.PEDIDOS_DETALLE
        UNION ALL SELECT 30, 'PEDIDOS', COUNT_BIG(*) FROM dbo.PEDIDOS
        UNION ALL SELECT 40, 'ALTAS_PRODUCTOS_FAMILIAS_DETALLE', COUNT_BIG(*) FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
        UNION ALL SELECT 50, 'ALTAS_PRODUCTOS_EXPORTADOS', COUNT_BIG(*) FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS
        UNION ALL SELECT 60, 'ALTAS_PRODUCTOS_DETALLE', COUNT_BIG(*) FROM dbo.ALTAS_PRODUCTOS_DETALLE
        UNION ALL SELECT 70, 'ALTAS_PRODUCTOS', COUNT_BIG(*) FROM dbo.ALTAS_PRODUCTOS
        UNION ALL SELECT 80, 'PRODUCTOS (SE CONSERVA)', COUNT_BIG(*) FROM dbo.PRODUCTOS
    ) AS ALCANCE
    ORDER BY ORDEN;

    RETURN;
END;

PRINT '============================================================';
PRINT ' LIMPIEZA DE DATOS TRANSACCIONALES - PRODUCTOS_APP';
PRINT ' PEDIDOS + ALTAS';
PRINT '============================================================';
PRINT '';

BEGIN TRY

    BEGIN TRANSACTION;

    DECLARE @PRODUCTOS_ERP_ANTES bigint =
        (SELECT COUNT_BIG(*) FROM dbo.PRODUCTOS WITH (HOLDLOCK));


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
       5. VALIDAR ANTES DE CONFIRMAR
       ============================================================ */

    IF EXISTS (SELECT 1 FROM dbo.PEDIDOS_EXPORTACIONES)
       OR EXISTS (SELECT 1 FROM dbo.PEDIDOS_DETALLE)
       OR EXISTS (SELECT 1 FROM dbo.PEDIDOS)
       OR EXISTS (SELECT 1 FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE)
       OR EXISTS (SELECT 1 FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS)
       OR EXISTS (SELECT 1 FROM dbo.ALTAS_PRODUCTOS_DETALLE)
       OR EXISTS (SELECT 1 FROM dbo.ALTAS_PRODUCTOS)
    BEGIN
        THROW 51000, 'La validacion detecto datos transaccionales remanentes.', 1;
    END;

    IF (SELECT COUNT_BIG(*) FROM dbo.PRODUCTOS) <> @PRODUCTOS_ERP_ANTES
    BEGIN
        THROW 51001, 'La cantidad de PRODUCTOS ERP cambio durante la limpieza.', 1;
    END;

    PRINT 'Validacion transaccional: todas las tablas quedaron vacias.';
    PRINT CONCAT('Validacion PRODUCTOS ERP: ', @PRODUCTOS_ERP_ANTES, ' registros conservados.');


    /* ============================================================
       6. CONFIRMAR TRANSACCION
       Solo se alcanza si todas las validaciones fueron correctas.
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
   7. CONTROL FINAL
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
   8. PRODUCTOS ERP DEBE QUEDAR INTACTO
   ============================================================== */

SELECT
    COUNT(*) AS PRODUCTOS_ERP_PRESERVADOS
FROM dbo.PRODUCTOS;
GO



/* ==============================================================
   9. VERIFICAR VALOR ACTUAL DE LOS IDENTITY PRINCIPALES
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
