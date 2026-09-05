/*
  ANULACION ADMINISTRATIVA DE UN ALTA EXPORTADA

  Uso:
  1. Complete ID_EMPRESA, ID_ALTA, USUARIO y MOTIVO.
  2. Ejecute primero con CONFIRMAR = 0 para revisar el diagnóstico.
  3. Si los datos son correctos, cambie CONFIRMAR = 1 y vuelva a ejecutar.

  El script NO elimina detalles, familias, imágenes ni historial de exportaciones.
  Tampoco elimina archivos que hayan llegado al FTP ni revierte productos en el ERP.

  Consideraciones para Dashboard y Seguimiento ERP:
  - El Alta ANULADA se conserva y puede consultarse como histórico.
  - Sus registros de ALTAS_PRODUCTOS_EXPORTADOS también se conservan.
  - Un Alta ANULADA no debe sumar en Productos exportados, Confirmados ERP,
    Pendientes ERP ni Errores ERP.
  - Las consultas operativas deben excluir A.ESTADO = 'ANULADO' y vincular
    exportaciones mediante ID_EMPRESA + ID_ALTA.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ID_EMPRESA INT = 0;                 -- OBLIGATORIO
DECLARE @ID_ALTA INT = 0;                    -- OBLIGATORIO
DECLARE @USUARIO VARCHAR(100) = 'ADMIN';     -- OBLIGATORIO
DECLARE @MOTIVO VARCHAR(500) =
  'Anulación administrativa por interrupción durante la subida de archivos.';
DECLARE @CONFIRMAR BIT = 0;                  -- Cambiar a 1 para aplicar

IF @ID_EMPRESA <= 0
  THROW 51000, 'Debe informar un ID_EMPRESA válido.', 1;

IF @ID_ALTA <= 0
  THROW 51001, 'Debe informar un ID_ALTA válido.', 1;

IF NULLIF(LTRIM(RTRIM(@USUARIO)), '') IS NULL
  THROW 51002, 'Debe informar el usuario administrador.', 1;

IF NULLIF(LTRIM(RTRIM(@MOTIVO)), '') IS NULL
  THROW 51003, 'Debe informar el motivo de anulación.', 1;

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @ESTADO_ACTUAL VARCHAR(50);
  DECLARE @CODIGO_ALTA VARCHAR(100);

  SELECT
    @ESTADO_ACTUAL = UPPER(LTRIM(RTRIM(A.ESTADO))),
    @CODIGO_ALTA = A.CODIGO_ALTA
  FROM dbo.ALTAS_PRODUCTOS A WITH (UPDLOCK, HOLDLOCK)
  WHERE A.ID_EMPRESA = @ID_EMPRESA
    AND A.ID_ALTA = @ID_ALTA;

  IF @ESTADO_ACTUAL IS NULL
    THROW 51004, 'El Alta no existe para la empresa indicada.', 1;

  IF @ESTADO_ACTUAL = 'ANULADO'
    THROW 51005, 'El Alta ya se encuentra anulada.', 1;

  IF @ESTADO_ACTUAL NOT IN ('VALIDADO', 'EXPORTADO', 'PARCIAL_ERP')
    THROW 51006, 'El Alta no está en un estado habilitado para esta anulación excepcional.', 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.PEDIDOS P
    WHERE P.ID_EMPRESA = @ID_EMPRESA
      AND ISNULL(UPPER(LTRIM(RTRIM(P.ESTADO))), '') <> 'ANULADO'
      AND (
        P.ID_ALTA = @ID_ALTA
        OR EXISTS (
          SELECT 1
          FROM dbo.PEDIDOS_ALTAS PA
          WHERE PA.ID_EMPRESA = P.ID_EMPRESA
            AND PA.ID_PEDIDO = P.ID_PEDIDO
            AND PA.ID_ALTA = @ID_ALTA
        )
      )
  )
    THROW 51007, 'El Alta posee Pedidos no anulados. Anule esos Pedidos antes de continuar.', 1;

  SELECT
    'DIAGNOSTICO' AS RESULTADO,
    A.ID_EMPRESA,
    A.ID_ALTA,
    A.CODIGO_ALTA,
    A.ESTADO AS ESTADO_ACTUAL,
    A.ARCHIVO_EXPORTADO,
    A.FECHA_EXPORTACION,
    A.USUARIO_EXPORTACION,
    'Al anular, estos registros quedarán como histórico y no sumarán en Dashboard/Seguimiento ERP.' AS IMPACTO_INDICADORES,
    (SELECT COUNT(*)
     FROM dbo.ALTAS_PRODUCTOS_DETALLE D
     WHERE D.ID_EMPRESA = A.ID_EMPRESA AND D.ID_ALTA = A.ID_ALTA) AS CANTIDAD_DETALLES,
    (SELECT COUNT(*)
     FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E
     WHERE E.ID_EMPRESA = A.ID_EMPRESA AND E.ID_ALTA = A.ID_ALTA) AS REGISTROS_EXPORTACION
  FROM dbo.ALTAS_PRODUCTOS A
  WHERE A.ID_EMPRESA = @ID_EMPRESA
    AND A.ID_ALTA = @ID_ALTA;

  IF @CONFIRMAR = 0
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT
      'SIMULACION' AS RESULTADO,
      @CODIGO_ALTA AS CODIGO_ALTA,
      @ESTADO_ACTUAL AS ESTADO_CONSERVADO,
      'No se realizaron cambios. Establezca @CONFIRMAR = 1 para anular.' AS MENSAJE;
    RETURN;
  END;

  UPDATE dbo.ALTAS_PRODUCTOS
  SET
    ESTADO = 'ANULADO',
    FECHA_ANULACION = SYSDATETIME(),
    USUARIO_ANULACION = LTRIM(RTRIM(@USUARIO)),
    MOTIVO_ANULACION = LTRIM(RTRIM(@MOTIVO))
  OUTPUT
    'ANULACION_APLICADA' AS RESULTADO,
    DELETED.ESTADO AS ESTADO_ANTERIOR,
    INSERTED.ID_EMPRESA,
    INSERTED.ID_ALTA,
    INSERTED.CODIGO_ALTA,
    INSERTED.ESTADO AS ESTADO_NUEVO,
    INSERTED.FECHA_ANULACION,
    INSERTED.USUARIO_ANULACION,
    INSERTED.MOTIVO_ANULACION
  WHERE ID_EMPRESA = @ID_EMPRESA
    AND ID_ALTA = @ID_ALTA
    AND UPPER(LTRIM(RTRIM(ESTADO))) = @ESTADO_ACTUAL;

  IF @@ROWCOUNT <> 1
    THROW 51008, 'No se pudo anular el Alta porque su estado cambió durante la operación.', 1;

  COMMIT TRANSACTION;

  /*
    Control final para el administrador:
    el historial debe continuar presente, pero IMPACTA_INDICADORES_ERP debe ser NO.
  */
  SELECT
    'VERIFICACION_POSTERIOR' AS RESULTADO,
    A.ID_EMPRESA,
    A.ID_ALTA,
    A.CODIGO_ALTA,
    A.ESTADO,
    A.FECHA_ANULACION,
    A.USUARIO_ANULACION,
    A.MOTIVO_ANULACION,
    (SELECT COUNT(*)
     FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS E
     WHERE E.ID_EMPRESA = A.ID_EMPRESA
       AND E.ID_ALTA = A.ID_ALTA) AS REGISTROS_HISTORICOS_EXPORTACION,
    CASE WHEN A.ESTADO = 'ANULADO' THEN 'NO' ELSE 'SI' END AS IMPACTA_INDICADORES_ERP,
    'Visible únicamente como histórico al habilitar Mostrar anuladas.' AS VISIBILIDAD_ESPERADA
  FROM dbo.ALTAS_PRODUCTOS A
  WHERE A.ID_EMPRESA = @ID_EMPRESA
    AND A.ID_ALTA = @ID_ALTA;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0
    ROLLBACK TRANSACTION;

  THROW;
END CATCH;
