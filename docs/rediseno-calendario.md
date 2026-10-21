# Rediseño: calendario, piezas y estrategias, Inicio

> **Actualizado:** 2026-10-20. **Aprobado por Mario el 20-oct-2026.** Documento de trabajo del
> rediseño: cuando lo de cada fase esté construido, lo vigente pasa a [diseno.md](diseno.md) y la fase
> se retira de aquí. La fase 1 ya está retirada; quedan la 2 y la 3. Boceto que se aprobó como
> referencia visual (local, no versionado): `.superpowers/brainstorm/*/content/calendario-v2.html`.

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
- Mover un post era abrirlo, pulsar el lápiz y guardar, uno a uno, y solo dentro de D-1…D+5
  (resuelto en la fase 1).
- Los nombres confunden: códigos (T0–T4, E1–E4), nombre y nombre corto.
- Inicio enseña una fila de días y poco más: no se sabe qué hacer ni qué mirar.

Lo que Mario pidió, en sus palabras: «una vista de calendario con un par de semanas, donde al clicar
una estrategia esta se pegue, y podamos arrastrar las piezas de un día a otro. Como haríamos con un
calendario físico y un boli».

## Objetivos

Los dos primeros (programar en un calendario de varias semanas, con la estrategia pegada y todo
arrastrable, y ver juntos los posts de varios episodios) están hechos en la fase 1. Quedan:

1. Nombres claros, sin códigos ni abreviaturas (fase 2).
2. Un Inicio que diga qué toca sin tener que pensar (fase 3).

## No objetivos (por ahora)

- **Conexión con Metricool.** Llegará después; esto no debe cerrarle el paso: nada de lo nuevo debe
  impedir mandar cada post a Metricool con su fecha y hora.
- **Notas o «momentos» por post.** Lo que apuntan en la grabación son notas en sucio (minuto y frase
  o tema) que cambian; siguen en Notion. Queda por decidir si la app guarda, como mucho, un enlace a
  la página de Notion de cada episodio. Fuera de este rediseño.

## Antiobjetivos (fallaría aunque funcionara)

- Que abrume: muchos controles, textos de ayuda o datos que no se usan.
- Volver a los códigos (T2, E1) o a dos nombres por pieza.
- Que la app se convierta en un bloc de notas.
- Perder lo que se hizo de verdad: cada post guarda su fecha y hora reales, que más adelante se
  cruzarán con los resultados de Metricool.
- Romper la versión publicada mientras se construye: la base la comparten `preview` y producción (ver
  [diseno.md § Datos](diseno.md#datos)).

## Fases

1. **Calendario** (hecha): la base de datos y la pantalla de programar.
2. **Piezas y estrategias**: nombres claros y las estrategias reales (4 con episodio y 2 sin).
3. **Inicio**: se diseña con Mario ahora que la fase 1 está publicada.

Cada fase se construye en `preview` y se publica cuando Mario la da por buena.

## Fase 1: Calendario (construida el 2026-10-20)

Publicada en producción el 2026-10-20. Lo vigente (Calendario, programar, arrastre, hora del
episodio, estrategias de D-7 a D+14, datos) está en [diseno.md](diseno.md); el plan por tareas con
que se construyó, en [plan-calendario.md](plan-calendario.md).

## Fase 2: Piezas y estrategias (resumen; se concreta al llegar)

- **Un solo nombre por pieza**, claro, sin códigos: «Valor + CTA», no «T2 · Valor + CTA». Desaparece
  el nombre corto de la interfaz.
- Cada pieza conserva formato (Carrusel o Reel), canales, días de preparación y hora habitual.
- **Cada episodio da 10 reels** (dato de Mario, 21-oct-2026). No todos salen en la semana de
  publicación: varios se guardan para otros tipos de post (semanas sin episodio, recopilaciones,
  clips de archivo). Las estrategias tienen que pensarse como el reparto de esos 10 reels, no solo
  como lo que se publica alrededor del episodio.
- **Estrategias reales: 4 con episodio y 2 sin**, cada una con nombre claro y una línea que diga
  para qué sirve. Su contenido lo define Mario; las del boceto («Calentar antes», «Golpe de salida»,
  «Goteo largo», «Mínima») son provisionales.
- Los planes ya creados guardan sus nombres antiguos (copia fija); no se reescriben.

## Fase 3: Inicio (por diseñar)

Tiene que responder, sin pensar, a las tres preguntas de la app: qué sale hoy y estos días (con
hora), qué falta por programar en Metricool y qué semana viene sin plan. Se diseña con Mario cuando
el calendario esté publicado (ya lo está).
