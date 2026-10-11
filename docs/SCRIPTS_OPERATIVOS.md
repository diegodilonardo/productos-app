# Scripts operativos de PRODUCTOS APP

Esta guía documenta los procesos ejecutables disponibles en el proyecto. Antes de utilizar un script en producción, abrir PowerShell en `C:\productos-app`, comprobar que el archivo `.env` corresponde al servidor y realizar un backup cuando el proceso modifique datos.

## Referencia rápida

| Script o comando | Finalidad | Modifica datos | Uso habitual |
|---|---|---:|---|
| `actualizar-produccion.ps1` | Actualizar la aplicación publicada | Sí, código y servicio | Producción |
| `publicar-dev.ps1` | Publicar cambios desde desarrollo | Sí, Git remoto | Desarrollo |
| `backup-productos-app.ps1` | Backup FULL o DIFF de SQL Server | Crea y elimina backups vencidos | Producción |
| `instalar-tareas-backup-sql.ps1` | Crear tareas programadas de backup | Sí, Programador de tareas | Instalación |
| `reenviar-altas-maestros.js` | Recuperar DBI de maestros eliminados del FTP | Opcional | Incidente FTP |
| `regenerar-dbi-alta.js` | Regenerar DBI de un Alta en una carpeta local | No | Diagnóstico/recuperación |
| `probar-exportacion-id.js` | Simular RELFORMU y RELACION de un Alta | No | Diagnóstico |
| `sincronizar-proveedores.js` | Actualizar el maestro de proveedores | Sí, SQL | Mantenimiento |
| `organizar-imagenes-productos.js` | Organizar imágenes antiguas por empresa/marca/rubro/licencia | Solo con `--apply` | Migración |
| `registrar-imagenes-altas-existentes.js` | Registrar imágenes físicas existentes en SQL | Solo con `--apply` | Migración |
| `reconstruir-relaciones-familia.js` | Reconstruir relaciones módulo–familia | Sí, SQL | Reparación controlada |
| `probar-carpetas-ftp-maestros.js` | Comprobar acceso a las carpetas FTP de maestros | Crea archivos de prueba | Diagnóstico FTP |
| `npm test` | Ejecutar las pruebas automáticas | No | Antes de publicar |
| `npm start` | Iniciar la aplicación con supervisor | Ejecuta la aplicación | Producción |
| `npm run dev` | Iniciar desarrollo con recarga automática | Ejecuta la aplicación | Desarrollo |
| `npm run importar-maestros-multiempresa` | Importar maestros de Presea | Sí, SQL | Sincronización manual |
| `npm run sincronizar-productos-erp` | Sincronizar productos y confirmaciones ERP | Sí, SQL | Sincronización manual |

## 1. Publicación y actualización

### `scripts/publicar-dev.ps1`

Publica los cambios del ambiente de desarrollo en la rama configurada.

```powershell
& C:\productos-app\scripts\publicar-dev.ps1 `
  -Mensaje "Descripción breve del cambio"
```

El proceso:

1. Verifica que la rama sea `codex/descarga-imagenes-alta`.
2. Excluye credenciales, imágenes, DBI, logs y carpetas de datos.
3. Ejecuta todas las pruebas.
4. Muestra los archivos que se publicarán.
5. Solicita escribir `SI` antes del commit y push.

**Modifica:** el repositorio Git local y remoto.

**No usar si:** existen archivos previamente preparados en Git o cambios que todavía no fueron revisados.

### `scripts/actualizar-produccion.ps1`

Actualiza el servidor con la versión publicada y reinicia el servicio.

```powershell
& C:\productos-app\scripts\actualizar-produccion.ps1
```

Parámetros opcionales:

```powershell
& C:\productos-app\scripts\actualizar-produccion.ps1 `
  -RutaApp 'C:\productos-app' `
  -Servicio 'ProductosApp'
