# OneDriveList: repositorio de archivos

Aplicación Next.js 15 y React 19 para compartir archivos con cuentas individuales y permisos por proyecto o carpeta. Utiliza una carpeta de esta PC inicialmente y permite conectar una cuenta Microsoft propietaria para almacenar los documentos en OneDrive. Interfaz en español, sin coedición en Word o Excel web.

## Configuración

1. Instala una versión compatible de Node.js y ejecuta `npm ci`.
2. Copia `.env.example` a `.env.local`.
3. Configura la carpeta compartida, los datos privados y el acceso principal:

```env
LOCAL_DRIVE_ROOT='C:\Users\edwin\OneDrive\nube'
LOCAL_DATA_DIR='D:\onedrivelist-datos'
AUTH_URL="http://localhost:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="una-contraseña-larga-y-privada"
SHARE_BASE_URL=""
```

`LOCAL_DRIVE_ROOT` contiene los archivos reales. `LOCAL_DATA_DIR` guarda cuentas, sesiones, proyectos, enlaces compartidos e historial de actividad. Debe estar **fuera de la carpeta compartida** y respaldarse junto con ella. Si se omite, se utiliza `.local-data` dentro del proyecto, excluida de Git.

El acceso principal utiliza `ADMIN_USERNAME` (por defecto `admin`) y `ADMIN_PASSWORD`. Las demás cuentas se crean desde **Usuarios**. Sin administrador configurado, la aplicación permanece cerrada. La antigua contraseña general y las cookies de roles anteriores no dan acceso.

## Ejecutar

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
npx next lint
npx next build
npx next start --hostname 0.0.0.0 --port 3000
```

Para desarrollo: `npm run dev`.

Para separar la salida de otra compilación en el mismo checkout, establece `$env:NEXT_DIST_DIR='.next-crm'` antes de `npx next build` y conserva esa variable al ejecutar `npx next start`. La salida predeterminada es `.next`.

En esta PC puedes abrir [localhost:3000](http://localhost:3000). Desde un celular u otro equipo de la misma red utiliza `http://IP-DE-ESTA-PC:3000`. La PC y el servidor deben permanecer encendidos y el firewall debe permitir el puerto. La aplicación no se publica en internet automáticamente. `AUTH_URL` determina si las cookies requieren HTTPS; para HTTP local debe comenzar por `http://`.

## Proyectos como carpetas

Cualquier usuario autenticado puede crear un proyecto desde **Proyectos**, sin ser administrador. La aplicación crea una carpeta real dentro de `Proyectos` en la raíz compartida y convierte a su creador en propietario. Si el nombre de carpeta ya existe, utiliza uno alternativo para conservar el contenido anterior.

La opción **Crear las cinco carpetas académicas**, activada inicialmente, prepara la estructura del informe:

```text
Proyectos/
  Nombre del proyecto/
    01_Planificacion/
    02_Fuentes/
    03_Trabajo_colaborativo/
    04_Evidencias/
    05_Entrega_final/
```

Puedes desmarcarla para comenzar con una carpeta vacía. Estas son carpetas para organizar archivos; no generan documentos, capturas ni resultados automáticamente.

Los proyectos se muestran como tarjetas o lista, con búsqueda y filtro **Compartido conmigo**. **Abrir carpeta** lleva al explorador de archivos. Los cambios aparecen automáticamente cada 15 segundos mientras la pestaña está visible y al regresar a la ventana.

El propietario y los administradores pueden editar el nombre y la descripción, gestionar integrantes, compartir por QR y archivar/reactivar. Cambiar el nombre del proyecto no mueve ni renombra su carpeta local. Archivar conserva todos los archivos y reduce a lectura el acceso concedido por la pertenencia al proyecto; los permisos independientes de carpeta y el acceso global del administrador siguen vigentes.

## Usuarios, roles y permisos

