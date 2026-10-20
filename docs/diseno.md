# Diseño de la app

> **Actualizado:** 2026-10-20. Diseño acordado con Mario en sesión antes de construir las pantallas,
> con lo que se ajustó al construirlas (rama `app-v1`), tras publicarla (navegación lateral, Inicio
> y paneles en ventana centrada) y con la fase 1 del rediseño (Calendario y programar con arrastre,
> construida en `preview`, aún no en producción; lo que queda del rediseño está en
> [rediseno-calendario.md](rediseno-calendario.md)).
> Maqueta de la pantalla principal (anterior al Calendario): https://claude.ai/artifact/TScsm8f4QkSyBozqYzoNRv (privada).
> El prototipo (`prototipo/index.html`) es referencia del modelo, no de la interfaz.

## Objetivo

Que cualquiera de los tres (Mario, Izan, Lluís) sepa en menos de 30 segundos, al entrar y sin
preguntar a nadie:

1. Qué se publica esta semana y los próximos días, con fecha y hora.
2. Qué falta por programar en Metricool.
3. Qué semanas que vienen siguen sin planificar.

No hay responsables: los tres van a una. Lo que importa es quién hizo qué, y eso lo guarda el
registro.

**Por fases.** Ahora la app es solo calendario: lo que se programa en Metricool se hace a mano. Más
adelante se conectará con Metricool para centralizarlo todo aquí; Metricool seguirá siendo lo que
conecta con las redes y publica. La app no publica en redes.

## Pantallas

### Navegación

En escritorio, una barra lateral fija a la izquierda, como en una app de trabajo: el logo arriba,
las secciones (**Inicio**, **Calendario**, **Estrategias**) con su icono, y **Ajustes** al pie. La
sección en la que se está, con fondo suave y el icono en azul. Al pie, **Plegar barra**: la deja en
solo iconos (el logo, «H.») y el contenido ocupa el hueco; plegada, cada icono enseña su nombre al
pasar el ratón (es el nombre de la sección, no un texto de ayuda). Se recuerda en cada navegador,
como el tema. En el móvil (por debajo de 768 px), barra de arriba: logo y cuenta en una fila, las
secciones debajo, solo texto y sin plegar.

### Inicio

