# Rediseño: calendario, piezas y estrategias, Inicio

> **Actualizado:** 2026-10-20. **Aprobado por Mario el 20-oct-2026.** Documento de trabajo de esta
> fase: cuando lo de cada fase esté construido, lo vigente pasa a [diseno.md](diseno.md) y la fase
> se retira de aquí. Boceto que se aprobó como referencia visual (local, no versionado):
> `.superpowers/brainstorm/*/content/calendario-v2.html`.

## Por qué

La app publicada el 19-oct-2026 funciona, pero programar es incómodo y no encaja con cómo trabajan
Mario, Izan y Lluís:

- **El momento clave es justo después de grabar.** Ese día, con el episodio fresco y la lista de
  momentos apuntados en la grabación, deciden en qué semana sale (dejando días para editar y
  revisar), eligen una estrategia y ajustan días y horas.
- **Están probando días y horas**, del episodio y de los posts. La estrategia es un punto de
  partida, no una regla: cada post se tiene que poder mover a cualquier día.
- **Los posts de un episodio se alargan más de una semana** y conviven con los del siguiente (como
  hace «Tengo un Plan»).
- Hoy mover un post es abrirlo, pulsar el lápiz y guardar, uno a uno, y solo dentro de D-1…D+5.
- Los nombres confunden: códigos (T0–T4, E1–E4), nombre y nombre corto.
- Inicio enseña una fila de días y poco más: no se sabe qué hacer ni qué mirar.

Lo que Mario pidió, en sus palabras: «una vista de calendario con un par de semanas, donde al clicar
una estrategia esta se pegue, y podamos arrastrar las piezas de un día a otro. Como haríamos con un
calendario físico y un boli».

## Objetivos

1. Programar un episodio en un calendario de varias semanas: elegir estrategia, verla pegada
   alrededor del episodio y arrastrar cada post (y el propio episodio) al día que se quiera.
2. Ver juntos los posts de varios episodios y distinguir de cuál es cada uno.
3. Nombres claros, sin códigos ni abreviaturas.
4. Un Inicio que diga qué toca sin tener que pensar.

## No objetivos (por ahora)