```

Requisitos:

- PowerShell abierto como administrador.
- Servicio iniciado antes de comenzar.
- Repositorio sin modificaciones locales versionadas.
- Archivo `.env` presente.
- Git y npm instalados.

El script solamente permite avance directo de la rama, instala dependencias con `npm ci --omit=dev` y vuelve a iniciar el servicio. No realiza una reversión automática si la actualización falla.

## 2. Backups de SQL Server

### `scripts/backup-productos-app.ps1`

Genera un backup con `CHECKSUM`, lo verifica con `RESTORE VERIFYONLY` y realiza una copia externa.

Backup completo:

```powershell
& C:\productos-app\scripts\backup-productos-app.ps1 -Tipo FULL
```

Backup diferencial:

```powershell
& C:\productos-app\scripts\backup-productos-app.ps1 -Tipo DIFF
```

Valores predeterminados:

- Instancia: `.\SQLEXPRESS`
- Base: `PRODUCTOS_APP`
- Carpeta local: `C:\SQLBackups\PRODUCTOS_APP`
- Retención local: 14 días
- Copia externa: `\\192.168.106.79\sistemas_otros\Bckp_APP_PRODUCTOS`
- Retención externa: 30 días

Ejemplo personalizado:

```powershell
& C:\productos-app\scripts\backup-productos-app.ps1 `
  -Tipo FULL `
  -Instancia '.\SQLEXPRESS' `
  -DiasRetencion 21
```

Requiere `sqlcmd`, permisos de backup en SQL Server y acceso de escritura a ambas carpetas. Elimina únicamente backups vencidos que coincidan con el patrón administrado por el script.

### `scripts/instalar-tareas-backup-sql.ps1`

Instala las tareas automáticas bajo `\ProductosApp\`:

- FULL diario a las 02:00.
- DIFF diario a las 08:00.
- DIFF diario a las 14:00.
- DIFF diario a las 20:00.

```powershell
& C:\productos-app\scripts\instalar-tareas-backup-sql.ps1
```

Solicita las credenciales de la cuenta que ejecutará las tareas y reemplaza tareas existentes con los mismos nombres.

Comprobación manual recomendada:

```powershell
Start-ScheduledTask `
  -TaskPath '\ProductosApp\' `
  -TaskName 'Backup SQL DIFF 08'

Get-ScheduledTaskInfo `
  -TaskPath '\ProductosApp\' `
  -TaskName 'Backup SQL DIFF 08'
```

## 3. Recuperación de archivos de maestros

### `scripts/reenviar-altas-maestros.js`

Regenera y reenvía archivos históricos de colores, modelos y módulos cuando el DBI fue eliminado del FTP.

Archivos admitidos:

- `TBL_COLORES.DBI`
- `TBL_MODELOS.DBI`
- `TALLES_MODULOS.DBI`

Primero ejecutar una vista previa:

```powershell
node C:\productos-app\scripts\reenviar-altas-maestros.js `
  --empresa 70000 `
  --ids 170
```

La vista previa genera el DBI localmente y muestra registros y destino, pero no modifica el FTP.

Después de revisar el resultado, enviar:

```powershell
node C:\productos-app\scripts\reenviar-altas-maestros.js `
  --empresa 70000 `
  --ids 170 `
  --enviar
```

Varios IDs:

```powershell
node C:\productos-app\scripts\reenviar-altas-maestros.js `
  --empresa 70000 `
  --ids 168,169,170 `
  --enviar
```

Selección por período y tipo:

```powershell
node C:\productos-app\scripts\reenviar-altas-maestros.js `
  --empresa 70000 `
  --desde 2026-10-08 `
  --hasta 2026-10-09 `
  --tipo MODELO
