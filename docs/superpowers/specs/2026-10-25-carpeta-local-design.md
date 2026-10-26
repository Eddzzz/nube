# Carpeta compartida local

Decisión confirmada: todos los usuarios acceden a `C:\Users\edwin\OneDrive\nube` desde esta PC. Se mantiene la interfaz, contraseña de visitante y autorización de administrador. No se requieren credenciales Microsoft en modo local.

Se añade un adaptador de disco a las operaciones existentes: listar, buscar, descargar, previsualizar, crear carpetas, subir, renombrar y eliminar. Eliminar mueve a una carpeta privada de recuperación dentro de la raíz. Los usuarios nunca eligen otra raíz ni pueden salir mediante rutas o enlaces. OneDrive para Windows realiza la sincronización; el servidor debe estar encendido.

Alternativas: Microsoft Graph permite alojamiento remoto pero exige registrar una aplicación; leer carpetas desde cada navegador contradice la carpeta compartida única. Se elige acceso del servidor al disco.

Se conserva Graph cuando no se configura una raíz local. Las modificaciones existentes en el checkout se conservan. Acceso de red local, sin publicar en internet ni cambiar el firewall.
