# Horizon App — instrucciones para Claude

Herramienta interna de Horizon Sport para planificar el contenido de redes alrededor de cada
episodio. Dominio previsto: `app.horizonsport.co`. Solo español.

Repo **público** (https://github.com/RodzCantCode/horizon-app), a propósito: el plan gratuito de
Vercel pone trabas con repos privados (decidido el 14-oct-2026). Por eso aquí no entran claves,
contraseñas ni datos reales de planes o personas: los datos viven en Supabase y las claves en
variables de entorno.

La web pública es otro proyecto (`horizon-web`, repo público). **Nada de este repo se copia allí.**

## Proyecto hermano: horizon-web

- Repo: https://github.com/RodzCantCode/horizon-web (público). Carpeta local junto a esta:
  `../horizon-web` (en el Mac de Mario, las dos dentro de una carpeta `HorizonSport` sin repo).
- **Al empezar una sesión, lee `../horizon-web/docs/ESTADO.md`** y avisa de cualquier cambio de la
  web que afecte a la app (diseño, dominios, Vercel, contenido del podcast) aunque no se haya pedido.
  Si la carpeta no está, léelo en GitHub y dilo.
- De allí se toma el sistema visual ([docs/DISENO.md](https://github.com/RodzCantCode/horizon-web/blob/main/docs/DISENO.md))
  y el contexto general del podcast (`CLAUDE.md` y `docs/ESTADO.md`). Se lee, no se duplica aquí.
- La conexión va en un solo sentido: la app lee la web; la web no sabe nada de la app. Lo que se
  cambie en la web sigue sus propias reglas (repo público, push a `main` = producción).

## Con quién trabajas

Mario, técnico y responsable audiovisual, con sus socios Izan y Lluís. Se le responde en español.
Los tres usan la app.

## Qué resuelve

Hoy el calendario de contenido vive en la cabeza de cada uno. La app tiene que permitir que
cualquiera de los tres responda en menos de 30 segundos, sin preguntar a nadie:

1. Qué se publica esta semana y qué día.
2. Quién lo prepara.
3. En qué estado está (por hacer, en diseño, listo, programado en Metricool).

**Metricool manda.** La app planifica qué y cómo se publica; la programación real y las horas viven
en Metricool. La app no publica en redes.

## Modelo

| Entidad | Qué es |
| --- | --- |
| Pieza | Tipo de contenido (T0–T4, clip principal, clip secundario, teaser, clip de archivo): formato (Slide o Reel), si necesita episodio, días permitidos respecto al episodio, días de preparación y canales |
| Estrategia | Combinación de piezas en días concretos (D-1 a D+5), para semana con o sin episodio |
| Plan | Episodio (o semana sin episodio) + estrategia elegida. Al generarse guarda una **copia fija** de las piezas con su fecha real, responsable y estado |

Reglas que no se negocian:

- Editar una estrategia o una pieza **no cambia** los planes ya generados.
- Las piezas se **archivan**, no se borran. Una estrategia que usa una pieza archivada deja de ofrecerse.
- Al mover la fecha de un plan, las piezas que ya estaban en Metricool se marcan para revisar.
- Solo fechas, sin horas (el cambio de hora no debe mover nada; las horas están en Metricool).
- El día de referencia (D) es el día de publicación del episodio; hoy suele ser viernes, pero no se
  da por hecho en el código.

## Estado

9-oct-2026: `index.html` es el **prototipo** (HTML estático, datos en `localStorage` del navegador de
cada uno). Sirve para validar el flujo con 2–3 episodios reales. Todavía no es compartido.

14-oct-2026: creados el repo de GitHub y el proyecto de Supabase («Horizon Sport - App», organización
«Horizon Sport», plan gratuito, Europa). Supabase pausa los proyectos gratuitos tras una semana sin
uso: se reactivan desde el panel sin perder datos.

Siguiente paso previsto: datos compartidos y login con **Supabase** (Auth con los 3 usuarios creados
a mano, registro público desactivado y RLS en todas las tablas). No se programa un login propio.

## Diseño

Mismo sistema visual que la web (ver `docs/DISENO.md` en `horizon-web`, enlazado arriba): fondo tinta, una sola
familia (Archivo) con el contraste en la anchura, azul `#169EFF` solo en la acción principal, sin
textos de ayuda tipo tooltip. Debe funcionar bien en el móvil.

## Convenciones

- Todo en español: copy, nombres en el código y commits.
- Commits: título corto en español y cuerpo con el porqué.
