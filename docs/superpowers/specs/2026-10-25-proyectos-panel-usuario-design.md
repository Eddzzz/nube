# Proyectos y panel personal

Solicitud: panel de usuario con trabajos/tareas asignados, actualización de estados y subidas según permisos; administración de varios proyectos y sus integrantes.

Se amplía el CRM local con proyectos (nombre, descripción, integrantes, carpeta existente opcional, estado activo/archivado). Los trabajos y pendientes se asocian a un proyecto; los registros anteriores quedan sin proyecto y conservan sus asignaciones. Las cuentas solo pueden asignarse a proyectos y trabajos por el administrador. Una tarea vinculada a un trabajo comparte su proyecto.

El panel /my-work muestra únicamente proyectos donde la persona es integrante y trabajos/tareas propios. Puede cambiar el estado de lo que tiene asignado, sin cambiar responsables, contenido, prioridades, proyecto ni permisos. Las asignaciones antiguas sin proyecto siguen visibles solo a su responsable. Retirar la membresía bloquea consulta y cambios de las asignaciones del proyecto en la siguiente petición; un proyecto archivado permite consulta pero no actualización por el integrante.

Los permisos de archivo permanecen independientes de la membresía. En el panel personal se seleccionan carpetas autorizadas y se reutiliza el componente de subida y su API comprobada. La interfaz muestra el destino y no permite elegir carpetas sin permiso; la API aplica los mismos controles aunque se manipule la solicitud.

Se conserva Next.js, cuentas, sesiones, autorización y almacenamiento local. Se migran valores faltantes sin borrar tareas académicas, enlaces, trabajos anteriores ni sesiones. Nuevas páginas de proyecto para administradores y enlace Mi panel para usuarios; login lleva al administrador a /admin y al usuario a /my-work.

Verificación: pruebas de pertenencia, aislamiento, asignación, cambios de estado, archivo, revocación y migración. Integración HTTP y navegador real en escritorio/móvil; npx next lint y npx next build. Salida aislada mediante NEXT_DIST_DIR para no interferir con compilaciones concurrentes. No se crean proyectos de muestra en datos reales.
