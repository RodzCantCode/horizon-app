# Acceso por invitación

> **Actualizado:** 2026-10-19. Cómo entra alguien nuevo en la app y cómo recupera su contraseña, lo
> que hay configurado en Supabase para que funcione y dónde vive la publicación y el correo. Por qué
> solo por invitación: [diseno.md § Acceso](diseno.md#acceso-solo-por-invitación).

En la app no hay registro ni «¿Olvidaste tu contraseña?». Todo sale del panel de Supabase, proyecto
«Horizon Sport - App» (organización Horizon Sport). Los enlaces de abajo llevan directamente a cada
pantalla del panel.

## Cuándo se usa

- **Si cambia el dominio de la app, el servicio de correo o las plantillas:** repasar la configuración
  de Supabase (apartado A) y la operación (último apartado). Hoy está todo hecho.
- **Cada vez que alguien tenga que entrar:** invitarle (apartado B).
- **Cuando alguien olvide su contraseña:** mandarle un correo de recuperación (apartado C).

## Requisitos previos

- Acceso al panel de Supabase con la cuenta de Mario.
- La app publicada en la dirección que figura como Site URL (`https://app.horizonsport.co`): el enlace
  de los correos lleva siempre allí.
- **El correo sale por SMTP propio** (Resend, ver [Operación](#operación-publicación-y-correo)), así
  que se puede invitar a cualquier dirección y no hay límite de 2 correos por hora. Si el SMTP se
  desactivara, Supabase solo mandaría a miembros del equipo de la organización, con ese límite.

## Cómo funciona el enlace

Con SMTP propio, las plantillas «Invite user» y «Reset password» son las de Horizon Sport, en español
(apartado A.3), y su enlace va directo a `/auth/confirmar` en la app, que lo comprueba, abre la sesión
y lleva a **Crea tu contraseña**.

**Respaldo:** si algún correo saliera con el enlace por defecto de Supabase (plantillas restablecidas
o SMTP desactivado), ese enlace va a Supabase, que lo comprueba y vuelve a la Site URL con la sesión
(o el error) en el fragmento de la dirección (`#access_token=…&type=invite`, o `#error=…`). La
portada manda a **Entrar** sin perder el fragmento y **Entrar** lo recoge
(`app/entrar/aceptar-enlace.tsx`): con una invitación o una recuperación válidas abre la sesión y
lleva a **Crea tu contraseña**; si no vale, enseña el aviso de «Si falla».

## Pasos

### A. Configurar Supabase (una vez)

1. **Site URL y direcciones permitidas.** En
   [URL Configuration](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/url-configuration):
   - **Site URL:** `https://app.horizonsport.co`, sin `/` al final (la plantilla ya la pone).
   - **Redirect URLs:** `https://app.horizonsport.co/**` y `http://localhost:3000/**` (la segunda,
     para probar en local). Los enlaces de los correos van a la Site URL; estas direcciones solo
     entran en juego si la app pide un enlace con otra.
   - Para probar el enlace en una vista previa de Vercel, cambia la Site URL a la de esa vista previa
     y vuelve a `https://app.horizonsport.co` al terminar.
2. **Registro público desactivado.** En
   [Sign In / Providers](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/providers),
   **Allow new users to sign up** y los accesos anónimos están apagados (comprobado el 2026-10-19;
   hasta ese día el registro estaba encendido). Así solo existe quien Mario invita.
3. **SMTP y plantillas.** En Authentication → Emails → SMTP Settings está el SMTP propio (datos en
   [Operación](#operación-publicación-y-correo)). Las dos plantillas siguientes están puestas en
   [Email Templates](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/templates); si
   se pierden, se vuelven a pegar.

   **Plantilla «Invite user»**, pestaña **Invite user**:
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
2. Le llega el correo «Tu acceso a la app de Horizon Sport». Al pulsar el enlace, se comprueba, se abre su sesión y la
   app le lleva a **Crea tu contraseña**.
3. Con la contraseña guardada entra en la portada. A partir de ahí entra con su correo y esa
   contraseña desde **Entrar**.

### C. Mandar una recuperación de contraseña

1. En [Users](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/auth/users), abre el menú de
   esa persona y elige **Send password recovery**.
2. Le llega el correo «Tu contraseña de Horizon Sport». El enlace lleva a la misma pantalla, **Crea tu contraseña**;
   con la nueva guardada, entra en la portada.

Quien ya ha entrado puede cambiar su contraseña sin correo, desde Ajustes (icono de cuenta, arriba a
la derecha) → **Cambiar contraseña**.

## Cómo verificar que salió bien

- La persona invitada aparece en Users y, tras crear su contraseña, con fecha de último acceso.
- Tiene su fila en la tabla `perfiles`, con el nombre sacado de su correo (lo que va antes de la
  `@`); es el nombre que sale en el registro de cambios. La crea sola un disparador sobre
  `auth.users` (comprobado el 2026-10-19 con la cuenta de Mario). Cada uno cambia su nombre desde
  Ajustes → **Tu cuenta**.
- Cierra sesión y vuelve a entrar con el correo y la contraseña nuevos desde **Entrar**.

## Si falla

- **No llega el correo.** Mira la carpeta de spam. En
  [Logs → Auth](https://supabase.com/dashboard/project/xxtwmhzdkrmyhjmzoxck/logs/auth-logs) se ve si
  Supabase lo rechazó, y en el panel de Resend (Emails) si salió. Si Resend rechaza el envío, revisa
  que el dominio siga verificado y que la clave de API de Supabase → SMTP siga vigente.
- **El enlace lleva a una dirección que no es la de la app** (otra web, `localhost` cuando se quería
  la vista previa…): es la Site URL del apartado A.1. Corrígela y manda otro correo; los enlaces ya
  enviados llevan la dirección de antes.
- **Al pulsar el enlace sale «El enlace no es válido o ha caducado. Pide otro a Mario.»:** el enlace
  ya se usó o caducó (también si la plantilla no tiene el enlace del apartado A.3: revisa
  `type=invite` o `type=recovery`). Manda otro desde el apartado B o C. Si pasa siempre al
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

## Operación: publicación y correo

Sin secretos en el repo: la clave de API de Resend solo está en Supabase → SMTP (la pegó Mario).

- **Vercel** (proyecto `horizon-app`, equipo `rodz-dev`): Framework Preset **Next.js**. Si estuviera
  en «Other», todos los despliegues fallarían con «No Output Directory named public» y producción
  seguiría sirviendo lo anterior (pasó hasta el 2026-10-19). Variables `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, de tipo **Config**, en Production y Preview: son públicas por
  diseño; nunca una clave secreta con prefijo `NEXT_PUBLIC_`.
- **Cloudflare** (DNS de `horizonsport.co`): `app` es un CNAME a Vercel en «DNS only». El correo de
  Google Workspace del dominio no se toca.
- **Resend** (correo de la app): dominio `horizonsport.co` verificado. Sus registros los creó la
  integración Resend–Cloudflare y están en «DNS only»: CNAME `send`, CNAME `rsend` y TXT
  `resend._domainkey`. DMARC es recomendable y opcional; no está puesto.
- **Supabase → SMTP:** host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = clave de
  API de Resend con permiso de envío. Remitente `noreply@horizonsport.co`.
