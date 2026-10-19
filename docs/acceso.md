# Acceso por invitación

> **Actualizado:** 2026-10-19. Cómo entra alguien nuevo en la app y cómo recupera su contraseña, y lo
> que hay que configurar en Supabase para que funcione. Por qué solo por invitación:
> [diseno.md § Acceso](diseno.md#acceso-solo-por-invitación).

En la app no hay registro ni «¿Olvidaste tu contraseña?». Todo sale del panel de Supabase, proyecto
«Horizon Sport - App» (organización Horizon Sport). Los enlaces de abajo llevan directamente a cada
pantalla del panel.

## Cuándo se usa

- **Una vez, antes de la primera invitación:** configurar Supabase (apartado A). Hay que repasarlo si
  cambia el dominio de la app o cuando haya SMTP propio (plantillas).
- **Cada vez que alguien tenga que entrar:** invitarle (apartado B).
- **Cuando alguien olvide su contraseña:** mandarle un correo de recuperación (apartado C).

## Requisitos previos

- Acceso al panel de Supabase con la cuenta de Mario.
- La app publicada en la dirección que figura como Site URL (apartado A, paso 1): el enlace de los
  correos lleva siempre allí.
- **El correo tiene que poder salir.** Sin un servidor de correo propio (SMTP), Supabase solo manda
  correos a direcciones que sean miembros del equipo de la organización en Supabase, y como mucho 2
  por hora. Para invitar a alguien que no es del equipo hay que añadirle al equipo de la organización
  o configurar un SMTP propio (Authentication → Emails → SMTP Settings). Eso último no está hecho
  (pendiente: Resend).

## Cómo funciona el enlace hoy (sin SMTP propio)

Sin SMTP propio, Supabase **no deja editar las plantillas de correo** (comprobado en el panel el
19-oct-2026): la invitación y la recuperación salen con su texto por defecto, en inglés, y con su
enlace por defecto. Ese enlace va a Supabase, que lo comprueba y vuelve a la Site URL con la sesión
(o el error) en el fragmento de la dirección (`#access_token=…&type=invite`, o `#error=…`). La
portada manda a **Entrar** sin perder el fragmento, y **Entrar** lo recoge
(`app/entrar/aceptar-enlace.tsx`): con una invitación o una recuperación válidas abre la sesión y
lleva a **Crea tu contraseña**; si el enlace no vale, enseña el aviso de abajo.

`/auth/confirmar` y las plantillas del apartado A.3 son para cuando haya SMTP propio: entonces el
enlace va directo a la app, con el texto de Horizon Sport.

## Pasos

### A. Configurar Supabase (una vez)

1. **Site URL y direcciones permitidas.** En
   [URL Configuration](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/url-configuration):
   - **Site URL:** `https://app.horizonsport.co`, sin `/` al final (la plantilla ya la pone). Mientras
     la app no esté publicada ahí (Tarea 12 del plan), pon la dirección donde se vaya a abrir el
     enlace: la de la rama en Vercel, `https://horizon-app-git-app-v1-rodz-dev.vercel.app` (si las
     vistas previas están protegidas, solo la abre quien tenga acceso en Vercel), o
     `http://localhost:3000` para probar en local. Vuelve a `https://app.horizonsport.co` al publicar.
   - **Redirect URLs:** no hacen falta. Ni el enlace por defecto ni el de las plantillas las usan:
     los dos van a la Site URL. Solo servirían si un día la app pide un enlace con otra dirección;
     entonces se añadirían estas (si ya están puestas, no estorban):

     ```text
     http://localhost:3000/**
     https://horizon-app-*-rodz-dev.vercel.app/**
     https://app.horizonsport.co/**
     ```

     La segunda cubre todas las vistas previas del proyecto `horizon-app` del equipo `rodz-dev` en
     Vercel.
2. **Registro público desactivado.** En
   [Sign In / Providers](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/providers),
   **Allow new users to sign up** tiene que estar apagado. Así solo existe quien Mario invita.
3. **Plantillas, solo con SMTP propio (pendiente).** Sin SMTP, el panel no deja cambiarlas y no hace
   falta: la app recoge el enlace por defecto (ver arriba). Con SMTP propio, se ponen estas dos y el
   enlace pasa a ir directo a `/auth/confirmar`.

   **Plantilla «Invite user».** En
   [Email Templates](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/templates),
   pestaña **Invite user**:
   - Asunto: `Tu acceso a la app de Horizon Sport`
   - Cuerpo (pestaña de código, sustituye todo lo que haya):

     ```html
     <h2>Tu acceso a la app de Horizon Sport</h2>
     <p>Te han dado acceso a la herramienta de contenido de Horizon Sport. Para entrar, crea tu contraseña desde este enlace:</p>
     <p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite">Crear mi contraseña</a></p>
     <p>El enlace caduca pronto y solo sirve una vez. Si no esperabas este correo, ignóralo.</p>
     ```

   **Plantilla «Reset password»**, en la misma página:
   - Asunto: `Tu contraseña de Horizon Sport`
   - Cuerpo:

     ```html
     <h2>Crea una contraseña nueva</h2>
     <p>Este enlace te deja crear una contraseña nueva para la app de Horizon Sport:</p>
     <p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery">Crear una contraseña nueva</a></p>
     <p>El enlace caduca pronto y solo sirve una vez. Si no lo has pedido, ignora este correo: tu contraseña no cambia.</p>
     ```

### B. Invitar a alguien

1. En [Users](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/users), **Add user** →
   **Send invitation**, escribe su correo y envía.
2. Le llega el correo de invitación de Supabase (hoy, el de por defecto, en inglés; con SMTP propio,
   «Tu acceso a la app de Horizon Sport»). Al pulsar el enlace, se comprueba, se abre su sesión y la
   app le lleva a **Crea tu contraseña**.
3. Con la contraseña guardada entra en la portada. A partir de ahí entra con su correo y esa
   contraseña desde **Entrar**.

### C. Mandar una recuperación de contraseña

1. En [Users](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/users), abre el menú de
   esa persona y elige **Send password recovery**.
2. Le llega el correo de recuperación de Supabase (hoy, el de por defecto, en inglés; con SMTP propio,
   «Tu contraseña de Horizon Sport»). El enlace lleva a la misma pantalla, **Crea tu contraseña**;
   con la nueva guardada, entra en la portada.

Quien ya ha entrado puede cambiar su contraseña sin correo, desde Ajustes (icono de cuenta, arriba a
la derecha) → **Cambiar contraseña**.

## Cómo verificar que salió bien

- La persona invitada aparece en Users y, tras crear su contraseña, con fecha de último acceso.
- Tiene su fila en la tabla `perfiles`, con el nombre sacado de su correo (lo que va antes de la
  `@`); es el nombre que sale en el registro de cambios. Se puede corregir editando esa fila.
  **Pendiente de la primera invitación real:** comprobar que la fila se crea sola (la crea un
  disparador sobre `auth.users` que todavía no se ha visto funcionar con una invitación).
- Cierra sesión y vuelve a entrar con el correo y la contraseña nuevos desde **Entrar**.

## Si falla

- **No llega el correo.** Mira la carpeta de spam y el requisito del correo de arriba (miembro del
  equipo, o SMTP propio; 2 correos por hora como mucho). En
  [Logs → Auth](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/logs/auth-logs) se ve si
  Supabase lo rechazó.
- **El enlace lleva a una dirección que no es la de la app** (otra web, `localhost` cuando se quería
  la vista previa…): es la Site URL del paso A.1. Corrígela y manda otro correo; los enlaces ya
  enviados llevan la dirección de antes.
- **Al pulsar el enlace sale «El enlace no es válido o ha caducado. Pide otro a Mario.»:** el enlace
  ya se usó o caducó (con SMTP propio, también si la plantilla no tiene el enlace del apartado A.3:
  revisa `type=invite` o `type=recovery`). Manda otro desde el apartado B o C. Si pasa siempre al
  primer clic, puede que el correo de esa persona abra los enlaces antes que ella para analizarlos
  (pasa con algunos correos de empresa) y lo gaste: prueba con otra dirección.
- **El enlace lleva a Entrar sin aviso, en vez de a Crea tu contraseña:** la sesión no llegó a
  guardarse (por ejemplo, un navegador que bloquea cookies o el visor de la app de correo). Que abra
  el enlace en su navegador habitual; el enlace ya está gastado, así que hay que mandar otro.
- **El enlace lleva a la portada de otra cuenta y no pide contraseña:** en ese navegador ya había una
  sesión abierta (por ejemplo, la de Mario al probar una invitación), así que la portada no manda a
  Entrar y el enlace por defecto se queda sin recoger. Hay que salir (Ajustes → **Salir**) y mandar
  otro: Supabase ya gastó el enlace al comprobarlo.
- **Deshacer una invitación que aún no se ha usado:** en Users, borra ese usuario (menú de la fila →
  **Delete user**); su enlace deja de servir. No lo hagas con alguien que ya ha trabajado en la app:
  se borra también su fila de `perfiles` y el registro se queda sin su nombre.
