# LABFIS — Plantilla base para ocho equipos

Aplicación React/Vite con estilo común y navegación a ocho módulos, un ejemplo docente **funcional** de solicitudes de impresión 3D y conexión a PostgreSQL mediante Supabase Auth y RLS.

## Qué está implementado y qué no

- ✅ Portada + menú de los 8 módulos LABFIS.
- ✅ Ejemplo docente de impresión 3D: insertar y consultar solicitudes en **PostgreSQL** una vez configurado Supabase.
- ✅ Formulario de registro e ingreso de usuarios por correo/contraseña; la confirmación de correo depende de configuración de Supabase.
- ✅ Políticas RLS que aíslan los registros de cada cuenta.
- ✅ Objetos perdidos incluye registro en recepción, confirmación de custodia y consulta de la evidencia original.
- ✅ Objetos perdidos genera una etiqueta QR imprimible y permite actualizar la ubicación al abrir el expediente.
- ⏳ Los demás módulos se muestran como plantillas de trabajo. El despliegue queda pendiente.

## Ruta rápida A: StackBlitz (sin instalaciones)

1. Descomprime el ZIP y sube la carpeta **labfis-base** a un repositorio de GitHub. No incluyas `.env.local`.
2. Abre `https://stackblitz.com/github/USUARIO/REPOSITORIO` (reemplaza con tu URL). Si tu repositorio es privado, usa el flujo de importación privada de StackBlitz según tu plan.
3. Deja que StackBlitz instale dependencias y ejecute el proyecto. Si es necesario, ejecuta `npm run dev`.
4. Deberías ver la portada y los ocho módulos, aun sin Supabase.
5. Configura Supabase según el bloque siguiente. En StackBlitz define las variables de entorno desde su editor o configuración.

## Ruta rápida B: desarrollo local

Requisitos: Node.js compatible con Vite y npm.

```bash
npm install
cp .env.example .env.local    # En Windows: copia el archivo manualmente
npm run dev
```

Abre la URL local que indique Vite (habitualmente `http://localhost:5173`).

## Conectar PostgreSQL en Supabase (docente o responsable del entorno)

1. Entra a https://supabase.com/ y crea un **proyecto de pruebas**.
2. Abre **SQL Editor** y ejecuta `supabase/01_base_demo.sql`.
3. En **Project Connect / API**, localiza el **Project URL** y la **Publishable key**.
4. Define las variables de entorno:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

5. Reinicia el servidor si corresponde.
6. Registra una cuenta con correo y contraseña en la aplicación. Si se exige confirmación por correo, confirma antes de iniciar sesión.
7. Ve a **Impresión 3D**. Registra una solicitud y comprueba que aparece en el listado.
8. Abre Supabase **Table Editor → printing_requests** para comprobar que se almacenó en PostgreSQL. Recarga la página y verifica que permanece.

**Seguridad**: la clave publicable se usa en el cliente con RLS; nunca pegues `service_role`, `sb_secret_*`, contraseñas de BD ni JWT privados en variables `VITE_*`.

## ObjetosPerdidosB en Supabase de pruebas

1. En **SQL Editor**, ejecuta `supabase/02_objetos_perdidosB.sql` una vez. El script crea las tablas del módulo y el bucket privado `objetos-perdidos-b-evidencias` con un límite de 5 MiB por archivo para JPEG, PNG y WebP.
2. En **Authentication → Users**, crea o localiza dos cuentas de prueba. El administrador habilita únicamente a la cuenta de encargado, reemplazando `UUID_DEL_ENCARGADO` por el ID de esa cuenta.

   ```sql
   insert into public.objetos_perdidos_b_encargados (usuario_id)
   values ('UUID_DEL_ENCARGADO'::uuid)
   on conflict (usuario_id) do nothing;
   ```

3. Prueba las políticas con las sesiones de esas cuentas. La cuenta de encargado debe poder registrar y consultar objetos y actualizar `ubicacion_custodia`. Con la cuenta común, las consultas deben devolver cero registros y los intentos de registro o confirmación deben ser rechazados. Usa el SQL Editor para verificar los registros como administrador.

### Probar el registro y la custodia desde React

1. Si todavía no tienes `.env.local`, créalo en PowerShell con `Copy-Item .env.example .env.local`. Completa la URL y la clave publicable del proyecto de pruebas en ese archivo.
2. Ejecuta `npm.cmd install` si faltan las dependencias y luego `npm.cmd run dev`. Abre la URL que indique Vite, inicia sesión como encargado y entra a **Objetos perdidos**.
3. Registra un objeto ficticio. Comprueba que el expediente lo muestre **En recepción**. Intenta confirmar la custodia con observaciones y sin foto para comprobar el rechazo. Luego adjunta una foto, revisa la vista previa y confirma.
4. Verifica que el estado cambie a **En custodia** y que el expediente muestre la foto y las observaciones originales. Recarga la página y vuelve a abrir el expediente desde el listado. En Supabase, verifica la fila del objeto en **Table Editor** y la foto en el bucket privado de **Storage**.

### Contrato de custodia para React

