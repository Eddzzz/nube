# OneDrive con una cuenta propietaria

El usuario autorizó integrar Microsoft OneDrive conservando las cuentas y permisos propios de la aplicación. Solo el administrador conecta la cuenta Microsoft propietaria. Los documentos se almacenan en una carpeta dedicada OneDriveList de ese único drive; no se publican enlaces de descarga directos que eviten la autorización local.

La autorización usa código OAuth, PKCE, estado de un solo uso vinculado a la sesión administrativa y renovación de tokens en el servidor. Credenciales mediante variables de entorno; tokens cifrados en el almacén privado fuera de la carpeta compartida. La desconexión no elimina archivos y nunca activa silenciosamente el disco local.

El adaptador conserva identificadores basados en rutas relativas para reutilizar permisos, proyectos, ZIP, vista previa y QR. La papelera y las instantáneas de recuperación de la aplicación se almacenan también en la cuenta OneDrive, dentro de carpetas internas que el explorador no expone. No se transfieren archivos locales automáticamente. Una copia explícita al cloud debe evitar sobrescribir documentos.

Antes de conectar se mantiene el almacenamiento local existente. Después de conectar se utiliza exclusivamente OneDrive; errores de red/autorización se muestran como tales. El administrador dispone de estado, instrucciones, conectar y desconectar; las cuentas de usuarios nunca reciben tokens Microsoft.

La conexión real requiere registro de una aplicación Microsoft y autorización interactiva del propietario, que no pueden simularse con pruebas. Se verificará con dobles de Graph y un flujo aislado de navegador, además de las pruebas locales, lint y build. No se agrega coedición Office ni se afirma cumplimiento literal de los requisitos académicos retirados por el usuario.