Cada persona entra con su propia contraseña. El administrador puede crear cuentas con usuario único y contraseña de al menos 12 caracteres, cambiar nombres y roles, desactivar/reactivar cuentas, restablecer contraseñas y revocar sesiones.

En cada proyecto, el propietario o administrador selecciona las personas y su acceso:

- **Solo lectura:** consultar y descargar archivos.
- **Puede editar:** consultar, descargar, subir/reemplazar, crear carpetas, renombrar, eliminar y gestionar versiones. No permite administrar integrantes ni generar enlaces compartidos por sí solo.
- **Propietario:** gestiona el proyecto y sus integrantes, además de sus archivos y enlaces.
- **Administrador:** gestiona cuentas, permisos y todos los proyectos del repositorio.

Desmarcar un integrante retira su acceso concedido por el proyecto. No elimina permisos independientes que el administrador haya asignado a esa persona sobre la carpeta.

Desde **Usuarios** se pueden asignar permisos individuales por carpeta: Consultar, Descargar, Subir y reemplazar, Crear carpetas, Renombrar, Eliminar, Guardar/restaurar versiones y Compartir mediante enlace o QR. Una persona puede subir archivos desde el celular sin recibir el rol de administrador.

Los permisos se heredan a los descendientes y la asignación más específica prevalece. Una asignación explícita en la misma carpeta del proyecto sustituye el acceso derivado de la pertenencia al proyecto; una asignación explícita en una subcarpeta prevalece allí. Una asignación vacía bloquea ese destino. Sin permiso de consulta no se conceden las demás operaciones. El administrador mantiene acceso global. Los ancestros permiten navegar hacia una carpeta autorizada sin mostrar contenido ajeno.

El servidor comprueba las restricciones en cada petición, incluyendo búsqueda, vistas previas, subidas y descargas. Las carpetas vinculadas a proyectos o permisos explícitos no se renombran ni eliminan mientras mantengan esos vínculos.

Las sesiones duran 12 horas y se guardan como hashes; las contraseñas usan scrypt con sal individual. Desactivar una cuenta, cambiar su contraseña o revocar sus sesiones invalida el acceso. Los cambios de permisos se aplican en la siguiente petición.

## Compartir por QR en la red local

**Compartir por QR** genera un enlace del archivo o carpeta con vigencia de 24 horas, 7 días, 30 días o hasta su revocación. Puedes copiar el enlace, descargar el QR en SVG o revocarlo desde el diálogo. El QR se genera localmente, sin enviar el enlace a un proveedor externo.

El destinatario debe iniciar sesión y tener permisos sobre el contenido. Escanear o recibir un enlace no concede acceso adicional. Los enlaces dejan de funcionar al vencer, revocarse o perder su creador el permiso para compartir; el receptor conserva la obligación de tener acceso propio al archivo o carpeta.

Cuando se abre la aplicación desde `localhost`, los enlaces utilizan una IP privada detectada en la PC en lugar de `localhost`. Si accedes mediante una dirección de red, se utiliza ese origen. Para elegir una dirección estable, especialmente con varias interfaces de red, configura opcionalmente:

```env
SHARE_BASE_URL="http://192.168.1.25:3000"
```

Usa una dirección HTTP o HTTPS accesible desde los dispositivos destinatarios, sin `localhost`, rutas ni credenciales. Si la IP cambia, genera un enlace con la dirección actual o configura una dirección estable. Todos los equipos deben poder alcanzar el servidor; compartir un QR no abre puertos ni publica el servicio.

## Archivos, celular y vistas previas

La subida admite varios archivos, muestra progreso y permite cancelar o reintentar. Cada archivo admite hasta 200 MB. Una carga nueva no sobrescribe un archivo existente: se crea un nombre alternativo. Para actualizar un documento conservando su nombre e historial, utiliza **Versiones → Reemplazar contenido**.

