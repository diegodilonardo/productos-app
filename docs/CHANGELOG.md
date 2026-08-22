# CHANGELOG — Base estable de trabajo

## 2026-08-19 — Snapshot entregada

Base tomada directamente del ZIP actual del usuario.

### Incorporado y aprobado visualmente
- navegación Atomik y estilo global;
- Dashboard;
- Nueva Alta;
- listado de Altas;
- Seguimiento;
- Productos del Alta;
- familias desplegables;
- filtros de productos;
- imagen por familia;
- anulación de Alta;
- motivo de anulación visible;
- buscadores visuales de maestros;
- buscador de modelos y licencia;
- buscador visual de curva;
- talles filtrados por rubro;
- regla 1 Alta = 1 Licencia;
- clasificación MÓDULO filtrada por Edad + Sexo;
- corrección `ADULTO + FEM → MOD.MUJ`;
- `BABY + UNI → MOD.BB`;
- toast flotante para todos los controles transitorios de Productos del Alta;
- guardado de imagen sin salto al inicio.

### Backend / ERP ya presentes
- creación de cabeceras y detalle;
- familias automáticas;
- detección de existencia ERP;
- validación;
- preview de exportación;
- exportación DBF → DBI;
- writer dBASE III / Windows-1252;
- sincronización de maestros;
- sincronización PRODUCTOS ERP;
- seguimiento y conciliación;
- imágenes.

### Observación
La regla EDAD + SEXO → CLASIFICACIÓN está actualmente reforzada en frontend. Se recomienda incorporar la misma validación en backend para impedir bypass por API directa.
