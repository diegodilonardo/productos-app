# Operación

## Inicio

1. Verificar SQL Server y `.env`.
2. En producción, ejecutar `npm start`. El supervisor reinicia el proceso web si `/api/status` falla de forma consecutiva. `npm run start:web` se reserva para diagnóstico sin supervisor.
3. Consultar `/api/status` y logs de jobs.
4. No iniciar schedulers independientes junto con `server.js`.

## Aplicación viva pero sin respuesta

El supervisor consulta `/api/status` fuera del proceso web. Por defecto, tres fallos consecutivos de cinco segundos provocan el reinicio del árbol completo de la aplicación, incluidos trabajos hijos bloqueados. Los valores se configuran con `SUPERVISOR_*`.

El servidor también registra `[SALUD] Event loop bloqueado o demorado` cuando detecta una demora superior a `EVENT_LOOP_WARN_MS`. El registro incluye duración, memoria y tiempo activo para localizar exportaciones o procesos que estén bloqueando Node.

El supervisor debe ser iniciado a su vez como servicio de Windows para que vuelva a levantarse después de reinicios del equipo. No ejecutar simultáneamente `npm start` y `npm run start:web` sobre el mismo puerto.

## Incidentes FTP

### Recuperar un archivo de Altas de Maestros

Si un DBI de colores, modelos o módulos fue eliminado del FTP después de su
envío, puede regenerarse desde el historial de `ALTAS_MAESTROS`.

Primero ejecutar una vista previa indicando la empresa y los IDs exactos:

```powershell
node scripts/reenviar-altas-maestros.js --empresa 70000 --ids 151,152,153
```

La vista previa genera una copia local bajo
`salidas/recuperacion-altas-maestros`, pero no modifica el FTP. Después de
revisar empresa, códigos, archivos y destinos, realizar el envío:

```powershell
node scripts/reenviar-altas-maestros.js --empresa 70000 --ids 151,152,153 --enviar
```

Si el archivo ya existe, el script se detiene. `--sobrescribir` debe utilizarse
solamente después de comprobar que el archivo remoto puede reemplazarse. Cada
reenvío exitoso queda registrado en `ALTAS_MAESTROS_HISTORIAL` sin cambiar el
estado funcional de la solicitud.

También puede recuperarse un período y limitarlo por tipo:

```powershell
node scripts/reenviar-altas-maestros.js --empresa 70000 --desde 2026-10-08 --hasta 2026-10-09 --tipo MODELO
```

Consultar todas las opciones con:

```powershell
node scripts/reenviar-altas-maestros.js --ayuda
```

Los errores transitorios se reintentan. El circuit breaker abre después del umbral y bloquea temporalmente nuevas operaciones. Una exportación fallida conserva archivos locales. No cambiar rutas para sortear permisos: corregir la configuración de la marca.

## Limpieza de pruebas

`sql/Limpiar BD Productos y Pedidos.sql` elimina Altas y Pedidos de todas las empresas, reinicia identities y preserva PRODUCTOS, maestros, usuarios y configuraciones. Requiere backup previo. No elimina archivos locales, imágenes ni FTP.

## Backup mínimo

- Base `PRODUCTOS_APP`.
- `.env` mediante almacenamiento seguro.
- Carpetas de imágenes.
- Configuración y estado de FTP/circuit breaker.
