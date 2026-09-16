# Actualizar producción desde Git

Este procedimiento se ejecuta en el servidor, con PowerShell como administrador. Los cambios deben estar probados, confirmados y publicados desde DEV antes de actualizar producción.

## Preparación inicial

Comprobar que Git y Node están instalados y que la carpeta es un repositorio con una rama de seguimiento configurada:

```powershell
git -C C:\productos-app status
git -C C:\productos-app remote -v
git -C C:\productos-app branch -vv
```

Si la aplicación fue copiada sin Git, no inicializar ni clonar encima de ella. Preparar una copia nueva del repositorio en otra carpeta y planificar el cambio del servicio, conservando el `.env`, las imágenes y demás archivos de producción. La rama de producción debe elegirse expresamente; no asumir que es `main`.

Realizar una copia de seguridad de la aplicación y de la base de datos antes de la primera actualización. El usuario que ejecuta el script debe tener acceso al repositorio remoto. No guardar contraseñas ni tokens en el script.

## Actualizaciones posteriores

```powershell
& C:\productos-app\scripts\actualizar-produccion.ps1
```

El script descarga los cambios con el servicio en funcionamiento, comprueba que puede avanzar sin conflictos, detiene el servicio, actualiza el código, instala las dependencias e inicia `ProductosApp`. No ejecuta migraciones de base de datos ni realiza una reversión automática. Revisar la aplicación y los registros después de actualizar.

Si hay modificaciones locales de archivos versionados, se detiene sin sobrescribirlas. No usar `reset --hard` ni `clean` para resolverlas: podrían perderse datos del servidor.

Actualmente hay imágenes de `storage` versionadas en el repositorio. El script bloquea cualquier actualización que cambie `storage`, `salidas`, `tmp` o `.env`; no elimina ni desversiona esos archivos. Hay que separar los datos de producción del código antes de automatizar despliegues que afecten esas carpetas.

Si falla una instalación después de detener el servicio, revisar el error antes de reiniciarlo. Conservar el identificador de la versión anterior que muestra el script para una recuperación controlada.