```

Opciones:

- `--empresa`: código de empresa obligatorio.
- `--ids`: IDs visibles en Maestros → Solicitudes.
- `--desde` y `--hasta`: fechas en formato `AAAA-MM-DD`.
- `--tipo`: `COLOR`, `MODELO`, `MODULO` o `TODOS`.
- `--enviar`: habilita la escritura en FTP.
- `--sobrescribir`: permite reemplazar un archivo remoto existente.
- `--ayuda`: muestra la ayuda incorporada.

Por seguridad, si el archivo existe en destino el script se detiene. No usar `--sobrescribir` sin revisar previamente qué archivo será reemplazado. El reenvío queda auditado sin cambiar el estado funcional de la solicitud.

## 4. Regeneración y prueba de Altas

### `scripts/regenerar-dbi-alta.js`

Regenera todos los DBI de un Alta en una carpeta local, sin enviar al FTP y sin cambiar estados en SQL.

```powershell
node C:\productos-app\scripts\regenerar-dbi-alta.js 62
```

Carpeta de salida personalizada:

```powershell
node C:\productos-app\scripts\regenerar-dbi-alta.js `
  62 `
  C:\Temp\Alta62
```

También puede ejecutarse mediante npm:

```powershell
npm run regenerar-dbi-alta -- 62
```

Uso recomendado: revisar una exportación, recuperar copias locales o comparar archivos. No reemplaza el circuito normal de exportación de la aplicación.

### `scripts/probar-exportacion-id.js`

Genera solamente archivos de prueba `RELFORMU` y `RELACION` para un Alta.

```powershell
node C:\productos-app\scripts\probar-exportacion-id.js 62
```

Garantías del script:

- No envía archivos al FTP.
- No cambia el estado del Alta.
- No modifica estados de productos.
- No registra una exportación real.

Los archivos se generan bajo una carpeta temporal de prueba. Se utiliza para analizar relaciones entre módulos y sus integrantes.

## 5. Sincronizaciones manuales

### `npm run importar-maestros-multiempresa`

Importa los maestros descargados para todas las empresas configuradas.

```powershell
npm run importar-maestros-multiempresa
```

Para una sola empresa:

```powershell
npm run importar-maestros-multiempresa -- --empresa=70000
```

**Modifica SQL:** actualiza los maestros de la aplicación con la información de Presea.

### `npm run importar-maestros`

Ejecuta el importador general de maestros sobre los archivos configurados.

```powershell
npm run importar-maestros
```

Este comando se conserva para compatibilidad. En un entorno multiempresa debe preferirse `importar-maestros-multiempresa`.

### `src/jobs/descargarMaestrosFTPManual.js`

Descarga manualmente los archivos de maestros desde las carpetas FTP configuradas para las empresas.

```powershell
node C:\productos-app\src\jobs\descargarMaestrosFTPManual.js
```

Descarga archivos; no realiza por sí solo la importación completa en SQL.

### `npm run sincronizar-productos-erp`

Sincroniza el maestro de productos de Presea y concilia Altas pendientes.

```powershell
npm run sincronizar-productos-erp
```

Para una empresa:

```powershell
npm run sincronizar-productos-erp -- --empresa=70000
```

**Modifica SQL:** incorpora o actualiza productos y estados de confirmación ERP.

### `scripts/sincronizar-proveedores.js`

Descarga el origen configurado y actualiza el maestro de proveedores.

```powershell
node C:\productos-app\scripts\sincronizar-proveedores.js
```

**Modifica SQL.** Utilizar cuando el proveedor existe en el origen externo pero todavía no aparece en la aplicación.

## 6. Imágenes

### `scripts/organizar-imagenes-productos.js`

Organiza imágenes antiguas que quedaron planas en la raíz de imágenes hacia la estructura:

```text
Empresa / Marca / Rubro / Licencia / archivo
```

Simulación:

```powershell
npm run organizar-imagenes
```

Aplicación real:

```powershell
node C:\productos-app\scripts\organizar-imagenes-productos.js --apply
```

La ejecución con `--apply` copia archivos a sus destinos; no elimina los originales. Informa archivos sin relación, existentes y conflictos de tamaño.

### `scripts/registrar-imagenes-altas-existentes.js`

Relaciona en SQL las imágenes físicas existentes con las familias de las Altas.

Simulación:

```powershell
npm run registrar-imagenes-existentes
```

Aplicación:

```powershell
npm run registrar-imagenes-existentes:aplicar
```

La simulación solamente informa cantidades. La opción `:aplicar` registra relaciones en `ALTAS_PRODUCTOS_IMAGENES`; no reemplaza archivos.

## 7. Reparaciones controladas

### `scripts/reconstruir-relaciones-familia.js`

Reconstruye relaciones faltantes entre módulos principales y pares sueltos automáticos utilizando modelo, color y talles activos de la curva.

```powershell
node C:\productos-app\scripts\reconstruir-relaciones-familia.js
```

**Modifica SQL directamente.** Requiere que exista la tabla `ALTAS_PRODUCTOS_FAMILIAS_DETALLE`. Solo inserta relaciones que todavía no existen.

Este script debe ejecutarse únicamente:

1. Con backup reciente.
2. Después de revisar el incidente.
3. En una ventana de mantenimiento.
4. Verificando luego las Altas afectadas y sus exportaciones.

## 8. Diagnóstico FTP

### `scripts/probar-carpetas-ftp-maestros.js`

Comprueba conexión, permisos y escritura en todas las rutas previstas para Altas de Maestros.

```powershell
node C:\productos-app\scripts\probar-carpetas-ftp-maestros.js
```

El proceso crea un archivo de prueba con nombre `PRUEBA_RUTAS_MAESTROS_<fecha>.txt` en cada destino y verifica su tamaño.

**Importante:** actualmente el script no elimina automáticamente esos archivos de prueba. Deben retirarse del FTP después de la comprobación para evitar que Presea intente procesarlos.

## 9. Usuarios administrativos

### `src/jobs/crearSuperAdmin.js`

Crea un nuevo usuario con privilegios de superadministrador.

```powershell
node C:\productos-app\src\jobs\crearSuperAdmin.js `
  USUARIO `
  "ContraseñaSegura" `
  "Nombre completo"
```

