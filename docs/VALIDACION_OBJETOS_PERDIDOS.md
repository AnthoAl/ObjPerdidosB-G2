# Validación del módulo Objetos perdidos

El incremento de LABFIS cubre el registro en custodia con evidencia original (HU-01) y la identificación por QR con actualización de ubicación (HU-03).

## HU-01 · Registro en custodia con evidencia original

Como encargado del laboratorio, quiero registrar el objeto que recibo físicamente junto con su evidencia para consultar después el estado en que ingresó a custodia.

- **CA-01.** El formulario pide descripción, lugar y fecha del hallazgo, persona que reporta, de una a cinco fotografías y observaciones del estado físico. Con los datos válidos y las fotos cargadas, se abre el expediente **En custodia** con ubicación **Por asignar**.
- **CA-02.** El expediente muestra las observaciones y fotos de solo lectura en **Evidencia original** inmediatamente después del registro y al volver a abrirlo.
- **CA-03.** Si falta evidencia o falla una carga, el registro queda sin confirmar. Reintentar con los mismos datos y fotos guarda un solo expediente. Las fotos y observaciones guardadas se conservan al actualizar la ubicación.

## Evidencias de la versión publicada inicialmente

- La [demo de LABFIS](https://labfis-objetos-perdidos-g2-demo.shadykoi270.chatgpt.site/) se publicó con la versión `745122e`, que tenía un flujo de custodia en dos pasos. Para probar el flujo nuevo en Supabase, aplica la [migración de registro](../supabase/03_registro_con_evidencia.sql) antes de actualizar la demo.
- En PostgreSQL 17 local pasaron 41 comprobaciones del esquema previo y sus permisos. En Supabase se verificaron cuatro tablas con RLS, seis políticas de PostgreSQL, seis de Storage y el bucket privado. La API real rechazó una consulta de objetos sin sesión con HTTP 401 y código `42501`.
- En la prueba del 22 de noviembre de 2026 con el Supabase del equipo, la `Calculadora de demostración Fase 5` se guardó **En custodia** en `Armario de demostración B`. El expediente mantuvo la ubicación, la imagen y las observaciones al volver a abrirlo desde el enlace QR y recargarlo.

## Casos de aceptación

Usa una cuenta con rol de encargado y una cuenta común para las pruebas de acceso. Las cuentas nuevas deben confirmar su correo en Supabase antes de ingresar. Registra un objeto ficticio como `Calculadora de demostración Fase 5` y adjunta una imagen de prueba sin datos personales. Conserva la misma etiqueta y el mismo expediente durante el recorrido.

Si el alta devuelve `email rate limit exceeded`, el administrador puede crear la cuenta de prueba en **Authentication → Users → Add user → Create new user** con **Auto confirm user?**. Ese formulario confirma solo esa cuenta y permite ingresar con la contraseña definida. [Límites de Supabase Auth](https://supabase.com/docs/guides/auth/rate-limits)

| Caso | Criterio | Comprobación esperada | Estado de la verificación |
| --- | --- | --- | --- |
| CP-01 | HU-01 CA-01 y CA-02 | Completar el formulario con una o más fotos válidas. Comprobar que se abre en **En custodia**, con ubicación **Por asignar** y evidencia visible. | Verificado en Chrome con Supabase simulado y en PostgreSQL 17 local. Pendiente en el Supabase del equipo. |
| CP-02 | HU-01 CA-01 y CA-03 | Intentar registrar con los demás campos completos y sin foto. Comprobar el mensaje de validación y la ausencia de un nuevo expediente. | Chrome mostró la validación. PostgreSQL local rechazó la llamada sin fotos y revirtió el alta. |
| CP-03 | HU-01 CA-02 | Recargar el expediente y comparar las fotografías y las observaciones originales. Comprobar que la evidencia se puede consultar y que los permisos impiden alterarla. | Verificado en Chrome con Supabase simulado. En PostgreSQL local se verificaron los permisos de las observaciones y las fotos. |
| CP-04 | HU-03 CA-01 | Abrir **Imprimir etiqueta** y comprobar que el QR contiene el enlace con el UUID del objeto. | Se abrió el enlace del nuevo expediente en Chrome. En la versión anterior también se verificaron la decodificación del QR y la vista de impresión. |
| CP-05 | HU-03 CA-02 | Escanear la etiqueta con el teléfono, iniciar sesión y recargar el expediente. | Se probó el enlace y la solicitud de inicio de sesión en Chrome con vista móvil. Queda pendiente el escaneo físico. |
| CP-06 | HU-03 CA-03 | Editar la ubicación desde el expediente abierto con QR. Recargar y confirmar que persisten la ubicación y la evidencia. | Se comprobó con el flujo nuevo en Chrome con Supabase simulado y con la versión anterior en el Supabase del equipo. |
| CP-07 | HU-03 CA-02 y CA-03 | Abrir un QR inválido, un UUID inexistente y un enlace válido con una cuenta común. Comprobar el mensaje y el bloqueo de edición. | En la versión anterior se probaron enlaces inválidos y objetos inexistentes con Supabase real, y el enlace con cuenta común con Supabase simulado. |
| CP-08 | HU-01 CA-03 | Simular un fallo al subir la segunda foto. Verificar que no aparezca un expediente incompleto y que, al reintentar, se guarde uno solo con ambas fotos. | Verificado en Chrome con Supabase simulado. En PostgreSQL local se comprobó que una foto faltante revierte el alta y que repetir el envío devuelve el mismo expediente. |

Para la demo, verifica también la fila del objeto y su ubicación en **Table Editor** y la imagen en **Storage → objetos-perdidos-b-evidencias**. Para probar el QR desde otro dispositivo, abre el expediente en la [demo pública](https://labfis-objetos-perdidos-g2-demo.shadykoi270.chatgpt.site/) y genera la etiqueta desde allí. Escanéala con la cámara del teléfono, entra con una cuenta encargada, comprueba el estado y la ubicación y vuelve a cargar la página.

## Demostración y presentación

| Tiempo | Actividad |
| --- | --- |
| 1 min | Mostrar el listado y explicar el resultado de las dos funcionalidades. |
| 4 min | Completar el formulario, reproducir el rechazo sin foto, adjuntarla y registrar. Mostrar **Evidencia original**, abrir el enlace del QR, editar la ubicación y recargar. Consultar el registro y la foto en Supabase. |
| 2 min | Mostrar evidencias reales de la organización del trabajo y las prácticas ágiles que aplicó el equipo. |
| 2 min | Comentar qué funcionó, una dificultad que resolvieron y una mejora para el próximo Sprint. |
| 1 min | Cerrar con el resultado del incremento y dejar tiempo para la pregunta docente. |

El enunciado permite hasta cuatro diapositivas más la demo en vivo y pide que participen todos los integrantes. El historial de GitHub muestra tres incrementos verificables, el [esquema SQL](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/93eca8d), el [registro y la custodia](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/7695ad8) y el [QR con edición de ubicación](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/00c7a80). Para la parte de Scrum, el equipo debe identificar qué evidencia de su organización puede mostrar. Una mejora para la retrospectiva es incluir una prueba de persistencia en el Supabase del equipo antes de cerrar cada historia.