- El registro nace **En recepción**. Su `id` UUID identifica la futura etiqueta QR. El cliente puede proporcionar el UUID para reconocer el registro si necesita reintentar la solicitud.
- Un encargado carga de una a cinco fotos vía Supabase Storage con `upsert: false` y rutas `<objeto_uuid>/<usuario_uuid>/<foto_uuid>.<extensión>`. Se admiten las extensiones `jpg`, `jpeg`, `png` y `webp`.
- Llama a `confirmar_custodia_objeto_perdido_b` con `p_objeto_id`, `p_observaciones` y `p_rutas`. La función verifica que existan las fotos cargadas, guarda la evidencia y cambia el estado a **En custodia** en una sola transacción. Repetir la llamada con la misma cuenta, observaciones y rutas devuelve la evidencia ya guardada.
- Al confirmar, las fotos elegidas pasan a ser consultables por los encargados. Las cargas pendientes sólo son visibles para quien las subió mientras el objeto siga en recepción. Si se abandona una carga, la limpieza queda a cargo del administrador mediante Storage, tras verificar que la ruta carezca de referencia y que no haya una confirmación en curso.
- Comprueba que las observaciones y las fotos confirmadas sigan disponibles al volver a consultar, que una nueva confirmación con notas distintas falle y que una sesión de encargado no pueda reemplazar ni borrar una foto del bucket.

### Probar la etiqueta QR y editar la ubicación

1. En **Objetos perdidos**, registra un objeto o abre un expediente existente. Pulsa **Imprimir etiqueta** para revisar la etiqueta en la vista previa o imprimirla. El QR se genera con `qrcode.react` y contiene la URL del expediente con el UUID del objeto.
2. Escanea la etiqueta con el lector del teléfono o usa **Abrir enlace del QR**. Para probar desde el teléfono, genera la etiqueta tras abrir la aplicación en una dirección accesible desde ambos dispositivos. Usa la URL **Network** que muestra Vite si están en la misma red, o la URL HTTPS de la demo cuando esté desplegada. `localhost` apunta al dispositivo desde el que se abre el enlace.
3. Inicia sesión como encargado si el navegador te lo pide. Comprueba que se abra el expediente correcto y que la misma URL funcione al recargar.
4. Pulsa **Editar ubicación**, guarda una ubicación nueva y recarga el enlace. Verifica la ubicación en el expediente y la fila en `objetos_perdidos_b`. Las fotos y observaciones originales quedan disponibles en el expediente de solo lectura.
5. Prueba con un identificador inválido, un UUID de un objeto inexistente y una cuenta común. En cada caso debe aparecer un mensaje y quedar bloqueada la edición.

La [guía de validación](docs/VALIDACION_OBJETOS_PERDIDOS.md) relaciona las pruebas con los criterios de aceptación y contiene el recorrido para la demo final.

## Con qué trabaja cada equipo

| Equipo | Módulo | ID en menú |
|---|---|---|
| 1 | Objetos perdidos | `objetos` |
| 2 | Préstamo de equipos | `prestamos` |
| 3 | Reporte de daños | `danos` |
| 4 | Llaves y accesos | `accesos` |
| 5 | Reservas | `reservas` |
| 6 | Apertura y cierre | `apertura` |
| 7 | Inventario QR | `inventario` |
| 8 | Dashboard | `dashboard` |

Para crear un módulo real, **crea un archivo de componente propio** (por ejemplo `src/modules/ObjetosPerdidos.jsx`) y cambia el renderizado condicional en `src/App.jsx`. No alteres módulos de otros equipos. Utiliza el ejemplo de impresión 3D como referencia para conectar con Supabase.

## HU del ejemplo docente

Como estudiante quiero registrar una solicitud de impresión 3D, indicando descripción, material y cantidad, para gestionar su fabricación.

- CA01: Descripción obligatoria.
- CA02: Cantidad válida, mínimo 1.
- CA03: Registro visible tras guardar y recargar.
- CA04: Estado inicial **Pendiente**.

## Archivos más importantes

- `src/App.jsx`: estructura y menú global.
- `src/modules/config.js`: nombres, resúmenes e identificación de módulos.
- `src/modules/PrintingDemo.jsx`: ejemplo con formulario, validación y consultas SQL vía Supabase.
- `src/modules/StudentModule.jsx`: plantilla vacía para equipos.
- `src/lib/supabase.js`: configuración segura del cliente público.
- `supabase/01_base_demo.sql`: tabla de ejemplo, restricciones y RLS.
- `docs/GUIA_DOCENTE.md`: guion de laboratorio.
- `docs/PROMPT_EQUIPOS.md`: prompt estandarizado de IA.

## Entrega mínima de un equipo

1. HU y CA implementados y trazables.
2. Pantalla(s) de React navegables.
3. Tabla propia PostgreSQL y reglas RLS.
4. Guardar + consultar desde el navegador, con recarga.
5. Al menos dos pruebas manuales con evidencia.
6. Código en repositorio sin credenciales privadas.

> Proyecto académico para pruebas con datos ficticios.
