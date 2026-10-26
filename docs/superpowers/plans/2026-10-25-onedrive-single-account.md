# OneDrive Single Account Implementation Plan

**Goal:** Almacenar archivos en un OneDrive propietario manteniendo usuarios/permisos locales.

**Architecture:** OAuth y tokens privados independientes del inicio de sesión local; adaptador Graph con la misma interfaz del disco; selección persistente del backend y pantalla administrativa de conexión.

**Tech Stack:** Next.js 15, TypeScript, fetch y crypto de Node.

**Spec:** ../specs/2026-10-25-onedrive-single-account.md

## Constraints

- Conservar cambios y datos previos; no commits ni credenciales en respuestas o logs.
- IDs relativos mantienen permisos; no fallback local tras activar OneDrive.
- Tokens solo servidor, OAuth con PKCE/estado y administrador autenticado.
- Verificar con npx next lint y npx next build, nunca npm run lint/build.

## Tasks

- [x] OAuth: pruebas de estado, expiración, cifrado, renovación serializada, desconexión y cuenta única; implementar connection.ts y APIs administrativas.
- [x] Almacenamiento: pruebas de aislamiento de raíz, rutas, paginación, colisiones, límites, descargas proxy y recuperación; implementar graph-drive.ts compatible con local-drive.
- [x] Integración: seleccionar backend persistente en repo.ts, separar directorio privado de auth de la carpeta de documentos, mantener APIs/permisos existentes y errores sin fallback.
- [x] Panel de conexión: estado, instrucciones de configuración, conectar/desconectar y navegación; actualizar documentación/variables sin exponer secretos.
- [x] Validación: revisión independiente, pruebas completas/locales/Graph y navegador, lint/build y reinicio del servidor; informar con precisión lo pendiente de autorización real.

## Resultado de verificación

67 pruebas aprobadas; next lint sin advertencias ni errores; next build correcto. Navegador a 390 y 1440 px: configuración pendiente, estado conectado simulado, cancelación/desconexión y reconexión; sin desbordamiento ni errores. Servidor actualizado en puerto 3000.

## Activación externa pendiente

No se encontraron Client ID ni secreto configurados. Se prepararon las variables privadas y el panel de instrucciones. El propietario debe registrar la aplicación, configurar las credenciales y autorizar Microsoft. Las llamadas Graph/OAuth se probaron con dobles aislados, no con una cuenta real. Los archivos locales existentes se conservan y no se transfieren automáticamente.
