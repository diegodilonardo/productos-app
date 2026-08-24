/* ============================================================
   PEDIDOS - EVITAR DUPLICADOS ACTIVOS

   Regla:
   La combinación ID_ALTA + CODIGO_PROVEEDOR + NUMERO_ORDEN
   puede existir una sola vez mientras ESTADO <> 'ANULADO'.

   Un pedido ANULADO no impide crear posteriormente otro pedido
   con la misma Alta, proveedor y número de orden.
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (
    SELECT 1
    FROM dbo.PEDIDOS
    WHERE ESTADO <> 'ANULADO'
    GROUP BY ID_ALTA, CODIGO_PROVEEDOR, NUMERO_ORDEN
    HAVING COUNT(*) > 1
)
BEGIN
    THROW 51001, 'Existen pedidos activos duplicados por Alta + Proveedor + Numero de Orden. Corregirlos antes de crear el indice unico.', 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.PEDIDOS')
      AND name = 'UX_PEDIDOS_ALTA_PROVEEDOR_ORDEN_ACTIVO'
)
BEGIN
    CREATE UNIQUE INDEX UX_PEDIDOS_ALTA_PROVEEDOR_ORDEN_ACTIVO
        ON dbo.PEDIDOS (ID_ALTA, CODIGO_PROVEEDOR, NUMERO_ORDEN)
        WHERE ESTADO <> 'ANULADO';
END;