La semana en curso y nada más: sus piezas por días (por debajo de 1024 px de ancho, en lista) y sus
paneles. Cada pieza lleva su marca: hueca si está pendiente, rellena si está programada, ámbar si va
justa o hay que revisarla. Hoy, resaltado. Si la semana no tiene plan, **Planificar** en superficie:
lleva al modo programar de [Calendario](#calendario) con esa semana (`/calendario?programar=<lunes>`).

### Calendario

`/calendario`. Tres semanas seguidas, de lunes a domingo, empezando por la actual (o por el lunes de
`?desde=<lunes>`; una fecha que no existe o que no es lunes se ignora y se ve la semana actual). Arriba,
**Anterior**, **Hoy** y **Siguiente** (de semana en semana) y **Programar**, la única acción principal
(azul) de la pantalla. `/semanas` redirige aquí. Por debajo de 1024 px de ancho, los días van en lista
y no se arrastra (el corte es el de las columnas, no el de 768 px del móvil).

- **Cada día enseña sus tarjetas por hora.** *Post:* su marca de estado (la de Inicio), la hora en su
  línea, el nombre y de qué episodio es («Del 06», «Sin episodio»). *Episodio:* tarjeta invertida con
  «Episodio 06», la hora y «YouTube y Spotify»; un plan sin episodio no la tiene. Los posts de un
  episodio pueden caer en cualquier semana y conviven con los del siguiente. El día de hoy, resaltado.
- **Pulsar una tarjeta** abre su ventana: la del post (`?pieza=<id>`) o la de la semana del plan
  (`?semana=<lunes>`), descritas en [Paneles de detalle](#paneles-de-detalle).
- **Arrastrar lo ya guardado** (a partir de 1024 px, fuera del modo programar):
  - Un **post** a otro día se guarda al soltarlo, sin botón. Si estaba programado en Metricool,
    vuelve a pendiente con «revisar en Metricool». Si otra persona lo movió mientras tanto, no se
    pisa: se avisa y se refresca.
  - El **episodio** a otro día mueve **solo el episodio**: cambia el día D (y la semana del plan, si
    D pasa a otra) y los posts no cambian de fecha ni de estado; solo se recalcula su posición
    respecto al nuevo D. Si esa semana ya tiene plan, «Esa semana ya tiene plan» y no cambia nada.
    Decidido por Mario (20-oct-2026): nada se mueve solo mientras siguen probando. Mover la semana
    entera con sus posts se hace desde la ventana de la semana.
  - Un error al guardar sale en un aviso (Toast de Mochi) y la tarjeta vuelve a su sitio.
  - Las tarjetas guardadas no se arrastran por su cuenta (`draggable=false` donde no son origen
    de arrastre), para que soltarlas en un campo no escriba su dirección.
- **Sin arrastre** (móvil o teclado), la ventana del post es el camino: eligiendo otra fecha.
- Solo se avisa en Inicio de la **semana siguiente** sin plan. Programar más lejos se puede, no se
  exige.

### Programar

Se entra con **Programar** (propone la semana siguiente a la de hoy, o la primera después que no tenga plan), con un día
vacío que no haya pasado de una semana sin plan (propone ese día como el del episodio) o con
`?programar=<lunes>`, que es adonde lleva el **Planificar** de Inicio. La columna de la izquierda (en
pantallas estrechas, encima de la lista) pasa a ser el panel de programar; nada se guarda hasta
**Guardar**, que crea el plan entero de una vez (o nada).

1. ¿Hay episodio? Sí / No (marcado Sí por defecto).
2. Si lo hay: número (obligatorio; propuesto: el siguiente al último), invitado y tema (pueden quedar
   vacíos), y **día y hora del episodio** (propuestos: el mismo día de la semana y la hora del último
   episodio). Si no: el **día de referencia** (D; propuesto: el mismo día de la semana que el último
   episodio, o el viernes), sin tarjeta de episodio.
3. Estrategias: solo las del tipo que toca (con o sin episodio) que estén disponibles (con piezas y
   ninguna archivada), cada una con «N posts» y su mini fila.
4. **Al elegir una estrategia, sus posts se pegan** en el calendario alrededor del episodio, con la
   hora habitual de cada pieza, con filete azul a la izquierda y «Del NN» en azul (los demás posts,
   más tenues). Elegir otra los cambia.
5. Se **arrastran** los posts y el episodio (a partir de 1024 px). Arrastrar el episodio, o cambiar
   su día en el panel, mueve solo el episodio: los posts se quedan donde están.
6. **Guardar** crea el plan con lo que se ve; **Cancelar** lo descarta. Si esa semana ya tiene plan
   (otra persona acaba de crearlo), «Esa semana ya tiene plan», no se crea nada y el modo sigue
   abierto con lo colocado. Los ajustes finos de día y hora de cada post se hacen después, desde su
   ventana.

### Paneles de detalle

Todo el detalle se abre en el mismo sitio: una ventana centrada de hasta 960 px de ancho, con los campos
de dos en dos (por debajo de 768 px, una hoja desde abajo, con los campos uno debajo de otro). Es modal: el fondo se atenúa y, al tocarlo, el panel se cierra. Nada se edita en la
pantalla principal; fuera del modo edición solo se cambia el estado de una pieza (y, en Calendario,
se arrastra, ver arriba).

- **Pieza** (al pulsarla): nombre, fecha y hora, posición respecto al episodio (D-2, D+9…: los días
  entre D y su fecha, sin límite), episodio,
  formato, canales, días de preparación, estado y su registro. Botón principal: **Marcar como
  programada**. Si ya lo está, **Volver a pendiente**, en superficie: devolverla es la excepción.
  Con el lápiz: cambiar día (una fecha cualquiera) y hora, o quitarla de este plan (pide
  confirmación).
- **Semana** (al pulsar su encabezado en Inicio, o la tarjeta de su episodio en Calendario): datos del
  episodio (con su día y hora), estrategia usada y sus piezas. Con el lápiz: editar los datos del
  episodio (el número es obligatorio; la hora, editable aquí), añadir una pieza suelta, cambiar la
  estrategia (regenera las piezas y avisa si alguna estaba programada) y mover la semana entera
  (el día D nuevo, cualquiera; si cae en otra semana, el plan pasa a ella, y si esa ya tiene plan,
  no se mueve).
- El modo edición termina con **Guardar** o **Cancelar**. Los cambios afectan solo a ese plan, nunca
  a la estrategia ni a la pieza de origen.
- **Panel desfasado.** Al cambiar el día o la hora de una pieza, o al añadir una pieza suelta, no se
  pisa lo que otra persona haya cambiado con el panel abierto: si la pieza ya no está en el día y la
  hora que enseñaba el panel, o la semana tiene otro día D, no se guarda. El panel sale del modo edición y enseña los datos nuevos con el aviso («La
  pieza ha cambiado…», «La semana ha cambiado…», con «Revisa y vuelve a guardar»); para volver a
  intentarlo se entra otra vez con el lápiz, ya con esos datos. Si la pieza o el plan ya no existen,
  lo dice. **No cubre** «Editar datos del episodio» (número, invitado, tema): ahí gana el último que
  guarda.

### Estrategias

Sección de la navegación. Contiene:

- **Estrategias**, en «Con episodio» y «Sin episodio», con su mini fila de cuadrados (uno por día).
  Al editar una, se ponen o quitan piezas en cada día de D-7 a D+14 (se enseñan D-2…D+12, más los
  que la estrategia ya use fuera de ahí, y **Más días** abre el resto); una pieza no se repite en el
  mismo día. Una estrategia sin piezas o que usa una pieza archivada se marca «no disponible» y no
  se ofrece al programar.
- **Piezas**: nombre, nombre corto, formato (Carrusel o Reel), canales, días de preparación y hora
  habitual. Se **archivan, no se borran**; las archivadas, plegadas al final, se pueden recuperar.
  Los «días permitidos» ya no se enseñan ni se comprueban (la columna sigue en la base, sin uso).

Editar estrategias o piezas **nunca cambia los planes ya creados**. Los posts de un plan pueden estar
en cualquier fecha, no solo en el rango de la estrategia.

### Ajustes

Al pie de la barra lateral (en el móvil, el icono de cuenta arriba a la derecha). Solo lo que es de la app, no de la planificación: **Tu cuenta**
(el correo con el que has entrado, que no se cambia, y **Tu nombre**, el que sale en el registro:
con el lápiz pasa a un campo de hasta 40 caracteres con **Guardar** y **Cancelar**), tema
(**claro, oscuro o sistema**), **Cambiar contraseña** y **Salir** (cierra la sesión solo en este
dispositivo).

### Acceso: solo por invitación

No hay registro. Solo entra quien Mario invita desde Supabase (decidido el 17-oct-2026):

1. Mario invita a un correo desde Supabase («Invite user»).
2. El enlace del correo se comprueba, abre la sesión y lleva a **Crea tu contraseña**. El correo sale
   con plantilla propia (SMTP propio); si saliera con el enlace por defecto de Supabase, lo recoge
   **Entrar**.
3. Con la contraseña creada, se entra con normalidad desde **Entrar**.

Si alguien olvida su contraseña, Mario le manda desde Supabase un correo de recuperación que lleva
a la misma pantalla. En **Entrar** no hay enlace de «¿Olvidaste tu contraseña?». Los pasos de
Supabase (Site URL, registro desactivado, SMTP y plantillas de correo) están en [acceso.md](acceso.md).

## Estados y avisos

- **Dos estados por pieza:** pendiente y programada (en Metricool). Cuando se conecte Metricool, el
  paso a programada podrá ser automático.
- **«Va justa»** no es un estado: lo calcula la app. Una pieza pendiente va justa cuando hoy es igual
  o posterior a su fecha menos sus días de preparación.
- **«Revisar en Metricool»:** si se mueve de fecha u hora una pieza programada (sola o con la semana
  entera), queda en ámbar con esa marca hasta que alguien la vuelva a marcar como programada.

## Fechas y horas

- Cada pieza de un plan tiene **fecha y hora de reloj en hora de España** (`Europe/Madrid`),
  guardadas por separado. «Viernes 18:00» sigue siendo viernes 18:00 en verano y en invierno; el
  momento exacto se calcula con las reglas de `Europe/Madrid` cuando haga falta (por ejemplo, al
  mandarlo a Metricool). Nunca se guarda una hora fija en UTC.
- La hora puede quedar vacía. Cada pieza tiene una **hora habitual** que la copia hereda al
  programar. En los campos, la hora se escribe como texto «hh:mm».
- El **episodio** también tiene hora (opcional, `hora_episodio` en el plan). Al programar se propone la
  del último episodio, y se cambia en el panel de programar o en la ventana de la semana; no se
  cambia arrastrando.
- Si una hora no existe por el cambio de horario (de 2:00 a 3:00 la noche de marzo), la app avisa.
- La hora de la app es la prevista; mientras no haya conexión, la real es la de Metricool y la app
  no se entera si allí se cambia.
- **D** es el día de publicación del episodio. Suele ser viernes, pero no se da por hecho en el
  código. En una semana sin episodio, D es el día de referencia que se elige al programar. Cada
  plan pertenece a la semana (lunes a domingo) de su D; sus posts pueden caer en otras semanas.

## Datos

| Tabla | Qué guarda |
| --- | --- |
| `perfiles` | Una fila por usuario de Supabase Auth: el nombre que sale en el registro |
| `piezas` | Plantillas: nombre, nombre corto, formato, canales, días permitidos (sin uso), días de preparación, hora habitual, archivada |
| `estrategias` | Nombre y tipo (con o sin episodio) |
| `estrategia_piezas` | Qué pieza va en qué día (desplazamiento de D-7 a D+14) |
| `planes` | Uno por semana programada: lunes de la semana, día D, `hora_episodio` (opcional), si hay episodio, número, invitado, tema y nombre de la estrategia usada |
| `plan_piezas` | La **copia fija** al programar: datos de la pieza copiados, fecha, hora, desplazamiento (días entre D y la fecha, sin límite), estado y marca de revisar |
| `registro` | Quién (usuario), qué acción, sobre qué fila y cuándo |

- **Una semana sin programar no se guarda:** es una semana sin plan. Hay como mucho un plan por
  semana (la de su día D).
- **Funciones de la base** (`supabase/migrations/`): `crear_plan`, `mover_plan` (la semana entera),
  `mover_episodio` (solo el episodio; recalcula el desplazamiento de los posts y no toca su fecha,
  hora ni estado) y `cambiar_estrategia`.
- **El registro lo escribe la base de datos** con disparadores (triggers) que toman el usuario de la
  sesión, no la app: no puede olvidarse ni saltarse. Un cambio de un post en el que solo cambia su
  desplazamiento (lo que hace `mover_episodio`) no se anota: el post sigue igual; el cambio de D se
  anota en el plan.
- **Seguridad:** RLS en todas las tablas. Solo usuarios con sesión pueden leer y escribir; los tres
  pueden lo mismo. Sin sesión, ninguna fila. El registro público de Supabase está desactivado y solo
  se entra por invitación (ver [Acceso](#acceso-solo-por-invitación)).
- **Sin campos de Metricool por ahora:** se añaden cuando se conecte.
- **Datos iniciales:** las piezas (T0–T4, clips) y estrategias (E1–E4) del prototipo, editables
  después desde Estrategias.
- **Una sola base para `preview` y producción:** una migración afecta a las dos. Por eso se limitan
  a ampliar o añadir columnas opcionales, y el código publicado tiene que seguir funcionando con
  ella (las piezas nuevas siguen guardando días permitidos -1…5 por esa compatibilidad).
- Cada migración se aplica con la conexión `supabase-horizon` y se guarda también como archivo en
  `supabase/migrations/`.

## Diseño visual

El sistema de la web (`../horizon-web/docs/DISENO.md`): Archivo con el contraste en la anchura, azul
`#169EFF` solo en la acción principal de cada vista, sin textos de ayuda tipo tooltip. Sobriedad
tipo Apple: lo necesario a la vista y el detalle a un clic, siempre en el mismo sitio. El tema
oscuro es el de la web; el claro lo define la app con la misma lógica (sus tokens viven en
`app/global.css`). Prioridad: ordenador; el móvil tiene que funcionar bien.

## Fuera de alcance por ahora

- Conexión con Metricool.
- Una vista general del registro (de momento, solo el de cada pieza en su panel).
- Responsables, notificaciones y avisos por correo.

## Cómo se comprobará

- Pruebas de la lógica sin pantalla: generar un plan (copia fija, fechas y horas desde D), pegar una
  estrategia de D-7 a D+14, el desplazamiento al mover un post o el episodio, las tres semanas del
  Calendario, «va justa», «revisar en Metricool» al mover y horas en `Europe/Madrid` alrededor de los
  cambios de horario.
- Pruebas de seguridad en la base: sin sesión no se lee ni se escribe nada; el registro guarda el
  usuario correcto.
- Recorrido completo en el navegador: entrar, programar un episodio con arrastre y guardar, mover un
  post y el episodio ya guardados, marcar una pieza como programada, editar con el lápiz y salir, en
  escritorio y móvil (en el móvil sin arrastre: moverlo desde su ventana).
