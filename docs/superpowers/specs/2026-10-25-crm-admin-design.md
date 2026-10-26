# CRM de administración local

Ampliación solicitada: panel CRM para el administrador con usuarios, roles, dashboard, trabajos, pendientes y herramientas relacionadas. Se interpreta como gestión operativa del equipo y sus trabajos, coherente con el repositorio académico actual.

Se integra en /admin con navegación lateral en escritorio y navegación accesible en móvil. Se reutilizan cuentas, permisos por carpeta, auditoría, papelera y almacenamiento. Nuevos trabajos y pendientes tienen título, responsable, fecha, estado y prioridad; los pendientes pueden vincularse a un trabajo. Los trabajos incluyen descripción. Se crean y editan desde formularios y se cambian de estado desde el tablero. No se eliminan datos anteriores ni se crean estadísticas ficticias.

El dashboard calcula usuarios activos, trabajos abiertos, tareas pendientes/vencidas, carga del equipo, distribución de estados, actividad reciente y almacenamiento real. La página de actividad incluye búsqueda, filtros y exportación. Usuarios y roles reutilizan la autorización existente: administrador y usuario con permisos de lectura/edición por carpeta, sin introducir escaladas de privilegio.

Solo administradores pueden leer o modificar CRM, tanto en páginas como en API y almacén. La persistencia local amplía workspace.json con valores por defecto al leer archivos anteriores; conserva cuentas, sesiones y tareas académicas. Sin nuevas dependencias de producción.

Alternativas: un CRM externo requiere servicio/cuentas adicionales; reconstruir usuarios y permisos duplicaría lógica existente. Se elige ampliar el panel actual y mantener el almacenamiento local confirmado.

Verificación: pruebas de migración, validación, autorización, métricas y acciones HTTP; navegador real escritorio/móvil para crear trabajo, vincular tarea y completar pendiente; npx next lint y npx next build. Se conservan cambios previos sin crear commits mezclados.
