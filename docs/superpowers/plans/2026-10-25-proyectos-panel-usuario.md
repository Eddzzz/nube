# Proyectos y panel personal Implementation Plan

**Goal:** Asignar usuarios a proyectos y permitir que gestionen sus propios estados y cargas autorizadas.
**Architecture:** Extender almacén/CRM y API personal; reutilizar subida y permisos. Administración y usuario consumen proyecciones distintas.
**Spec:** docs/superpowers/specs/2026-10-25-proyectos-panel-usuario-design.md

## Tasks
- [x] 1. Probar y ampliar proyectos, membresías y asignaciones; API administrativa y personal con validación estricta.
- [x] 2. UI administración proyectos/miembros y selectores de proyecto en trabajos y pendientes.
- [x] 3. Panel personal: asignaciones, filtros, estados y subidas; integrar navegación y login.
- [x] 4. Pruebas HTTP, navegador escritorio/móvil, revisión, lint/build y documentación; conservar datos reales.

## Review focus
- Datos ajenos no aparecen en payload personal ni se modifican por IDs forjados.
- La membresía se comprueba al leer y al escribir, también tras retirarla.
- Cambiar estado no cambia responsables ni metadatos; tareas vinculadas comparten proyecto.
- Subida exige read+upload existentes; pertenecer al proyecto no eleva permisos.
- Migración conserva colecciones anteriores y sesiones; proyectos archivados son de consulta.

## Progreso
Implementación completa con backend/UI administrativa delegados y revisión independiente. Se conservaron cambios anteriores y enlaces compartidos, sin commits ni datos de muestra en la carpeta real.

- `node --test tests/*.test.cjs`: 45/45 correctos, incluyendo proyectos, aislamiento por responsable y membresía, revocación, archivo, campos forjados, carpeta de subida y compatibilidad anterior.
- `npx next lint` con NEXT_DIST_DIR=.next-crm: sin advertencias ni errores ESLint.
- `npx next build` con la misma salida: correcto; rutas /my-work, /admin/projects y APIs personales incluidas.
- Navegador Edge con datos temporales: crear proyecto/integrantes, trabajo y pendiente, login a destino por rol, ver solo lo propio, cambiar estados, subir un archivo a carpeta autorizada, comprobar proyecto archivado y retirada de membresía, comprobar que usuario lector no puede subir. Escritorio 1440, tablet 768 y móvil 390 sin desbordamiento de página ni excepciones JS.
- Capturas locales revisadas en tmp/personal-review. README actualizado con acceso y reglas de membresía/permisos independientes.
- Revisión: corregido que un usuario pudiera reabrir por PATCH un trabajo cancelado por el administrador; prueba de regresión incluida. El archivo y la revocación también se comprueban en servidor.
