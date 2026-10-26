# Repositorio académico local y administración

Decisión del usuario: mantener la carpeta local, con usuarios y permisos propios, sin Microsoft ni coedición Office. Se amplía la propuesta presentada en el chat sin cambiar los archivos existentes automáticamente.

## Alcance

- Cuentas individuales con nombre de usuario, nombre visible, contraseña, estado y rol administrador o usuario. El administrador configura permisos por carpeta y puede restablecer contraseñas y revocar sesiones. La cuenta de arranque usa ADMIN_USERNAME (admin por defecto) y ADMIN_PASSWORD existentes; no se comparte la contraseña de visitante ni se admiten sus cookies antiguas.
- Sesiones aleatorias con caducidad de 12 horas, almacenadas como hashes; contraseñas derivadas con scrypt y sal individual. Se exige autenticación incluso si faltan variables. Desactivación y revocación se comprueban en cada petición.
- Permisos heredados por carpeta: consultar, descargar, subir/reemplazar, crear carpetas, renombrar, eliminar y gestionar versiones. La asignación más específica prevalece. Sin permisos no hay acceso; los ancestros solo permiten navegar hacia las carpetas asignadas. Búsqueda, previsualización y API respetan la misma política. Los administradores tienen acceso completo.
- Para evitar accesos heredados inesperados, no se permite renombrar ni eliminar carpetas que contengan asignaciones explícitas: primero se deben retirar o mover sus permisos. La interfaz explica el motivo.
- Papelera recuperable desde la web para administradores y versiones locales por archivo: guardar versión, reemplazar conservando contenido previo y restaurar conservando el estado actual. No se sobrescriben colisiones al recuperar eliminados.
- Panel del proyecto: crear la estructura académica por acción explícita, tareas con responsable/fecha/estado/evidencia, bitácora de P01-P08 con resultados y evidencias reales, registro de acciones y uso real de almacenamiento frente a los 200 MB planificados. No se inventan resultados ni documentos académicos.
- La coedición se sustituye por aportes secuenciales y versiones locales. Las ocho pruebas se adaptan a este modo. El respaldo independiente se verifica manualmente tras descargar los archivos; la sincronización sigue a cargo del cliente Windows.

## Arquitectura y alternativas

Se reutilizan Next.js 15, React 19, TypeScript y el adaptador de disco. Los metadatos privados se guardan fuera de la carpeta compartida (LOCAL_DATA_DIR, por defecto .local-data en el proyecto), con archivo JSON escrito atómicamente y exclusión entre procesos. Adecuado para este servidor local y equipo académico pequeño; no es un almacén multi-servidor.

Alternativas consideradas: Microsoft Graph/Office requieren cuentas externas y contradicen la elección del usuario; una base de datos externa añade infraestructura innecesaria al piloto local. Se elige persistencia local sin nuevas dependencias de producción.

## Verificación

Ampliación solicitada: subir desde celular con permiso de usuario, PDF y video integrados, descarga múltiple ZIP (100 selecciones/1.000 entradas/200 MB), actualización automática cada 10 segundos y registro de descargas iniciadas. Se reutilizan controles nativos del navegador y ZIP STORE sin dependencias adicionales. El usuario autorizó agentes para desarrollo y revisión.

Pruebas de contraseñas y sesiones, revocación, aislamiento de carpetas y permisos específicos, errores y colisiones, papelera y versiones. Pruebas HTTP con servidor y datos temporales; revisar interfaz escritorio/móvil. Ejecutar npx next lint seguido de npx next build sin advertencias/errores ESLint. Conservar todos los cambios previos y no publicar ni crear usuarios de muestra en la carpeta real.
