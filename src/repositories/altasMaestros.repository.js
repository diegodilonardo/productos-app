const { getConnection, sql } = require('../config/database');

const maestros = {
  COLOR: { tabla: 'MAESTRO_COLORES', codigo: 'CODIGO_COLOR' },
  MODELO: { tabla: 'MAESTRO_MODELOS', codigo: 'CODIGO_MODELO' },
  MODULO: { tabla: 'MAESTRO_TALLES_MODULOS', codigo: 'CODIGO_MODULO' }
};

async function listar(idEmpresa) {
  const pool = await getConnection();
  const r = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    SELECT * FROM dbo.ALTAS_MAESTROS
    WHERE ID_EMPRESA=@ID_EMPRESA AND ESTADO <> 'ANULADO'
    ORDER BY FECHA_CREACION DESC, ID_ALTA_MAESTRO DESC`);
  return r.recordset;
}

async function conciliarModelosRegistrados(idEmpresa, usuario = 'SISTEMA') {
  const pool = await getConnection();
  const r = await pool.request()
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .input('USUARIO', sql.VarChar(100), usuario)
    .query(`
      DECLARE @CONFIRMADOS TABLE (ID_ALTA_MAESTRO INT);

      UPDATE A
      SET ESTADO='CONFIRMADO_ERP', FECHA_CONFIRMACION_ERP=SYSDATETIME()
      OUTPUT INSERTED.ID_ALTA_MAESTRO INTO @CONFIRMADOS(ID_ALTA_MAESTRO)
      FROM dbo.ALTAS_MAESTROS A
      WHERE A.ID_EMPRESA=@ID_EMPRESA
        AND A.ESTADO='ENVIADO_PRESEA'
        AND (
          (A.TIPO='MODELO' AND EXISTS (
          SELECT 1 FROM dbo.MAESTRO_MODELOS M
          WHERE M.ID_EMPRESA=A.ID_EMPRESA
            AND M.ACTIVO=1
            AND UPPER(LTRIM(RTRIM(M.CODIGO_MODELO)))=UPPER(LTRIM(RTRIM(A.CODIGO)))
          ))
          OR (A.TIPO='COLOR' AND EXISTS (
            SELECT 1 FROM dbo.MAESTRO_COLORES C
            WHERE C.ID_EMPRESA=A.ID_EMPRESA
              AND C.ACTIVO=1
              AND UPPER(LTRIM(RTRIM(C.CODIGO_COLOR)))=UPPER(LTRIM(RTRIM(A.CODIGO)))
          ))
          OR (A.TIPO='MODULO' AND EXISTS (
            SELECT 1 FROM dbo.MAESTRO_TALLES_MODULOS T
            WHERE T.ID_EMPRESA=A.ID_EMPRESA
              AND T.ACTIVO=1
              AND UPPER(LTRIM(RTRIM(T.CODIGO_MODULO)))=UPPER(LTRIM(RTRIM(A.CODIGO)))
          ))
        );

      INSERT dbo.ALTAS_MAESTROS_HISTORIAL
        (ID_ALTA_MAESTRO,ESTADO_ANTERIOR,ESTADO_NUEVO,OBSERVACION,USUARIO)
      SELECT ID_ALTA_MAESTRO,'ENVIADO_PRESEA','CONFIRMADO_ERP',
        'Código encontrado en el maestro sincronizado de Presea',@USUARIO
      FROM @CONFIRMADOS;

      SELECT COUNT(*) CANTIDAD FROM @CONFIRMADOS;`);
  return Number(r.recordset[0]?.CANTIDAD || 0);
}

async function codigosOcupados(idEmpresa, tipo) {
  const def = maestros[tipo];
  const pool = await getConnection();
  const r = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).input('TIPO', sql.VarChar(20), tipo).query(`
    SELECT ${def.codigo} CODIGO FROM dbo.${def.tabla} WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1
    UNION SELECT CODIGO FROM dbo.ALTAS_MAESTROS WHERE ID_EMPRESA=@ID_EMPRESA AND TIPO=@TIPO AND ESTADO <> 'ANULADO'`);
  return r.recordset.map(x => String(x.CODIGO || '').trim().toUpperCase());
}

async function listarModelosParaSugerencia(idEmpresa) {
  const pool = await getConnection();
  const r = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    SELECT CODIGO_MODELO CODIGO, MARCA_MODELO MARCA, RUBRO_MODELO RUBRO, LICENCIA
    FROM dbo.MAESTRO_MODELOS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1
    UNION ALL
    SELECT CODIGO, MARCA, RUBRO, LICENCIA FROM dbo.ALTAS_MAESTROS
    WHERE ID_EMPRESA=@ID_EMPRESA AND TIPO='MODELO' AND ESTADO <> 'ANULADO'`);
  return r.recordset;
}