La contraseña debe tener al menos ocho caracteres y no se permite reutilizar un usuario existente.

**Uso excepcional:** después de la instalación inicial o para recuperación administrativa autorizada. No colocar contraseñas en documentación, capturas o historial compartido de terminal.

### `src/jobs/crearFabricio.js`

Script histórico y específico que crea el usuario fijo `FABRICIO` con accesos predefinidos para MIDING/MONTAGNE/CALZADO.

```powershell
node C:\productos-app\src\jobs\crearFabricio.js "ContraseñaSegura"
```

**No es un alta genérica de usuarios y no debe reutilizarse para otras personas.** Para nuevas cuentas utilizar la solapa Usuarios.

## 10. Aplicación, desarrollo y pruebas

### Producción

```powershell
npm start
```

Inicia `src/supervisor.js`, que controla el proceso web y su recuperación. Es la opción recomendada para producción cuando no se inicia mediante el servicio de Windows.

### Servidor web sin supervisor

```powershell
npm run start:web
```

Útil para diagnóstico puntual. No es la modalidad recomendada para mantener producción funcionando.

### Desarrollo

```powershell
npm run dev
```

Utiliza `nodemon` para reiniciar el servidor al detectar cambios.

### Pruebas

```powershell
npm test
```

Ejecuta toda la suite automática. Debe completarse antes de publicar.

## 11. Comandos no recomendados

### `npm run sync`

No utilizar actualmente. `src/jobs/syncAll.js` intenta iniciar `npm run rev`, pero ese comando no está definido en `package.json`. La aplicación de producción ya inicia sus sincronizaciones mediante el servidor y los schedulers configurados.

## 12. Scripts SQL

Los archivos de `sql\` son migraciones, configuraciones, diagnósticos o correcciones puntuales; no son comandos operativos recurrentes. Antes de ejecutar cualquiera:

1. Confirmar que corresponde al ambiente y que no fue aplicado anteriormente.
2. Leer el archivo completo.
3. Realizar backup y, si aplica, una prueba de restauración.
4. Ejecutar primero las consultas de diagnóstico.
5. Conservar el resultado y la fecha de aplicación.

Nunca ejecutar por rutina archivos SQL de limpieza, corrección histórica o configuración de otra empresa.