- **Conexión con Metricool.** Llegará después; esto no debe cerrarle el paso (ver
  [Lo que hay que respetar](#lo-que-hay-que-respetar)).
- **Notas o «momentos» por post.** Lo que apuntan en la grabación son notas en sucio (minuto y frase
  o tema) que cambian; siguen en Notion. Queda por decidir si la app guarda, como mucho, un enlace a
  la página de Notion de cada episodio. Fuera de este rediseño.
- **Arrastrar en el móvil.** En el móvil se mueve desde la ventana del post (ver más abajo).

## Antiobjetivos (fallaría aunque funcionara)

- Que abrume: muchos controles, textos de ayuda o datos que no se usan.
- Volver a los códigos (T2, E1) o a dos nombres por pieza.
- Que la app se convierta en un bloc de notas.
- Perder lo que se hizo de verdad: cada post guarda su fecha y hora reales, que más adelante se
  cruzarán con los resultados de Metricool.
- Romper la versión publicada mientras se construye (ver [Base de datos](#base-de-datos)).

## Fases

1. **Calendario** (concreta en este documento): la base de datos y la pantalla de programar.
2. **Piezas y estrategias**: nombres claros y las estrategias reales (4 con episodio y 2 sin).
3. **Inicio**: se diseña con Mario cuando la fase 1 esté en `preview`.

Cada fase se construye en `preview` y se publica cuando Mario la da por buena.

## Fase 1: Calendario

### Navegación

La sección **Semanas** pasa a llamarse **Calendario** (`/calendario`, con el mismo icono). La barra
lateral queda: Inicio, Calendario, Estrategias y, al pie, Plegar barra y Ajustes. `/semanas` deja
de existir (redirige a `/calendario`).

### La pantalla

Como el boceto `calendario-v2.html`, con el sistema visual de la app (tokens, Archivo, Mochi):

- **Tres semanas seguidas, de lunes a domingo**, empezando por la actual, con botones para ir a las
  anteriores y las siguientes de semana en semana y volver a «Hoy». El día de hoy, resaltado como
  ahora.
- **Cada día enseña sus tarjetas por hora:**
  - **Post:** la marca de estado (hueca pendiente, rellena programada, ámbar si va justa o hay que
    revisarlo, como ahora), la hora en su propia línea, el nombre y de qué es: «Del 06» si es de un
    episodio, «Sin episodio» si es de un plan sin episodio.
  - **Episodio:** tarjeta invertida (como la pastilla elegida de Mochi), con «Episodio 06», la hora
    y «YouTube y Spotify». Un plan sin episodio no tiene tarjeta de episodio.
- **Colores:** los posts del plan que se está programando llevan el filete azul a la izquierda; los
  demás, sin filete y en tono más tenue. Fuera del modo programar, todos igual.
- **Pulsar una tarjeta** abre su ventana de siempre (la de ahora, centrada): estado, día y hora,
  registro, quitarla. El campo de día pasa a ser libre (cualquier fecha), no la lista D-1…D+5.

### Programar un episodio nuevo

1. Se entra con **Programar** (botón principal de la pantalla, azul). Pide la semana del episodio:
   por defecto la siguiente que no tenga plan. *(Llamada mía: también se puede entrar pulsando un día
   vacío de una semana sin plan, que propone ese día como el del episodio.)*
2. La columna de la izquierda pasa a ser el **panel de programar**:
   - ¿Hay episodio? Sí / No.
   - Si lo hay: número (obligatorio, propuesto el siguiente), invitado, tema, **día y hora** del
     episodio (propuestos: el mismo día de la semana y la hora del último).
   - Si no lo hay: el **día de referencia** (D), como ahora (propuesto el viernes). Sin tarjeta de
     episodio: la estrategia se pega alrededor de ese día. *(Llamada mía.)*
   - Las estrategias del tipo que toca, cada una con nombre, una línea que la describe, cuántos posts
     tiene y su mini fila de puntos (un cuadrado por día, el del episodio y los de los posts
     marcados). *(Llamada mía: la fila va de D-2 a D+12 y se alarga si la estrategia usa días más
     allá, hasta D-7…D+14.)*
3. **Al pulsar una estrategia, sus posts se pegan** en el calendario alrededor del episodio, con la
   hora habitual de cada pieza. Pulsar otra los cambia. Todavía no se ha guardado nada.
4. **Se arrastra** cualquier post o el episodio a otro día. Arrastrar el episodio mueve solo el
   episodio: los posts se quedan donde están (decidido por Mario: nada se mueve solo mientras
   siguen probando; si hay que recolocar, se recoloca a mano).
5. **Guardar** crea el plan con lo que se ve (una sola llamada: o se crea todo o nada). **Cancelar**
   lo descarta. Si la semana ya tenía plan (otra persona acaba de crearlo), se avisa y no se crea.

### Mover lo ya programado

- **Arrastrar un post a otro día lo guarda al soltarlo**, sin botón: es un cambio pequeño y se ve.
  Si estaba programado en Metricool, vuelve a pendiente con «revisar en Metricool», como ahora.
  Si otra persona lo movió mientras tanto, no se pisa: se avisa y se refresca (la regla de ahora).
- **Arrastrar el episodio de un plan guardado mueve solo el episodio** (decidido por Mario el
  20-oct-2026, por lo mismo: nada automático por ahora). Cambia el día D, y la semana del plan si D
  pasa a otra (si esa semana ya tiene plan, se avisa y no se mueve). Los posts no cambian de fecha
  ni de estado; solo se recalcula su desplazamiento respecto al nuevo D. «Mover la semana» con todos
  sus posts sigue en la ventana de la semana, como ahora.
- **La hora** se cambia en la ventana del post (o del episodio), no arrastrando.
- **Cambiar la estrategia** de un plan guardado sigue en la ventana de la semana, como ahora
  (regenera los posts y pide confirmación si alguno estaba programado).
- **En el móvil** (por debajo de 768 px) no se arrastra: el calendario se ve en lista por días, como
  ahora la semana, y un post se mueve desde su ventana eligiendo otra fecha. *(Llamada mía:)*
  programar también se puede: el panel de programar va encima de la lista, se elige estrategia, se
  ve pegada y se guarda; los ajustes de día se hacen después, desde la ventana de cada post. Lo mismo vale con
  teclado en escritorio: la ventana es el camino accesible; arrastrar es un atajo.

### Base de datos

Un único proyecto de Supabase sirve a `preview` y a producción: **una migración afecta a las dos a
la vez**, y lo que se cree o mueva probando en `preview` aparece también en producción. Mario lo
acepta (20-oct-2026): la app aún no se usa, así que no hace falta un paso de compatibilidad en
producción antes de construir. Por eso los cambios solo amplían lo permitido o añaden columnas opcionales, y se aplican
antes de publicar el código nuevo; el código publicado hoy tiene que seguir funcionando con la base
cambiada. No se borra ni se reescribe ningún dato.

| Cambio | Por qué |
| --- | --- |
| `planes.hora_episodio` (`time`, opcional) | El episodio tiene hora y la vais probando |
| `estrategia_piezas.desplazamiento`: de `-1…5` a `-7…14` | Estrategias que empiezan antes o se alargan dos semanas (*llamada mía*: el rango) |
| Posts de un plan en cualquier fecha | Se quita el límite D-1…D+5 de las acciones de la app (`plan_piezas` no lo tiene en la base). El desplazamiento de cada post se recalcula (días entre D y su fecha) y puede quedar fuera de -7…14 |
| Estrategias de -7 a 14 y sin «días permitidos» | *Llamada mía:* entra en la fase 1 y no en la 2, porque sin ello ninguna estrategia podría usar el calendario entero. El editor de Estrategias admite de D-7 a D+14 y los «días permitidos» de cada pieza dejan de comprobarse y de verse (la columna se queda en la base, sin uso) |
| `planes`: sigue un plan por semana (la de su día D) | Un episodio por semana como mucho; sus posts pueden caer en otras semanas |

Las piezas quedan en hora de España (`Europe/Madrid`), fecha y hora por separado, como ahora.

### Lo que hay que respetar

Las reglas de [diseno.md](diseno.md) que no cambian: copia fija al planificar, archivar en vez de
borrar, «revisar en Metricool» al mover lo programado, el registro de quién hizo qué, «va justa» y
los avisos de panel desfasado. Nada de esto debe impedir más adelante mandar cada post a Metricool
con su fecha y hora.

### Cómo se comprobará

- Pruebas de la lógica: pegar una estrategia con desplazamientos de -7 a 14, recalcular el
  desplazamiento al mover, mover un plan con posts en otras semanas y el cambio de horario.
- Pruebas de la base en SQL (`begin … rollback`): los nuevos límites y la hora del episodio, y que
  las pruebas de `supabase/pruebas/` siguen pasando.
- Recorrido en `preview` en escritorio (programar con arrastre, guardar, mover lo guardado) y en el
  móvil (mover desde la ventana).

## Fase 2: Piezas y estrategias (resumen; se concreta al llegar)

- **Un solo nombre por pieza**, claro, sin códigos: «Valor + CTA», no «T2 · Valor + CTA». Desaparece
  el nombre corto de la interfaz.
- Cada pieza conserva formato (Carrusel o Reel), canales, días de preparación y hora habitual.
- **Estrategias reales: 4 con episodio y 2 sin**, cada una con nombre claro y una línea que diga
  para qué sirve. Su contenido lo define Mario; las del boceto («Calentar antes», «Golpe de salida»,
  «Goteo largo», «Mínima») son provisionales.
- Los planes ya creados guardan sus nombres antiguos (copia fija); no se reescriben.

## Fase 3: Inicio (por diseñar)

Tiene que responder, sin pensar, a las tres preguntas de la app: qué sale hoy y estos días (con
hora), qué falta por programar en Metricool y qué semana viene sin plan. Se diseña con Mario cuando
el calendario esté en `preview`.

## Lo que queda al constructor

- Cómo se hace el arrastre (sin añadir dependencias si el arrastre nativo del navegador basta).
- El reparto en componentes y cómo se reutilizan los de Semanas y los paneles actuales.
- Los textos exactos de avisos y botones, en el tono de los de ahora.
