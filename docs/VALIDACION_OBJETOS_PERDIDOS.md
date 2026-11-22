# Validación del módulo Objetos perdidos

El incremento de LABFIS cubre la custodia con evidencia original (HU-01) y la identificación por QR con actualización de ubicación (HU-03). Esta guía relaciona los criterios de aceptación con las pruebas y sirve para preparar la demostración final.

## Estado de las verificaciones

- La compilación de la versión `00c7a80` pasó con `npm.cmd run build`. El mismo commit estaba publicado en [GitHub](https://github.com/AnthoAl/ObjPerdidosB-G2/tree/00c7a80).
- En PostgreSQL 17 local pasaron 41 comprobaciones del esquema y sus permisos. En Supabase se verificaron cuatro tablas con RLS, seis políticas de PostgreSQL, seis de Storage y el bucket privado. La API real rechazó una consulta de objetos sin sesión con HTTP 401 y código `42501`.
- En Chrome, con Supabase simulado, se probaron el registro, la validación de imágenes, el reintento de una carga parcial, la consulta de evidencia, la lectura del QR, la impresión y la edición de ubicación.
- El 22 de noviembre de 2026 se completó la integración con el Supabase del equipo. El objeto ficticio `Calculadora de demostración Fase 5` quedó **En custodia** en `Armario de demostración B`, con una imagen en el bucket privado. Después de abrir el enlace del QR y recargar, la aplicación volvió a mostrar la ubicación actualizada, la imagen y las observaciones originales.

## Casos de aceptación

Usa una cuenta con rol de encargado y una cuenta común para las pruebas de acceso. Las cuentas nuevas deben confirmar su correo en Supabase antes de ingresar. Registra un objeto ficticio como `Calculadora de demostración Fase 5` y adjunta una imagen de prueba sin datos personales. Conserva la misma etiqueta y el mismo expediente durante el recorrido.

Si el alta devuelve `email rate limit exceeded`, el administrador puede crear la cuenta de prueba en **Authentication → Users → Add user → Create new user** con **Auto confirm user?**. Ese formulario confirma solo esa cuenta y permite ingresar con la contraseña definida. [Límites de Supabase Auth](https://supabase.com/docs/guides/auth/rate-limits)

| Caso | Criterio | Comprobación esperada | Resultado observado |
| --- | --- | --- | --- |
| CP-01 | HU-01 CA-01 | Confirmar la custodia con observaciones y al menos una foto. El mensaje de éxito aparece y el objeto pasa a **En custodia**. | Pasó con Supabase real. Se confirmó la custodia y se verificó que la referencia coincide con un archivo en Storage. |
| CP-02 | HU-01 CA-01 | Intentar confirmar la custodia con observaciones y sin foto. El sistema rechaza el envío y el objeto sigue **En recepción**. | Pasó en la app conectada al Supabase real. También pasó en PostgreSQL local. |
| CP-03 | HU-01 CA-02 y CA-03 | Recargar el expediente y comparar la foto y las observaciones con las originales. Verificar que el expediente solo permita consultar la evidencia y que los permisos impidan alterarla. | La evidencia se recuperó en el expediente de solo lectura al recargar con Supabase real. Los intentos de edición y borrado se rechazaron en PostgreSQL local. |
| CP-04 | HU-03 CA-01 | Registrar el objeto, abrir **Imprimir etiqueta** y comprobar que el QR contiene el enlace con su UUID. | Se generó la etiqueta del objeto guardado en Supabase. La decodificación de dos etiquetas y la vista de impresión se probaron previamente en Chrome. |
| CP-05 | HU-03 CA-02 | Escanear la etiqueta con el teléfono, iniciar sesión si corresponde y verificar que el expediente siga disponible al recargar el enlace. | El enlace generado abrió el expediente real en una pestaña nueva y funcionó al recargar. Pendiente escanear con el teléfono. |
| CP-06 | HU-03 CA-03 | Editar la ubicación desde el expediente abierto con QR. Recargar y confirmar que persiste la nueva ubicación y que la evidencia sigue visible. | Pasó con Supabase real. El expediente y PostgreSQL mostraron `Armario de demostración B` y conservaron la evidencia original. |
| CP-07 | HU-03 CA-02 y CA-03 | Abrir un QR inválido, un UUID inexistente y un enlace válido con una cuenta común. Comprobar el mensaje y que la edición quede bloqueada. | El QR inválido y el UUID inexistente fueron rechazados con Supabase real. La cuenta nueva quedó bloqueada en el módulo antes de habilitar su rol. El caso del enlace válido con cuenta común pasó en Chrome con Supabase simulado. |

Para la demo, verifica también la fila del objeto y su ubicación en **Table Editor** y la imagen en **Storage → objetos-perdidos-b-evidencias**. Si vas a mostrar el QR en otro dispositivo, genera la etiqueta desde una URL accesible desde ese dispositivo. La [configuración local](../README.md#ruta-rápida-b-desarrollo-local) usa la URL que indique Vite.

## Demostración y presentación

| Tiempo | Actividad |
| --- | --- |
| 1 min | Mostrar el listado y explicar el resultado de las dos funcionalidades. |
| 4 min | Registrar el objeto, reproducir el rechazo sin foto, confirmar la custodia y recargar. Mostrar la etiqueta y abrir el enlace. Editar la ubicación y comprobar el cambio y la evidencia original. Mostrar el registro y la foto en Supabase. |
| 2 min | Mostrar evidencias reales de la organización del trabajo y las prácticas ágiles que aplicó el equipo. |
| 2 min | Comentar qué funcionó, una dificultad que resolvieron y una mejora para el próximo Sprint. |
| 1 min | Cerrar con el resultado del incremento y dejar tiempo para la pregunta docente. |

El enunciado permite hasta cuatro diapositivas más la demo en vivo y pide que participen todos los integrantes. El historial de GitHub muestra tres incrementos verificables, el [esquema SQL](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/93eca8d), el [registro y la custodia](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/7695ad8) y el [QR con edición de ubicación](https://github.com/AnthoAl/ObjPerdidosB-G2/commit/00c7a80). Para la parte de Scrum, el equipo debe identificar qué evidencia de su organización puede mostrar. Una mejora para la retrospectiva es incluir una prueba de persistencia en el Supabase del equipo antes de cerrar cada historia.
