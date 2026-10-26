# Usuarios y repositorio local Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task in the current checkout. Preserve pre-existing changes; do not commit unrelated work.

**Goal:** Incorporar cuentas, permisos y seguimiento académico al repositorio local.
**Architecture:** Almacén privado con escrituras atómicas; autorización compartida entre rutas y páginas; reutilizar adaptador y componentes existentes.
**Tech Stack:** Next.js 15, React 19, TypeScript, node:crypto, node:fs, node:test.
**Spec:** docs/superpowers/specs/2026-10-25-usuarios-repositorio-design.md

## Global Constraints
- Mantener carpeta local y cambios previos, sin Microsoft ni coedición Office.
- Denegar accesos no asignados; las cookies antiguas de rol no autorizan.
- Sin nuevas dependencias de producción; metadatos privados fuera de la carpeta pública.
- Datos académicos y evidencias reales, nunca inventar resultados satisfactorios.

## Review Focus
- Revocación de sesiones, cambios de contraseña y desactivación efectivos inmediatamente.
- Herencia por carpeta, navegación de ancestros, descargas y búsqueda sin filtrar datos ajenos.
- Traversal, enlaces simbólicos y colisiones rechazados sin pérdida de archivos.
- Mutaciones concurrentes de metadatos no pierden datos.
- Lectores no pueden editar usuarios, archivos, tareas ni pruebas.

## Tasks
- [x] 1. Escribir y ejecutar pruebas fallidas de almacén, sesiones y permisos; implementar src/services/workspace-store.ts y src/lib/permissions.ts. Crear, editar y desactivar usuarios, cambiar contraseña y revocar sesiones; serializar escrituras locales.
- [x] 2. Probar papelera y versiones; extender src/services/local-drive.ts con listTrash/restoreTrash/listVersions/saveVersion/replaceContent/restoreVersion. Respetar confinamiento y colisiones.
- [x] 3. Conectar sesión servidor, middleware y rutas API, incluyendo autorización por carpeta en todas las lecturas/escrituras. Probar con datos temporales y ataques de acceso directo.
- [x] 4. Construir panel de usuarios, selector de carpetas/permisos, recuperación y versiones; panel académico con tareas, ocho pruebas, evidencia y exportación. Integrar navegación y controles según permisos.
- [x] 5. Ejecutar pruebas de integración y adaptador, revisar UI escritorio/móvil, npx next lint, npx next build. Actualizar README con configuración y alcance real.

## Decisiones de ejecución
- Se trabaja en el checkout existente porque contiene la migración local del usuario aún sin confirmar. No se crean commits que mezclen su trabajo.
- Se conserva ADMIN_PASSWORD como acceso de arranque con sesiones nuevas; se elimina el acceso general de visitante para cumplir cuentas individuales.

## Verificación y progreso
- Implementación y revisión independiente completas: cuentas, recuperación, ZIP y controles móviles. Hallazgos de historial con nombres reutilizados, bloqueos tras caída, concurrencia Windows y accesos móviles corregidos.
- `node --test tests/*.test.cjs`: 31/31 correctos. Bloqueos verificados adicionalmente en diez ejecuciones consecutivas (80/80 pruebas).
- `npx next lint`: sin advertencias ni errores ESLint; Next.js anuncia deprecación de este comando.
- `npx next build`: correcto. Se desactivó telemetría solo en los comandos para evitar un EXDEV de la configuración global de Next en Windows.
- Navegador Edge real con datos temporales: inicio de sesión, crear usuario/asignar permisos, tareas/evidencias, estructura, papelera, reemplazo/versiones, carga con usuario no administrador, actualización externa automática y descarga ZIP. PDF visualmente renderizado y video WebM reproducido; sin excepciones JS. Capturas de escritorio/tablet/móvil en tmp/ui-review.
- Servidor local reiniciado en 0.0.0.0:3000; login 200 en localhost y 192.168.100.142 desde esta PC. No se alteraron credenciales ni archivos académicos reales, no se publicaron cambios ni se generaron commits mezclados con trabajo previo.
- README actualizado con administración, permisos, acceso móvil, límites, versiones, actividad y recuperación operativa de bloqueos desconocidos.
