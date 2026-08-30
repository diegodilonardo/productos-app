# Configuración

La aplicación carga `.env` al iniciar. El archivo contiene secretos y no debe compartirse ni versionarse.

## Aplicación y SQL

- `PORT`: puerto HTTP; defecto `3000`.
- `SESSION_SECRET`: obligatorio; secreto largo y aleatorio.
- `APP_BASE_URL`: URL pública usada en emails.
- `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`: conexión SQL Server.

## FTP

- `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD`.
- `FTP_SECURE`, `FTP_TIMEOUT`, `FTP_VERBOSE`.
- `FTP_REMOTE_PATH`, `FTP_REMOTE_FILENAME`: valores generales heredados.
- `FTP_RETRY_ATTEMPTS`, `FTP_RETRY_DELAY_MS`.
- `FTP_CIRCUIT_FAILURE_THRESHOLD`, `FTP_CIRCUIT_OPEN_MS`, `FTP_CIRCUIT_HALF_OPEN_MAX_MS`, `FTP_CIRCUIT_STATE_PATH`.

Las rutas funcionales por empresa/marca viven en SQL, no en `.env`.

## Archivos y jobs

- `MAESTROS_PATH`, `MAESTROS_TEMP_PATH`, `MAESTROS_CRON`, `MAESTROS_MAX_MS`.
- `PRODUCTOS_ERP_FILE`, `PRODUCTOS_ERP_CRON`, `PRODUCTOS_ERP_MAX_MS`.
- `EXPORT_PATH`, `IMAGENES_PRODUCTOS_PATH`, `SYNC_RESTART_MS`.
- `PROVEEDORES_GOOGLE_SHEET_URL`.

## Email

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- `SMTP_TIMEOUT_MS`, `SMTP_EHLO`, `SMTP_ALLOW_INVALID_CERT`.
- `EMAIL_ALLOWED_DOMAIN`, `EMAIL_VERIFY_MINUTES`, `PASSWORD_RESET_MINUTES`.
