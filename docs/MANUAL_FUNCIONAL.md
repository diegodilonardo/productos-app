# Manual funcional básico

Este documento resume las funciones principales de cada solapa de **PRODUCTOS APP**. Las opciones visibles pueden variar según la empresa seleccionada, el rol y los permisos del usuario.

## Selector de empresa y sesión

En la barra superior se muestra la empresa activa y las marcas habilitadas para el usuario.

- La empresa seleccionada determina qué maestros, Altas, Pedidos y seguimientos se consultan.
- Un usuario solamente puede operar sobre las empresas y marcas que tenga asignadas.
- Desde el nombre del usuario se accede al perfil personal.
- **Cerrar sesión** finaliza el acceso a la aplicación.

## Dashboard

Es la pantalla inicial y ofrece un panorama general de la operación.

Funciones principales:

- Consultar el resumen de productos y la situación comercial.
- Visualizar Altas y Pedidos recientes.
- Filtrar la información por proveedor, rubro, año y temporada.
- Alternar entre vista de tarjetas y vista de lista.
- Ingresar rápidamente a una Alta, un Pedido o iniciar un Pedido nuevo.

El Dashboard es informativo: las acciones específicas se completan desde las solapas correspondientes.

## Maestros

Centraliza la consulta y solicitud de datos maestros necesarios para crear productos.

### Gestión de maestros

- Solicitar nuevos modelos, módulos o curvas y otros maestros habilitados.
- Seleccionar marca, rubro, licencia, disciplina y proveedor cuando corresponda.
- Sugerir códigos según las reglas de numeración configuradas.
- Realizar cargas masivas de modelos mediante la plantilla Excel.
- Consultar el estado de cada solicitud.
- Enviar a Presea los archivos DBI pendientes, según permisos.

Antes de registrar una solicitud, la aplicación valida los datos requeridos y, cuando corresponde, advierte si el código o una distribución de talles ya existe.

### Consulta de maestros

- Buscar registros por código o descripción.
- Filtrar modelos, módulos/curvas y productos.
- Consultar su estado en la aplicación y en Presea.
- Exportar resultados para control.

Algunos maestros se comparten entre empresas. Por ese motivo, un registro puede estar disponible aunque se haya incorporado originalmente desde otra empresa del mismo grupo.

### Reglas EAN

Permite mantener los parámetros que intervienen en la gestión de códigos EAN, siempre que el usuario tenga acceso a esa función.

## Reportes

Presenta información consolidada de Pedidos.

Funciones principales:

- Consultar un resumen por proveedor y orden.
- Analizar cantidades de pares e importes.
- Ver el detalle de productos por temporada.
- Filtrar por estado, proveedor, rubro, temporada y año.
- Exportar el resultado a Excel.

La solapa solamente se muestra a los usuarios que tengan el permiso correspondiente.

## Altas

Administra el ciclo de creación y exportación de productos.

### Listado de Altas

- Buscar una Alta o un producto por código, modelo o color.
- Filtrar por estado, año, temporada, rubro, licencia, situación de EAN y envío de fotos.
- Mostrar u ocultar Altas anuladas.
- Alternar entre tarjetas y tabla.
- Consultar indicadores como productos existentes en Presea, fotos enviadas y EAN definitivos.
- Abrir el detalle de una Alta o crear una nueva.

Los resultados se muestran paginados para reducir el tiempo de carga.

### Nueva Alta

La creación comienza con los datos generales:

- Empresa y marca.
- Rubro y tipo de producto.
- Año y temporada.
- Licencia, cuando corresponda. Si no se selecciona una, se exporta como **SIN LICENCIA**.

Una vez creada la cabecera se habilita la carga de productos.

### Productos del Alta

- Agregar productos principales por modelo, proveedor, color y curva/módulo.
- Generar automáticamente la familia de primeras y segundas según la regla del tipo seleccionado.
- Agregar pares sueltos.
- Cargar o reemplazar imágenes. Las imágenes deben tener como mínimo 300 × 300 píxeles y un tamaño máximo de 350 KB.
- Usar talles mixtos, si el usuario tiene permiso, distribuyendo colores y cantidades por talle. El principal se identifica con el color **MIX**.
- Editar color, curva/módulo, clasificación e información adicional de una familia mientras la Alta lo permita.
- Eliminar una familia antes de la exportación.
- Revisar los productos generados y el resumen del lote.

La sugerencia de clasificación o tipo de módulo funciona como orientación; se respeta la selección realizada por el usuario.

### Exportación del Alta

Antes de exportar se presenta una vista previa para revisar la información. Una vez confirmada la exportación, la Alta queda cerrada para modificaciones normales.