async function crear(datos) {
  const pool = await getConnection();
  const r = await pool.request()
    .input('ID_EMPRESA', sql.Int, datos.idEmpresa).input('TIPO', sql.VarChar(20), datos.tipo)
    .input('CODIGO', sql.VarChar(20), datos.codigo).input('NOMBRE', sql.VarChar(100), datos.nombre)
    .input('C_PROVEEDO', sql.VarChar(50), datos.cProveedor || null).input('LICENCIA', sql.VarChar(20), datos.licencia || null)
    .input('MARCA', sql.VarChar(20), datos.marca || null).input('RUBRO', sql.VarChar(20), datos.rubro || null)
    .input('DATOS_JSON', sql.NVarChar(sql.MAX), datos.datosJson || null).input('USUARIO', sql.VarChar(100), datos.usuario)
    .query(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;

      DECLARE @RESULTADO TABLE (ID_ALTA_MAESTRO INT);
      DECLARE @REACTIVADO BIT = 0;

      UPDATE dbo.ALTAS_MAESTROS WITH (UPDLOCK, HOLDLOCK)
      SET
        NOMBRE=@NOMBRE,
        C_PROVEEDO=@C_PROVEEDO,
        LICENCIA=@LICENCIA,
        MARCA=@MARCA,
        RUBRO=@RUBRO,
        DATOS_JSON=@DATOS_JSON,
        ESTADO='PENDIENTE_ENVIO',
        ARCHIVO_DBI=NULL,
        USUARIO_CREACION=@USUARIO,
        FECHA_CREACION=SYSDATETIME(),
        USUARIO_ENVIO=NULL,
        FECHA_ENVIO=NULL,
        FECHA_CONFIRMACION_ERP=NULL
      OUTPUT INSERTED.ID_ALTA_MAESTRO
        INTO @RESULTADO(ID_ALTA_MAESTRO)
      WHERE ID_EMPRESA=@ID_EMPRESA
        AND TIPO=@TIPO
        AND CODIGO=@CODIGO
        AND ESTADO='ANULADO';

      IF EXISTS (SELECT 1 FROM @RESULTADO)
      BEGIN
        SET @REACTIVADO = 1;

        INSERT dbo.ALTAS_MAESTROS_HISTORIAL
          (ID_ALTA_MAESTRO,ESTADO_ANTERIOR,ESTADO_NUEVO,OBSERVACION,USUARIO)
        SELECT ID_ALTA_MAESTRO,'ANULADO','PENDIENTE_ENVIO',
          'Código reutilizado mediante una nueva solicitud',@USUARIO
        FROM @RESULTADO;
      END;

      IF NOT EXISTS (SELECT 1 FROM @RESULTADO)
      BEGIN
        INSERT dbo.ALTAS_MAESTROS
          (ID_EMPRESA,TIPO,CODIGO,NOMBRE,C_PROVEEDO,LICENCIA,MARCA,RUBRO,DATOS_JSON,ESTADO,USUARIO_CREACION)
        OUTPUT INSERTED.ID_ALTA_MAESTRO
          INTO @RESULTADO(ID_ALTA_MAESTRO)
        VALUES
          (@ID_EMPRESA,@TIPO,@CODIGO,@NOMBRE,@C_PROVEEDO,@LICENCIA,@MARCA,@RUBRO,@DATOS_JSON,'PENDIENTE_ENVIO',@USUARIO);
      END;

      SELECT A.*, @REACTIVADO AS REACTIVADO
      FROM dbo.ALTAS_MAESTROS A
      INNER JOIN @RESULTADO R
        ON R.ID_ALTA_MAESTRO=A.ID_ALTA_MAESTRO;

      COMMIT TRANSACTION;`);
  return r.recordset[0];
}

async function anularPendiente(idEmpresa, idAltaMaestro, usuario) {
  const pool = await getConnection();
  const r = await pool.request()
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .input('ID_ALTA_MAESTRO', sql.Int, idAltaMaestro)
    .input('USUARIO', sql.VarChar(100), usuario)
    .query(`
      DECLARE @ANULADOS TABLE (ID_ALTA_MAESTRO INT, TIPO VARCHAR(20), CODIGO VARCHAR(20), NOMBRE VARCHAR(100));

      UPDATE dbo.ALTAS_MAESTROS
      SET ESTADO='ANULADO'
      OUTPUT INSERTED.ID_ALTA_MAESTRO, INSERTED.TIPO, INSERTED.CODIGO, INSERTED.NOMBRE
        INTO @ANULADOS(ID_ALTA_MAESTRO,TIPO,CODIGO,NOMBRE)
      WHERE ID_EMPRESA=@ID_EMPRESA
        AND ID_ALTA_MAESTRO=@ID_ALTA_MAESTRO
        AND ESTADO='PENDIENTE_ENVIO';

      INSERT dbo.ALTAS_MAESTROS_HISTORIAL
        (ID_ALTA_MAESTRO,ESTADO_ANTERIOR,ESTADO_NUEVO,OBSERVACION,USUARIO)
      SELECT ID_ALTA_MAESTRO,'PENDIENTE_ENVIO','ANULADO','Solicitud eliminada antes de su envío a Presea',@USUARIO
      FROM @ANULADOS;

      SELECT * FROM @ANULADOS;`);
  return r.recordset[0] || null;
}

async function obtenerPendientesYConfiguracion(idEmpresa) {
  const pool = await getConnection();
  const [pendientes, configuracion] = await Promise.all([
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT * FROM dbo.ALTAS_MAESTROS WHERE ID_EMPRESA=@ID_EMPRESA AND ESTADO='PENDIENTE_ENVIO' ORDER BY TIPO,CODIGO`),
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT RUTA_DESTINO FROM dbo.ALTAS_MAESTROS_CONFIGURACION WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1`)
  ]);
  return { registros: pendientes.recordset, rutaDestino: configuracion.recordset[0]?.RUTA_DESTINO || null };
}

async function marcarEnviados(idEmpresa, ids, archivos, usuario) {
  if (!ids.length) return;
  const pool = await getConnection();
  const request = pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).input('USUARIO', sql.VarChar(100), usuario).input('IDS', sql.VarChar(sql.MAX), ids.join(','));
  await request.query(`
    UPDATE dbo.ALTAS_MAESTROS SET ESTADO='ENVIADO_PRESEA', USUARIO_ENVIO=@USUARIO, FECHA_ENVIO=SYSDATETIME(),
      ARCHIVO_DBI=CASE TIPO WHEN 'COLOR' THEN 'TBL_COLORES.DBI' WHEN 'MODELO' THEN 'TBL_MODELOS.DBI' ELSE 'TALLES_MODULOS.DBI' END
    WHERE ID_EMPRESA=@ID_EMPRESA AND ESTADO='PENDIENTE_ENVIO' AND ID_ALTA_MAESTRO IN (SELECT TRY_CONVERT(INT,value) FROM STRING_SPLIT(@IDS,','));
    INSERT dbo.ALTAS_MAESTROS_HISTORIAL(ID_ALTA_MAESTRO,ESTADO_ANTERIOR,ESTADO_NUEVO,OBSERVACION,USUARIO)
    SELECT TRY_CONVERT(INT,value),'PENDIENTE_ENVIO','ENVIADO_PRESEA','DBI enviado a la carpeta configurada',@USUARIO FROM STRING_SPLIT(@IDS,',');`);
}

async function listarReglasEan(idEmpresa) {
  const pool = await getConnection();
  const r = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    SELECT ID_REGLA_EAN, MARCA, RUBRO, LICENCIA, REQUIERE_EAN, USUARIO_ACTUALIZACION, FECHA_ACTUALIZACION
    FROM dbo.REGLAS_REQUERIMIENTO_EAN WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1
    ORDER BY MARCA,RUBRO,LICENCIA;`);
  return r.recordset;
}

