# PENDIENTES

## Prioridad 1 — aceptación funcional
Continuar exactamente con `PLAN_TEST_20_PUNTOS.md`, actualmente en el punto 2.

## Prioridad 2 — robustez
Replicar en backend la regla:
`EDAD + SEXO → CLASIFICACIÓN` para MÓDULO.

Motivo: hoy el frontend filtra correctamente, pero una llamada directa a la API podría enviar una clasificación de módulo permitida por código pero incompatible con Edad/Sexo.

## Prioridad 3 — control de versión
La snapshot actual contiene muchos cambios posteriores al tag `v1.0-flujo-estable` que no están commiteados.

Cuando completemos una etapa estable conviene:
1. revisar `git status`;
2. excluir secretos/runtime;
3. commit;
4. crear un nuevo tag, por ejemplo:
   `v1.1-aceptacion-productos`.

## Prioridad 4 — tests automatizados
`package.json` todavía no posee una suite real de tests (`npm test` es placeholder).
No bloquea la aceptación manual actual, pero conviene agregar pruebas de reglas críticas luego de cerrar V1.