Desde el resumen se puede:

- Descargar el Excel de módulos.
- Descargar el Excel de pares sueltos de primera.
- Descargar las imágenes en un archivo ZIP.
- Enviar las fotos a Presea.
- Consultar el seguimiento ERP.

La anulación de una Alta ya exportada no forma parte del circuito normal y debe realizarse mediante un procedimiento controlado por un administrador.

## Pedidos

Permite armar Pedidos comerciales a partir de productos de Altas.

### Listado de Pedidos

- Buscar y filtrar Pedidos.
- Mostrar u ocultar Pedidos anulados.
- Alternar entre tarjetas y lista.
- Consultar proveedor, orden, cantidad de productos, pares, importe y estado.
- Crear un Pedido nuevo o abrir uno existente.

Los resultados se muestran paginados para mejorar la carga de la pantalla.

### Nuevo Pedido

- Seleccionar proveedor, orden y moneda.
- Elegir una o más Altas habilitadas.
- Seleccionar los modelos que formarán parte del Pedido.
- Indicar cantidades y valores comerciales.
- Revisar el resumen antes de validar.

### Detalle y exportaciones

En Pedidos de importación se encuentran, según el estado y los permisos:

- Purchase Order.
- Pedido en Excel.
- Master Data.
- Archivo PREC_FOB.
- Confirmación en COMEX.

Para el proveedor nacional identificado con el código **PB9999**:

- Se genera solamente el Pedido nacional DBI.
- El archivo contiene `CODIGO`, `COD_ALFA` y `CANTIDAD`.
- La cantidad corresponde a las unidades informadas en la tarjeta del Pedido.
- La confirmación se realiza en **Presea**, no en COMEX.

## Seguimiento

Reúne la conciliación de Altas exportadas y la gestión de códigos EAN/GS1.

### Seguimiento ERP

- Consultar Altas exportadas y su avance en Presea.
- Ver cantidades registradas, exportables y confirmadas.
- Identificar el estado del lote y sus archivos.
- Mostrar el detalle de los productos exportados.
- Distinguir si las imágenes fueron copiadas a Presea.

El listado de Altas se pagina para que la vista inicial cargue más rápido.

### Seguimiento EAN / GS1

El filtro inicial muestra **Gestionar en GS1**.

Funciones principales:

- Buscar por Alta, código, modelo o color.
- Filtrar por Alta, estado EAN, temporada, año y rubro.
- Seleccionar hasta 2.500 productos por operación.
- Descargar imágenes para GS1.
- Generar el archivo GS1.
- Importar URLs de GS1.
- Importar EAN definitivos.
- Generar y descargar GTIN.DBI.
- Enviar GTIN a Presea.
- Descargar pendientes e imprimir etiquetas cuando corresponda.
- Consultar cantidades procesadas y mensajes de resultado de cada operación.

Los productos desactivados también permanecen visibles en el seguimiento con la identificación **INACTIVO EN PRESEA**. Esto permite conservar la trazabilidad de un EAN gestionado antes de la baja, aunque esos productos no se incluyen en nuevas acciones.

## Usuarios

Administra accesos y permisos. Esta solapa está reservada a usuarios autorizados.

Funciones principales:

- Crear y editar usuarios.
- Activar o desactivar accesos.
- Asignar rol, empresas, marcas y permisos funcionales.
- Consultar la ficha de seguridad de cada usuario.
- Habilitar funciones especiales, como el uso de talles mixtos, por empresa.
- Alternar entre vista de tabla y tarjetas.
- Para superadministradores, consultar los usuarios activos durante los últimos minutos.

Los permisos se validan tanto al mostrar las opciones como al ejecutar cada operación.

## Estados y criterios generales

- **Borrador:** todavía admite modificaciones.
- **Validado:** la información fue confirmada y se habilitan las exportaciones correspondientes.
- **Exportado:** se generaron los archivos del circuito.
- **Generado OK en ERP / Registrado en Presea:** Presea confirmó el registro.
- **Anulado:** el registro queda fuera del circuito operativo, pero puede conservarse para consulta.
- **Pendiente:** falta completar una acción o recibir confirmación de otro sistema.

## Recomendaciones de uso

1. Verificar siempre la empresa activa antes de cargar o exportar información.
2. Revisar la vista previa antes de cerrar una Alta o validar un Pedido.
3. No repetir una operación si la pantalla todavía indica que se está procesando.
4. Consultar Seguimiento para confirmar el impacto en Presea y la situación de EAN.
5. Ante una corrección posterior a la exportación, solicitar intervención administrativa para preservar la trazabilidad.

