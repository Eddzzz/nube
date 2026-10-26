# Carpeta local Implementation Plan

**Goal:** Compartir la carpeta confirmada sin credenciales Microsoft.
**Architecture:** Adaptador de disco detrás del repositorio actual; rutas HTTP existentes conservan autenticación. Descargas transmitidas y subidas locales mediante streaming.
**Tech Stack:** Next.js 15, TypeScript, node:fs, node:test; sin nuevas dependencias.
**Spec:** docs/superpowers/specs/2026-10-25-carpeta-local-design.md

## Constraints
- Conservar los cambios previos del usuario.
- Limitar todas las operaciones a la raíz real; bloquear enlaces fuera de ella y nombres Windows inválidos.
- Visitantes leen; administradores escriben. Eliminación recuperable.

## Review Focus
- Traversal, rutas absolutas y enlaces externos: rechazar, incluyendo operaciones de escritura.
- Archivos vacíos y nombres Unicode: conservar contenido y nombres.
- Colisiones: no sobrescribir archivos existentes.
- Descargas parciales: soportar Range para audio.
- Visitantes: rechazar escrituras y peticiones sin autenticación.

## Tasks
- [x] 1. Escribir y ejecutar tests de operaciones locales, confinamiento, recuperación y descargas parciales; implementar adaptador hasta pasarlos.
- [x] 2. Conectar configuración, repositorio, rutas, previsualización y subidas; mantener compatibilidad Graph. Configurar la raíz elegida.
- [x] 3. Ejecutar tests, `npx next lint` y `npx next build`. Reiniciar servidor y comprobar HTTP autenticado y permisos con datos temporales.

## Verificación
- `node --test tests/local-drive.test.cjs tests/local-drive-http.test.cjs`: 2/2 correctos. Incluye Windows, Unicode, archivos vacíos, nombres largos, recuperación, traversal, junctions, Range, autenticación HTTP, roles y previews firmadas sin credenciales Microsoft.
- `npx next lint`: sin advertencias ni errores de ESLint. Next anuncia la futura retirada del comando.
- `npx next build`: correcto.
- Revisión independiente: corregidos nombres largos en recuperación y firmas de previews; ambas regresiones reproducidas antes de corregirse.
- Servidor activo en `0.0.0.0:3000`. Inicio, login y listado HTTP 200 tanto en localhost como en `192.168.100.142`, comprobados desde esta PC. La carpeta configurada devuelve 0 elementos visibles; no se modificaron sus archivos.
- Se generó `ADMIN_PASSWORD` aleatoria únicamente porque estaba vacía; se conserva en `.env.local`, excluido de Git. No se cambió el firewall ni se publicó en internet.