async function guardarReglaEan(datos) {
  const pool = await getConnection();
  const r = await pool.request()
    .input('ID_EMPRESA', sql.Int, datos.idEmpresa)
    .input('MARCA', sql.VarChar(50), datos.marca)
    .input('RUBRO', sql.VarChar(50), datos.rubro)
    .input('LICENCIA', sql.VarChar(50), datos.licencia)
    .input('REQUIERE_EAN', sql.Bit, datos.requiereEan)
    .input('USUARIO', sql.VarChar(100), datos.usuario).query(`
      MERGE dbo.REGLAS_REQUERIMIENTO_EAN AS T
      USING (SELECT @ID_EMPRESA ID_EMPRESA,@MARCA MARCA,@RUBRO RUBRO,@LICENCIA LICENCIA) AS S
      ON T.ID_EMPRESA=S.ID_EMPRESA AND T.MARCA=S.MARCA AND T.RUBRO=S.RUBRO AND T.LICENCIA=S.LICENCIA
      WHEN MATCHED THEN UPDATE SET REQUIERE_EAN=@REQUIERE_EAN,ACTIVO=1,USUARIO_ACTUALIZACION=@USUARIO,FECHA_ACTUALIZACION=SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT(ID_EMPRESA,MARCA,RUBRO,LICENCIA,REQUIERE_EAN,USUARIO_ACTUALIZACION)
        VALUES(@ID_EMPRESA,@MARCA,@RUBRO,@LICENCIA,@REQUIERE_EAN,@USUARIO)
      OUTPUT INSERTED.*;`);
  return r.recordset[0];
}

async function eliminarReglaEan(idEmpresa, idRegla, usuario) {
  const pool = await getConnection();
  const r = await pool.request().input('ID_EMPRESA',sql.Int,idEmpresa).input('ID',sql.Int,idRegla).input('USUARIO',sql.VarChar(100),usuario).query(`
    UPDATE dbo.REGLAS_REQUERIMIENTO_EAN SET ACTIVO=0,USUARIO_ACTUALIZACION=@USUARIO,FECHA_ACTUALIZACION=SYSDATETIME()
    OUTPUT INSERTED.* WHERE ID_EMPRESA=@ID_EMPRESA AND ID_REGLA_EAN=@ID AND ACTIVO=1;`);
  return r.recordset[0] || null;
}

module.exports = { listar, conciliarModelosRegistrados, codigosOcupados, listarModelosParaSugerencia, crear, anularPendiente, obtenerPendientesYConfiguracion, marcarEnviados, listarReglasEan, guardarReglaEan, eliminarReglaEan };
