# Plan de construcción: calendario (fase 1 del rediseño)

> **Para agentes:** sub-skill obligatoria: superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas
> (`- [ ]`).

**Objetivo:** sustituir la sección Semanas por un **Calendario** de tres semanas donde se programa
un episodio eligiendo una estrategia, viéndola pegada y arrastrando cada post (y el episodio) al día
que se quiera, y donde lo ya guardado también se mueve arrastrando.

**Arquitectura:** la de siempre. Lógica pura en `lib/` (probada con Vitest, sin red), lecturas en
`lib/datos/`, cambios con acciones de servidor (`'use server'`) y las operaciones de varias filas como
funciones SQL (RPC). El modo programar vive en el navegador (estado local) hasta **Guardar**, que
manda una sola llamada. El arrastre es el nativo del navegador (HTML Drag and Drop), sin
dependencias nuevas.

**Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3, `@supabase/ssr` 0.12.7, Mochi
`v0.3.1`, Vitest.

**Diseño:** [docs/rediseno-calendario.md](rediseno-calendario.md) (fase 1), sobre
[docs/diseno.md](diseno.md). Quien ejecute lee los dos y el `CLAUDE.md` del repo.

## Restricciones globales

- Todo en español: copy, nombres en el código, comentarios y commits (título corto, cuerpo con el
  porqué, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Repo público: ningún dato real de personas ni claves en código, pruebas, migraciones o commits.
- Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`, con `lib/fechas.ts`. Nunca
  `new Date('YYYY-MM-DD')` para aritmética de días.
- Botones y campos de Mochi; azul (`variant="accent"`) solo en la acción principal de cada vista.
  Sin textos tipo tooltip (la excepción es el nombre de sección con la barra plegada).
- Toda pantalla funciona a 375 px sin desplazamiento lateral; por debajo de 768 px no se arrastra.
- Migraciones con `mcp__supabase-horizon__apply_migration`, guardadas en `supabase/migrations/`
  con la versión de `list_migrations`. La base la comparten `preview` y producción: las migraciones
  solo amplían o añaden columnas opcionales, y el código publicado tiene que seguir funcionando.
  Nada que borre en bloque. Después de migrar, regenerar `lib/supabase/tipos.ts`.
- Rama `preview`. A `main` solo con el OK de Mario.
- Verificar = ejecutar y leer: `npm test`, `npm run lint`, `npx tsc --noEmit`, pruebas SQL de
  `supabase/pruebas/` (enteras, ya van en `begin … rollback`) y el navegador para lo visual.
  `npm run build` no se lanza con el servidor de desarrollo encendido (comparten `.next`): la
  compilación la comprueba el despliegue de Vercel de `preview`.

## Foco de revisión

1. **Post llevado lejos del episodio** (D+20 o D-10, fuera incluso de -7…14): se guarda, sale en su
   semana y su desplazamiento queda como días entre D y su fecha (test en Tarea 3).
2. **Episodio arrastrado a una semana que ya tiene plan:** «Esa semana ya tiene plan» y no cambia
   nada, ni el plan ni sus posts (tests en Tareas 1 y 3).
3. **Dos personas:** otra mueve el post mientras yo lo arrastro; al soltar no se pisa su cambio, se
   avisa y se refresca (test en Tarea 3).
4. **Programar una semana que otra persona acaba de planificar:** Guardar devuelve «Esa semana ya
   tiene plan», no se crea nada y el modo programar sigue abierto con lo colocado (tests en Tareas 3
   y 6).
5. **URL de semana a mano** (`/calendario?desde=2026-13-40` o un miércoles): se ve la semana actual,
   sin error (test en Tarea 2).

---

### Tarea 1: Base de datos

**Archivos:**
- Crear: `supabase/migrations/<versión>_calendario.sql`
- Modificar: `supabase/pruebas/funciones.sql`, `lib/supabase/tipos.ts` (regenerado),
  `lib/tipos.ts`, `lib/datos/semanas.ts`, `lib/pruebas/baseSimulada.ts`

**Interfaces:**
- Produce:
  - Columna `planes.hora_episodio time` (opcional).
  - `estrategia_piezas.desplazamiento` con `check (desplazamiento between -7 and 14)` (se sustituye
    el `-1…5`; mismo nombre de restricción que tenga hoy).
  - `crear_plan(plan jsonb, piezas jsonb)` reemplazada: inserta también `hora_episodio`. Sin esa
    clave en `plan`, queda `null` (el código publicado sigue funcionando).
  - `mover_episodio(plan_id uuid, nuevo_dia_d date) returns void`, security invoker, `search_path = ''`,
    `execute` solo para `authenticated` (como las otras): con `for update`, pone `dia_d` y `lunes`
    (la semana del nuevo D, como `mover_plan`) y recalcula `plan_piezas.desplazamiento = fecha -
    nuevo_dia_d` de sus posts **sin tocar fecha, hora, estado ni revisar**. Errores `plan_no_existe`
    y `semana_con_plan` (P0001), como `mover_plan`. Mover al mismo día no cambia nada.
  - `Plan.horaEpisodio: string | null` (`HH:MM`) en `lib/tipos.ts`; `aPlan` y `aFilaPlan` la
    traducen (la columna `time` llega «19:00:00»).
  - `baseSimulada` acepta la columna nueva en `planes`.

- [ ] **Paso 1:** añadir a `supabase/pruebas/funciones.sql` las comprobaciones (una fila cada una,
  con el estilo del archivo): `crear_plan` guarda `hora_episodio`; sin la clave queda `null`;
  `estrategia_piezas` admite -7 y 14 y rechaza -8 y 15; `mover_episodio` cambia D y `lunes`, deja
  fechas, horas, estado y `revisar` de los posts y recalcula su desplazamiento; `mover_episodio` a una
  semana con plan da `semana_con_plan` sin cambiar nada; con un id que no existe da `plan_no_existe`.
- [ ] **Paso 2:** ejecutar `supabase/pruebas/funciones.sql` con `execute_sql`. Esperado: las nuevas
  fallan (la función y la columna no existen).
- [ ] **Paso 3:** escribir y aplicar la migración; guardarla con su versión.
- [ ] **Paso 4:** ejecutar `funciones.sql` y `seguridad.sql`. Esperado: todas las filas en verdadero.
  `get_advisors` (security) sin avisos nuevos.
- [ ] **Paso 5:** regenerar `lib/supabase/tipos.ts`; añadir `horaEpisodio` a `Plan`, `aPlan`,
  `aFilaPlan` y a las pruebas de `lib/datos/semanas.test.ts` (`aPlan` con «19:00:00» da «19:00»;
  `aFilaPlan` manda `hora_episodio`). `npm test` y `npx tsc --noEmit` en verde.
- [ ] **Paso 6:** commit «Base: hora del episodio, estrategias de -7 a 14 y mover solo el episodio».

### Tarea 2: Lógica del calendario

**Archivos:**
- Crear: `lib/calendario.ts`, `lib/calendario.test.ts`
- Modificar: `lib/planes.ts`, `lib/planes.test.ts`

**Interfaces:**
- Consume: `Plan.horaEpisodio` (Tarea 1).
- Produce, en `lib/planes.ts`:
  - `DESPLAZAMIENTOS_ESTRATEGIA: readonly number[]` = -7…14 (sustituye a `DESPLAZAMIENTOS`, que
    desaparece; cada uso se revisa en su tarea).
  - `desplazamientoDe(diaD: string, fecha: string): number` = `diasEntre(diaD, fecha)`, sin límite.
  - `generarPiezasDePlan(estrategia, piezas, diaD, fechas?: (string | null)[])`: `fechas[i]`, si
    viene y no es `null`, sustituye la fecha del ítem `i` de la estrategia (en el orden de
    `estrategia.items`) y su desplazamiento se recalcula con `desplazamientoDe`. Sin `fechas`, como
    ahora.
  - `diaPermitido` desaparece (los días permitidos dejan de comprobarse).
- Produce, en `lib/calendario.ts`:
  - `type TarjetaCalendario = { tipo: 'post'; pieza: PiezaDePlan; de: string } | { tipo: 'episodio'; plan: Plan }`
  - `type DiaCalendario = { fecha: string; esHoy: boolean; esPasado: boolean; tarjetas: TarjetaCalendario[] }`
  - `type SemanaCalendario = { lunes: string; plan: Plan | null; dias: DiaCalendario[] }`
  - `SEMANAS_CALENDARIO = 3`
  - `inicioCalendario(desde: string | undefined, hoy: string): string`: el lunes pedido si `desde`
    es una fecha válida y es lunes; si no, el lunes de la semana de hoy.
  - `rangoCalendario(lunes: string): { desde: string; hasta: string }` (del lunes al domingo de la
    tercera semana).
  - `construirCalendario(planes: Plan[], piezas: PiezaDePlan[], hoy: string, lunes: string): SemanaCalendario[]`:
    tres semanas; cada post en el día de su fecha, con `de` = `etiquetaDe(plan de su plan)`; el
    episodio de cada plan con episodio, en su `diaD`. Orden dentro del día por hora (sin hora al
    final, `compararFechaYHora`); el episodio entra en ese orden con su `horaEpisodio`.
  - `etiquetaDe(plan: Plan): string`: «Del 06» (con `numero`), «Del episodio» si no tiene número,
    «Sin episodio» si no tiene episodio.
  - `rangoMiniFila(estrategia: Estrategia): { desde: number; hasta: number }`: de
    `min(-2, menor desplazamiento)` a `max(12, mayor)`.

- [ ] **Paso 1:** pruebas en `lib/planes.test.ts`: `generarPiezasDePlan` con `fechas`
  (`[null, '2026-11-12']` sobre una estrategia de dos ítems con D `2026-10-30` deja el primero y pone
  el segundo el 12-nov con desplazamiento 13); `desplazamientoDe('2026-10-30', '2026-11-19')` es 20.
  Pruebas en `lib/calendario.test.ts`: `inicioCalendario('2026-13-40', '2026-10-20')` y
  `inicioCalendario('2026-10-28', …)` (miércoles) dan `'2026-10-19'`;
  `inicioCalendario('2026-10-26', …)` da `'2026-10-26'`; un post de un plan de la semana anterior
  sale en su día con `de` «Del 05»; un plan sin episodio no pone tarjeta de episodio y sus posts dicen
  «Sin episodio»; el episodio va ordenado por su hora entre los posts del día; `rangoMiniFila` de una
  estrategia con -5 y 14 da `{ desde: -5, hasta: 14 }` y de una con 0 y 3 da `{ desde: -2, hasta: 12 }`.
- [ ] **Paso 2:** `npx vitest run lib/planes.test.ts lib/calendario.test.ts`. Esperado: fallan.
- [ ] **Paso 3:** implementar lo de **Produce**. Quitar las pruebas de `diaPermitido` y ajustar las
  que usaban `DESPLAZAMIENTOS`.
- [ ] **Paso 4:** `npm test` en verde (los usos que queden de `DESPLAZAMIENTOS` en `app/` se
  arreglan en sus tareas; `npx tsc --noEmit` puede fallar ahí hasta entonces: anotarlo en el
  commit).
- [ ] **Paso 5:** commit «Lógica del calendario: semanas, tarjetas y estrategias de -7 a 14».

### Tarea 3: Acciones de servidor del calendario

**Archivos:**
- Modificar: `app/(app)/semanas/acciones.ts`, `app/(app)/semanas/acciones.test.ts`

**Interfaces:**
- Consume: Tareas 1 y 2.
- Produce:
  - `crearPlan(entrada: EntradaPlan)`: `EntradaPlan` añade `horaEpisodio?: string | null` y
    `fechas?: (string | null)[]` (una por ítem de la estrategia, en su orden; sin ellas, como ahora).
    El `lunes` se deriva de `diaD` (`lunesDe`) y sale de `EntradaPlan` (quitarlo también de la
    llamada de `PanelPlanificar.tsx`, que sigue viva hasta la Tarea 6). Cada fecha recibida tiene que ser válida
    (`esFecha`); si no, `FECHA_NO_VALIDA`. Las piezas siguen generándose en el servidor desde la
    base, ahora con `generarPiezasDePlan(…, fechas)`. Sin episodio, `horaEpisodio` se guarda `null`.
  - `editarPiezaDePlan`: sin el límite D-1…D+5; el desplazamiento es `desplazamientoDe`. El resto
    igual (comprobación de `original`, programada → pendiente y revisar).
  - `anadirPiezaSuelta`: igual, sin el límite.
  - `editarEpisodio(planId, datos)`: `DatosEpisodio` añade `hora: string | null` (vacía = sin hora;
    si no es una hora, `HORA_NO_VALIDA`).
  - `moverEpisodio(planId: string, nuevoDiaD: string): Promise<{ error?: string }>`: llama a
    `mover_episodio`, con los mismos avisos que `moverSemana` (`semana_con_plan`, `plan_no_existe`)
    y `refresh()`.
  - `moverSemana`: sin el límite de las semanas de la portada (`FUERA_DE_LA_PORTADA` desaparece):
    el calendario navega a cualquier semana.
  - `DIA_FUERA_DEL_PLAN` y `desplazamientoEnElPlan` desaparecen.

- [ ] **Paso 1:** pruebas en `acciones.test.ts` con la base simulada: `editarPiezaDePlan` a D+20 y a
  D-10 guarda con desplazamiento 20 y -10; si la fila ya no tiene el día de `original`, devuelve
  `AVISO_PIEZA_CAMBIADA` y no la cambia; `crearPlan` con `fechas` manda a `crear_plan` las piezas con
  esas fechas y `hora_episodio`, y el `lunes` del D aunque el navegador mande otro; `crearPlan` con
  una fecha no válida devuelve `FECHA_NO_VALIDA` sin llamar a la base; con `semana_con_plan` devuelve
  «Esa semana ya tiene plan»; `moverEpisodio` llama a `mover_episodio` con sus argumentos y traduce
  `semana_con_plan` y `plan_no_existe`; `editarEpisodio` guarda la hora y rechaza «25:00».
- [ ] **Paso 2:** `npx vitest run "app/(app)/semanas/acciones.test.ts"`. Esperado: fallan las nuevas.
- [ ] **Paso 3:** implementar lo de **Produce**; actualizar los comentarios de cada acción.
- [ ] **Paso 4:** el archivo de pruebas y `npm test` en verde.
- [ ] **Paso 5:** commit «Acciones: posts en cualquier día, hora del episodio y mover solo el episodio».

### Tarea 4: Estrategias de -7 a 14 y sin días permitidos

**Archivos:**
- Modificar: `app/(app)/estrategias/acciones.ts` (+ su test), `app/(app)/estrategias/PanelEstrategia.tsx`,
  `app/(app)/estrategias/PanelPiezaPlantilla.tsx`, `app/(app)/estrategias/page.tsx`,
  `app/(app)/semanas/MiniFila.tsx`, `app/(app)/semanas/minifila.module.css`, `lib/estrategias.ts`
  (+ su test)

**Interfaces:**
- Consume: `DESPLAZAMIENTOS_ESTRATEGIA`, `rangoMiniFila` (Tarea 2).
- Produce: `MiniFila({ estrategia, piezas })` con la misma firma y el aspecto del boceto: un
  cuadrado por día de `rangoMiniFila`, el de D marcado como el episodio y los que tienen posts en
  azul; el lector de pantalla sigue leyendo los días con piezas («D+3 Clip principal»).

- [ ] **Paso 1:** pruebas: guardar una estrategia con piezas en -7 y en 14 funciona y con -8 o 15
  devuelve el error de día fuera (el texto pasa a «El día tiene que estar entre D-7 y D+14»); una
  pieza en un día que antes no tenía permitido ya no da `DIA_NO_PERMITIDO`; guardar una pieza ya no
  pide días permitidos; `piezasParaAnadir` ya no filtra por días permitidos.
- [ ] **Paso 2:** ejecutar las pruebas de Estrategias. Esperado: fallan.
- [ ] **Paso 3:** acciones: quitar `DIA_NO_PERMITIDO`, `SIN_DIAS`, `DIAS_FUERA` y `DIA_EN_USO`; al
  guardar una pieza se conserva lo que hubiera en `dias_permitidos` (la columna queda sin uso).
  Interfaz: el editor de una estrategia pone las piezas por día de D-7 a D+14 (el reparto lo decide
  quien construye: que no sean 22 bloques altos; vale enseñar de D-2 a D+12 y un «Más días» que
  despliega el resto); la ficha y el formulario de la pieza dejan de enseñar los días permitidos.
- [ ] **Paso 4:** `npm test`, `npm run lint` y `npx tsc --noEmit` en verde. Comprobar en el navegador
  la sección Estrategias (ver y editar una estrategia; ver y editar una pieza) en escritorio y a
  375 px, sin guardar cambios sobre datos reales.
- [ ] **Paso 5:** commit «Estrategias: días de D-7 a D+14 y sin días permitidos».

### Tarea 5: Pantalla Calendario (ver y navegar)

**Archivos:**
- Crear: `app/(app)/calendario/page.tsx`, `app/(app)/calendario/Calendario.tsx` (cliente),
  `app/(app)/calendario/Tarjeta.tsx`, `app/(app)/calendario/calendario.module.css`
- Modificar: `app/(app)/navegacion.tsx` (Semanas → Calendario, `/calendario`), `next.config.ts`
  (redirección `/semanas` → `/calendario`), `app/(app)/semanas/PanelPieza.tsx` y
  `app/(app)/semanas/PanelSemana.tsx` (día con campo de fecha libre, `TextField type="date"`, en vez
  de la lista D-1…D+5; en la ventana de la semana, la hora del episodio junto a número, invitado y
  tema), `lib/semanas.ts` (quitar `diasDelPlan`)
- Borrar: `app/(app)/semanas/page.tsx` y lo que solo usaba esa página (comprobar con búsqueda:
  `SemanaPlegada`, `BotonVerSemana`, `resumenPlegada`…). `Semana`, `Dia` y `Paneles` siguen: los usa
  Inicio.

**Interfaces:**
- Consume: `construirCalendario`, `inicioCalendario`, `rangoCalendario` (Tarea 2); `leerSemanas`
  (sirve tal cual con el rango del calendario: trae los planes cuyo lunes cae dentro y los posts
  cuya fecha cae dentro). Para que salga la etiqueta «Del 05» de un post cuyo plan empezó antes del
  rango, leer también los planes de esos posts (ampliar `leerSemanas` o una lectura aparte, a
  elección).
- Produce: `/calendario?desde=<lunes>`. `Calendario` recibe `{ semanas: SemanaCalendario[]; hoy: string; lunes: string }`
  y pinta. Las tarjetas abren las ventanas de siempre con `?pieza=<id>` y `?semana=<lunes del plan>`
  (el episodio abre la de su semana), a través de `PanelesDeSemanas`.

- [ ] **Paso 1:** página de servidor dentro de `<Suspense>` como Inicio (sesión con
  `exigirSesion`, «hoy» después). Titular «Calendario», botones «Anterior», «Hoy» y «Siguiente»
  (`surface`, enlaces a `?desde=` ±7 días) y, como acción principal, **Programar** (azul; en la
  Tarea 6 abre el modo programar; aquí puede quedar sin acción).
- [ ] **Paso 2:** semanas, días y tarjetas con el aspecto de `calendario-v2.html`
  (`.superpowers/brainstorm/*/content/`), con los tokens y clases de la app: marca de estado (como
  `MarcaEstado`), hora en su línea, nombre, «Del 06»; episodio invertido. Por debajo de 768 px, lista
  por días (como la semana de hoy en el móvil).
- [ ] **Paso 3:** navegación lateral, redirección y paneles con fecha libre; borrar lo que queda sin
  uso.
- [ ] **Paso 4:** `npm test`, `npm run lint`, `npx tsc --noEmit`. En el navegador: `/calendario`,
  «Siguiente» y «Hoy», `/calendario?desde=2026-13-40` (semana actual, sin error), `/semanas`
  (redirige), abrir un post y su semana; a 375 px, sin desplazamiento lateral.
- [ ] **Paso 5:** commit «Calendario: tres semanas con los posts de cada episodio».

### Tarea 6: Programar un episodio

**Archivos:**
- Crear: `app/(app)/calendario/Programar.tsx` (cliente), `lib/programar.ts`, `lib/programar.test.ts`
- Modificar: `app/(app)/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx` (datos para
  programar: estrategias, piezas, planes, como `PlanificarSemana` en `semanas/Paneles.tsx`),
  `app/(app)/calendario/calendario.module.css`, `app/(app)/semanas/BotonPlanificar.tsx`,
  `app/(app)/semanas/Paneles.tsx`
- Borrar: `app/(app)/semanas/PanelPlanificar.tsx`

**Interfaces:**
- Consume: `crearPlan` (Tarea 3), `generarPiezasDePlan` y `estrategiasParaPlanificar`,
  `proponerNumero`, `proponerDiaD` (`lib/planes.ts`), `MiniFila` (Tarea 4).
- Produce, en `lib/programar.ts` (estado puro del modo programar, probado aparte):
  - `type Borrador = { conEpisodio: boolean; diaD: string; horaEpisodio: string | null; estrategiaId: string | null; fechas: (string | null)[] }`
  - `elegirEstrategia(b: Borrador, estrategiaId: string): Borrador` (fechas a `null`: las de la
    estrategia).
  - `moverPost(b: Borrador, indice: number, fecha: string): Borrador`
  - `moverEpisodioBorrador(b: Borrador, fecha: string): Borrador`: cambia solo `diaD`; los posts ya
    colocados conservan su fecha (se fijan en `fechas` las que estaban en `null`).
  - `postsDelBorrador(b, estrategia, piezas): NuevaPiezaDePlan[]` (con `generarPiezasDePlan(…, b.fechas)`).

- [ ] **Paso 1:** pruebas de `lib/programar.ts`: elegir estrategia pega sus posts alrededor de D;
  elegir otra los sustituye; mover un post cambia solo ese; mover el episodio cambia D y deja cada
  post en su fecha; un plan sin episodio usa el día de referencia como D.
- [ ] **Paso 2:** `npx vitest run lib/programar.test.ts`. Esperado: fallan.
- [ ] **Paso 3:** implementar `lib/programar.ts` hasta verde.
- [ ] **Paso 4:** `Programar.tsx`: la columna izquierda del boceto (¿Hay episodio? Sí/No; número,
  invitado, tema, día y hora del episodio, o día de referencia; estrategias del tipo con nombre,
  número de posts y `MiniFila`). Mientras está abierto, el calendario pinta los posts del borrador
  con el filete azul y se pueden arrastrar (y el episodio); **Guardar** (azul) llama a `crearPlan`;
  **Cancelar** descarta. Error de `crearPlan`: se enseña junto a Guardar y el modo sigue abierto.
  Se entra con **Programar** (la semana siguiente sin plan; D propuesto con `proponerDiaD`), pulsando
  un día vacío de una semana sin plan (D = ese día) o con `/calendario?programar=<lunes>` (D
  propuesto en esa semana). En el móvil, el panel va encima de la lista y no se arrastra.
  El **Planificar** de Inicio pasa a ser un enlace a `/calendario?programar=<lunes>`; el panel de
  planificar antiguo (`PanelPlanificar.tsx`, `PlanificarSemana` de `semanas/Paneles.tsx` y
  `?planificar=`) se borra.
- [ ] **Paso 5:** `npm test`, `npm run lint`, `npx tsc --noEmit`. En el navegador, con un plan de
  prueba en una semana lejana (y quitándolo después, con el OK de Mario, por su id): programar,
  cambiar de estrategia, arrastrar un post y el episodio, guardar y ver el plan en el calendario;
  Cancelar no deja nada.
- [ ] **Paso 6:** commit «Calendario: programar un episodio con estrategia y arrastre».

### Tarea 7: Arrastrar lo ya guardado

**Archivos:**
- Modificar: `app/(app)/calendario/Calendario.tsx`, `app/(app)/calendario/Tarjeta.tsx`,
  `app/(app)/calendario/calendario.module.css`

**Interfaces:**
- Consume: `editarPiezaDePlan` (con `original` = fecha y hora de la tarjeta al empezar a
  arrastrar) y `moverEpisodio` (Tarea 3).

- [ ] **Paso 1:** fuera del modo programar, soltar un post en otro día llama a `editarPiezaDePlan`
  con su hora de siempre; soltar el episodio, a `moverEpisodio`. Mientras se guarda, la tarjeta se ve
  ya en el día nuevo (estado optimista con `useOptimistic`) y, si hay error, vuelve y se enseña el
  aviso con el `Toast` de Mochi. Soltar en el mismo día no hace nada.
- [ ] **Paso 2:** `npm run lint`, `npx tsc --noEmit`. En el navegador, con el plan de prueba:
  arrastrar un post a otra semana (se guarda, sigue en su sitio tras recargar; si estaba programado,
  queda en ámbar «revisar»), arrastrar el episodio (los posts no se mueven) y arrastrarlo a una
  semana con plan (aviso, nada cambia).
- [ ] **Paso 3:** commit «Calendario: mover posts y episodio arrastrando».

### Tarea 8: Recorrido, documentación y cierre de la fase

**Archivos:**
- Modificar: `docs/diseno.md` (lo de la fase 1 pasa aquí: Calendario en vez de Semanas, programar,
  arrastre, fechas libres, hora del episodio, estrategias de -7 a 14, sin días permitidos),
  `docs/rediseno-calendario.md` (la fase 1 se retira y queda un enlace a `diseno.md`), `CLAUDE.md`
  (estado y mapa: `calendario/`, `lib/calendario.ts`, `lib/programar.ts`; fuera Semanas)

- [ ] **Paso 1:** recorrido completo en `preview` desplegado (escritorio y 375 px): programar,
  arrastrar, abrir ventanas, Estrategias, Inicio sin cambios. Despliegue de Vercel en «Ready».
- [ ] **Paso 2:** documentación; comprobar que ningún documento vivo presenta como pendiente lo
  hecho.
- [ ] **Paso 3:** quitar los planes de prueba creados en las Tareas 6 y 7, uno a uno por su id, con el
  OK de Mario.
- [ ] **Paso 4:** commit «Documentación: calendario (fase 1 del rediseño)».
