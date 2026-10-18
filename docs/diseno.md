# Diseño de la app

> **Actualizado:** 2026-10-16. Diseño acordado con Mario en sesión, antes de construir las pantallas.
> Maqueta de la pantalla principal: https://claude.ai/artifact/TScsm8f4QkSyBozqYzoNRv (privada).
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

### Semanas (la principal)

Una sola pantalla con las semanas en orden, de lunes a domingo. Sin menús que elegir.

- **La semana actual, abierta.** Encabezado con fechas y, si hay episodio, número, invitado y tema.
  Debajo, los siete días en fila (en móvil, en lista). Cada día muestra sus piezas con la hora y el
  nombre corto, y una marca: hueca si está pendiente, rellena si está programada, ámbar si va justa
  o hay que revisarla. Hoy, resaltado.
- **La semana siguiente, debajo.** Si tiene plan, igual pero más tenue. Si no, «Sin planificar» y el
  botón **Planificar**: es la única acción principal (azul) de la pantalla. Puede mostrar piezas que
  caen en ella desde el plan de la semana anterior.
- **Semanas pasadas y lejanas:** una línea plegada cada una; se abren al pulsarlas.
- Solo se avisa de la **semana siguiente** sin plan. Planificar más lejos se puede, no se exige.

### Paneles de detalle

Todo el detalle se abre en el mismo sitio: un panel a la derecha (en móvil, una hoja desde abajo).
Nada se edita en la pantalla principal; fuera del modo edición solo se cambia el estado de una pieza.

- **Pieza** (al pulsarla): nombre, fecha y hora, posición respecto al episodio (D-1…D+5), episodio,
  formato, canales, días de preparación, estado y su registro. Botón principal: **Marcar como
  programada** / **Volver a pendiente**.
  Con el lápiz: cambiar día y hora, o quitarla de este plan (pide confirmación).
- **Semana** (al pulsar su encabezado): datos del episodio, estrategia usada y sus piezas.
  Con el lápiz: editar los datos del episodio, añadir una pieza suelta, cambiar la estrategia
  (regenera las piezas y avisa si alguna estaba programada) y mover la semana entera de fecha.
- El modo edición termina con **Guardar** o **Cancelar**. Los cambios afectan solo a ese plan, nunca
  a la estrategia ni a la pieza de origen.

### Planificar

**Planificar** abre el panel con tres pasos en una vista:

1. ¿Hay episodio? Sí / No (marcado Sí por defecto).
2. Si lo hay: número (propuesto: el siguiente al último), día de publicación (propuesto: el mismo día
   de la semana que el último episodio), invitado y tema (pueden quedar vacíos).
3. Estrategia: solo las del tipo que toca (con o sin episodio) y que no usen piezas archivadas, cada
   una con su mini fila de días.

Debajo, vista previa con las piezas, sus fechas y horas reales, y el botón **Crear plan**.

### Estrategias

Segunda sección de la cabecera (junto a **Semanas**). Contiene:

- **Estrategias**, en «Con episodio» y «Sin episodio», con su mini fila de días. Al editar una, se
  ponen o quitan piezas en cada día de D-1 a D+5; una pieza solo entra en los días que admite. Una
  estrategia que usa una pieza archivada se marca «no disponible» y no se ofrece al planificar.
- **Piezas**: nombre, nombre corto, formato, canales, días permitidos, días de preparación y hora
  habitual. Se **archivan, no se borran**; las archivadas, plegadas al final, se pueden recuperar.

Editar estrategias o piezas **nunca cambia los planes ya creados**.

### Ajustes

Icono de cuenta arriba a la derecha. Solo lo que es de la app, no de la planificación: tema
(**claro, oscuro o sistema**), **Cambiar contraseña** y **Salir**.

### Acceso: solo por invitación

No hay registro. Solo entra quien Mario invita desde Supabase (decidido el 17-oct-2026):

1. Mario invita a un correo desde Supabase («Invite user»).
2. El correo lleva a la app, que comprueba el enlace y abre **Crea tu contraseña**.
3. Con la contraseña creada, se entra con normalidad desde **Entrar**.

Si alguien olvida su contraseña, Mario le manda desde Supabase un correo de recuperación que lleva
a la misma pantalla. En **Entrar** no hay enlace de «¿Olvidaste tu contraseña?». Los pasos de
Supabase (plantillas de correo y direcciones permitidas) están en [acceso.md](acceso.md).

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
  planificar.
- Si una hora no existe por el cambio de horario (de 2:00 a 3:00 la noche de marzo), la app avisa.
- La hora de la app es la prevista; mientras no haya conexión, la real es la de Metricool y la app
  no se entera si allí se cambia.
- **D** es el día de publicación del episodio. Suele ser viernes, pero no se da por hecho en el
  código. En una semana sin episodio, D es el día de referencia que se elige al planificar.

## Datos

| Tabla | Qué guarda |
| --- | --- |
| `perfiles` | Una fila por usuario de Supabase Auth: el nombre que sale en el registro |
| `piezas` | Plantillas: nombre, nombre corto, formato, canales, días permitidos, días de preparación, hora habitual, archivada |
| `estrategias` | Nombre y tipo (con o sin episodio) |
| `estrategia_piezas` | Qué pieza va en qué día (desplazamiento de D-1 a D+5) |
| `planes` | Uno por semana planificada: lunes de la semana, día D, si hay episodio, número, invitado, tema y nombre de la estrategia usada |
| `plan_piezas` | La **copia fija** al planificar: datos de la pieza copiados, fecha, hora, desplazamiento, estado y marca de revisar |
| `registro` | Quién (usuario), qué acción, sobre qué fila y cuándo |

- **Una semana sin planificar no se guarda:** es una semana sin plan. Hay como mucho un plan por
  semana.
- **El registro lo escribe la base de datos** con disparadores (triggers) que toman el usuario de la
  sesión, no la app: no puede olvidarse ni saltarse.
- **Seguridad:** RLS en todas las tablas. Solo usuarios con sesión pueden leer y escribir; los tres
  pueden lo mismo. Sin sesión, ninguna fila. El registro público de Supabase está desactivado y solo
  se entra por invitación (ver [Acceso](#acceso-solo-por-invitación)).
- **Sin campos de Metricool por ahora:** se añaden cuando se conecte.
- **Datos iniciales:** las piezas (T0–T4, clips) y estrategias (E1–E4) del prototipo, editables
  después desde Estrategias.
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

- Pruebas de la lógica sin pantalla: generar un plan (copia fija, fechas y horas desde D), «va
  justa», «revisar en Metricool» al mover y horas en `Europe/Madrid` alrededor de los cambios de
  horario.
- Pruebas de seguridad en la base: sin sesión no se lee ni se escribe nada; el registro guarda el
  usuario correcto.
- Recorrido completo en el navegador: entrar, planificar la semana siguiente, marcar una pieza como
  programada, editar con el lápiz y salir, en escritorio y móvil.