Hay vistas previas de imágenes, texto, Markdown, audio, PDF y video. Texto admite hasta 5 MB. PDF utiliza el visor del navegador, con opción de abrir otra pestaña en celulares. Video utiliza controles nativos y carga parcial; su reproducción depende del formato y códec admitidos por el navegador. No se convierten videos automáticamente.

**Seleccionar varios → Descargar ZIP** permite descargar archivos y carpetas autorizados. Límites: 100 selecciones, 1.000 entradas y 200 MB de contenido. Conserva la estructura de carpetas, sin compresión adicional. Si una selección contiene archivos sin permiso de descarga, se rechaza completa.

El explorador y la búsqueda se actualizan cada 10 segundos mientras la pestaña está visible y al regresar a ella. También muestran archivos añadidos directamente desde Windows.

## Papelera, versiones e historial

**Papelera** permite al administrador recuperar archivos y carpetas desde la web. Se almacenan en `.onedrivelist-trash`, dentro de la raíz compartida y oculta en la interfaz. El destino original debe existir y estar libre; la recuperación no sobrescribe archivos. No hay caducidad ni eliminación definitiva automática. Las entradas antiguas sin metadatos siguen disponibles para recuperación manual desde Windows.

**Versiones** permite guardar estados, reemplazar contenido y restaurar un estado anterior. Al reemplazar o restaurar se conserva el contenido previo. El historial se mantiene al renombrar y recuperar desde la papelera; se almacena en `.onedrivelist-versions`, oculta en la web. Los cambios hechos directamente en Windows no crean versiones en la aplicación.

**Historial de actividad** permite al administrador buscar y filtrar operaciones por persona, acción, fecha o texto. Registra accesos, cambios de cuentas y proyectos, subidas, renombrados, eliminaciones, restauraciones e inicios de descargas individuales o ZIP. Conserva los últimos 2.000 eventos. Una descarga registrada indica que se autorizó e inició; no certifica que el dispositivo terminó de guardarla. Las vistas previas y lecturas parciales de medios no cuentan como descargas.

## Administración

`/admin` muestra usuarios activos, proyectos, archivos, almacenamiento y actividad reciente con datos reales. Desde allí se accede a proyectos, usuarios, roles y permisos, historial y papelera. El dashboard se actualiza cada 30 segundos y al regresar a la ventana.

Después de iniciar sesión, los administradores llegan a `/admin` y las demás personas a `/project`. La ruta anterior `/my-work` muestra el mismo explorador de proyectos. No se necesita un rol administrativo para crear proyectos o aportar archivos autorizados.

## Conectar una cuenta OneDrive propietaria

En **Administración → Almacenamiento** (`/admin/storage`), solo un administrador conecta la cuenta Microsoft propietaria. Todos los documentos del equipo se guardan en una carpeta dedicada de ese único OneDrive, por defecto `OneDriveList`. Los usuarios conservan sus cuentas y contraseñas de la aplicación; no necesitan una cuenta Microsoft ni reciben tokens Microsoft.

1. Registra una aplicación en Microsoft Entra que permita cuentas Microsoft personales y añade la plataforma **Web**.
2. Registra exactamente la URI de retorno, por ejemplo `http://localhost:3000/api/admin/onedrive/callback`. Microsoft permite HTTP para localhost como excepción de desarrollo. Una IP de la red local con HTTP no es válida para OAuth: abre el panel en localhost e inicia sesión allí para conectar. En producción utiliza una URI HTTPS.
3. Añade los permisos delegados `User.Read`, `Files.ReadWrite` y `offline_access`.
4. Crea un secreto y configura su **valor**, no su identificador, en `.env.local` junto con el identificador de aplicación y la URI registrada:

```env
ONEDRIVE_CLIENT_ID="identificador-de-la-aplicacion"
ONEDRIVE_CLIENT_SECRET="valor-del-secreto"
ONEDRIVE_REDIRECT_URI="http://localhost:3000/api/admin/onedrive/callback"
ONEDRIVE_TENANT="consumers"
ONEDRIVE_ROOT_FOLDER="OneDriveList"
```

`ONEDRIVE_TENANT` y `ONEDRIVE_ROOT_FOLDER` son opcionales y toman los valores del ejemplo por defecto. Estas variables son privadas del servidor: nunca utilices el prefijo `NEXT_PUBLIC_`, subas secretos a Git ni los envíes a otros usuarios. Reinicia el servidor después de configurarlas y pulsa **Conectar cuenta Microsoft** para autorizar la cuenta propietaria. El panel muestra las variables que falten, sin revelar sus valores.

Antes de la primera conexión se conserva el modo **Local**. Después se usa exclusivamente OneDrive: los fallos de red o autorización se muestran como errores y nunca activan el disco local como alternativa. **Desconectar** requiere confirmación, conserva los archivos en OneDrive y detiene el acceso a ellos para todo el equipo hasta reconectar. El estado se consulta cada 30 segundos mientras la pestaña está visible y al regresar a ella, sin botón de actualización manual.

Los archivos locales existentes **no se suben automáticamente**. Conectar tampoco traslada usuarios, permisos, proyectos, sesiones ni historial de actividad: esos datos permanecen en `LOCAL_DATA_DIR`, privado y fuera de la carpeta compartida. Los tokens Microsoft se guardan cifrados en ese almacén del servidor. La papelera y las instantáneas de versiones de documentos se guardan en carpetas internas del OneDrive conectado.

Los QR siguen apuntando a la aplicación y requieren sesión y permisos; no son enlaces públicos directos de Microsoft. La PC y el servidor deben permanecer encendidos y accesibles para el equipo. Esta conexión no añade coedición Office ni representa una certificación de requisitos académicos.

## Almacenamiento y operación

En modo local, los archivos permanecen en la carpeta configurada. Si esa carpeta está dentro de OneDrive, su cliente de Windows gestiona la sincronización. Los archivos disponibles solo en la nube necesitan conexión y el cliente activo. Con la cuenta conectada desde el panel, la aplicación accede directamente a OneDrive y no depende del cliente de Windows para los documentos. Ninguna de estas modalidades sustituye un respaldo independiente.

Las referencias de esta guía a cambios directos desde Windows y recuperación manual desde la carpeta compartida corresponden al modo local. En modo OneDrive, las carpetas de proyectos, la papelera y las versiones de documentos se almacenan en la raíz dedicada de la cuenta propietaria.

La actualización conserva los proyectos y registros antiguos del almacén privado; no elimina contenido para retirar secciones de la interfaz. Los proyectos anteriores conservan sus vínculos y membresías, pero sus permisos independientes de archivos no se amplían automáticamente.

Las rutas y enlaces simbólicos no permiten salir de la raíz. El servidor serializa escrituras y guarda los metadatos mediante reemplazo atómico. Está pensado para una PC y un equipo pequeño, no para varios servidores compartiendo el mismo almacén.

Los bloqueos con propietario muerto se recuperan automáticamente. Un bloqueo antiguo sin propietario verificable, de otro equipo o con PID reutilizado se conserva. Si persiste después de reiniciar, detén el servidor e inspecciona `.write-lock` en los datos privados o `.onedrivelist-operations-lock` en la raíz antes de retirarlo.

Subidas, versiones, papelera y ZIP consumen espacio adicional. El límite por subida o ZIP no representa una cuota total del repositorio.

Opcionales: `DOWNLOAD_TOKEN_SECRET` firma enlaces de vista previa; las firmas nunca sustituyen sesión y permiso. `DOWNLOAD_ALLOWED_ORIGINS` admite orígenes adicionales para lecturas; las escrituras requieren el mismo origen.

## Verificar

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
npx next lint
npx next build
node --test tests/*.test.cjs
```

Las pruebas usan carpetas temporales; las pruebas API pueden abrir servidores en puertos locales de prueba. No modifican la carpeta compartida real.
