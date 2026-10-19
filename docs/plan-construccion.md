# Plan de construcción de la app

> **Para agentes:** sub-skill obligatoria: superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas
> (`- [ ]`).

**Objetivo:** construir la app descrita en [diseno.md](diseno.md) sobre el esqueleto de Next.js ya
montado: semanas, planificar, paneles con modo edición, Estrategias y Ajustes, con datos
compartidos en Supabase.

**Arquitectura:** la lógica de fechas y planes vive en funciones puras (`lib/`), probadas con Vitest
y sin red. La base de datos (Supabase) guarda los datos, aplica la seguridad (RLS) y escribe el
registro con disparadores; las operaciones de varias filas son funciones SQL (RPC) para que sean
atómicas. Las pantallas son componentes de servidor que leen con `lib/datos/` y cambian datos con
acciones de servidor (`'use server'`).

**Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3, `@supabase/ssr` 0.12.7,
`@supabase/supabase-js` 2.117.3, Mochi `v0.3.1`, Vitest (nuevo, solo desarrollo).

**Diseño:** [docs/diseno.md](diseno.md). Quien ejecute lee los dos.

## Restricciones globales

- Todo en español: copy, nombres en el código (funciones, tipos, tablas, columnas), comentarios y
  commits. Commits: título corto y cuerpo con el porqué, terminados con
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Repo público: ninguna clave, contraseña, correo ni dato real de planes o personas en el código, los
  tests, las migraciones o los commits.
- Fechas como texto ISO `YYYY-MM-DD` y horas como `HH:MM` de reloj en `Europe/Madrid`. Nunca
  `new Date('YYYY-MM-DD')` para aritmética de días (interpreta UTC); nunca guardar instantes UTC.
- Botones y campos: componentes de Mochi. Azul (`variant="accent"`) solo en la acción principal de
  cada vista; el resto `variant="surface"`. Sin textos tipo tooltip ni antetítulos.
- Toda pantalla funciona a 375 px de ancho sin desplazamiento lateral; el panel lateral pasa a hoja
  inferior por debajo de 768 px.
- Migraciones: cada una se aplica con `mcp__supabase-horizon__apply_migration` y se guarda en
  `supabase/migrations/` como `<versión>_<nombre>.sql`, con la versión que devuelve `list_migrations`
  tras aplicarla. Nunca las conexiones generales de Supabase (skill
  `supabase-connections`).
- Rama de trabajo `app-v1` (push = despliegue de prueba en Vercel). A `main` solo con el OK de Mario:
  publica la app en producción.
- Verificar = ejecutar y leer la salida: `npm test`, `npm run lint`, `npm run build`, y el
  navegador integrado para lo visual.

## Foco de revisión

1. **Pieza que cruza de semana:** el D+4 de un plan del viernes cae en la semana siguiente y debe
   salir allí, aunque esa semana no tenga plan (test en Tarea 6).
2. **Doble pulsación o dos personas planificando la misma semana:** la segunda vez no crea otro plan
   ni falla en blanco; devuelve «Esa semana ya tiene plan» (test en Tarea 9).
3. **«Hoy» de madrugada:** a las 00:30 en España, «hoy» y «va justa» usan el día de España, no el de
   UTC (test en Tarea 1).
4. **Pieza archivada en uso:** las estrategias que la usan no se ofrecen al planificar, pero los
   planes que ya la tienen siguen viéndose y editándose (tests en Tareas 2 y 3).
5. **Panel desfasado:** marcar o editar una pieza que otra persona acaba de quitar devuelve «Esa pieza
   ya no está en el plan» y refresca, sin romper la página (test en Tarea 7).

---

### Tarea 0: Lo que hace Mario a mano (sin código)

- [x] Vercel, proyecto `horizon-app`: variables `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en Production y Preview; Framework Preset = Next.js; Node
  22.x. (Hecho de verdad el 2026-10-19: hasta entonces el preset era «Other» y no había variables.
  Ver [acceso.md § Operación](acceso.md#operación-publicación-y-correo).)
- [x] Supabase: desactivar «Allow new users to sign up». Los usuarios llegan por invitación tras la
  Tarea 5 (ver `docs/acceso.md`).
- [x] Con eso hecho, Claude crea la rama `app-v1` desde `main`, hace commit del esqueleto, el diseño
  y este plan, y la sube. Comprobar en la vista previa de Vercel que se puede entrar y salir con un
  usuario real. Hecho salvo esto último: no se crean usuarios a mano, llegan por invitación, y la
  comprobación con un usuario real pasa a la Tarea 12 (paso 4).

### Tarea 1: Fechas en hora de España

**Archivos:**
- Crear: `lib/fechas.ts`, `lib/fechas.test.ts`, `vitest.config.mts`
- Modificar: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produce:
  - `lunesDe(fecha: string): string`
  - `sumarDias(fecha: string, dias: number): string`
  - `diasEntre(desde: string, hasta: string): number`
  - `hoyEnMadrid(ahora?: Date): string`
  - `existeEnMadrid(fecha: string, hora: string): boolean`
  - `diaSemana(fecha: string): number` (0 = lunes … 6 = domingo)

- [x] **Paso 1: tests que fallan**

```ts
expect(lunesDe('2026-10-16')).toBe('2026-10-12');
expect(lunesDe('2026-10-12')).toBe('2026-10-12');
expect(lunesDe('2026-10-18')).toBe('2026-10-12');
expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02');
expect(sumarDias('2026-10-24', 2)).toBe('2026-10-26'); // cruza el cambio de hora
expect(sumarDias('2026-10-16', -1)).toBe('2026-10-15');
expect(diasEntre('2026-10-12', '2026-10-19')).toBe(7);
expect(hoyEnMadrid(new Date('2026-10-15T22:30:00Z'))).toBe('2026-10-16'); // 00:30 en España
expect(hoyEnMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'); // 00:30 en invierno
expect(existeEnMadrid('2026-03-29', '02:30')).toBe(false); // no existe: salto de marzo
expect(existeEnMadrid('2026-03-29', '03:00')).toBe(true);
expect(existeEnMadrid('2026-10-25', '02:30')).toBe(true);  // se repite, pero existe
expect(existeEnMadrid('2026-10-16', '18:00')).toBe(true);
expect(diaSemana('2026-10-16')).toBe(4);
```

- [x] **Paso 2:** `npm test -- lib/fechas` → falla porque `lib/fechas.ts` no existe.
- [x] **Paso 3:** implementar. Aritmética de días en UTC puro sobre `Date.UTC(año, mes, día)`;
  `hoyEnMadrid` y `existeEnMadrid` con `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })`.
  `existeEnMadrid`: probar los dos desfases posibles (+1 h y +2 h) y comprobar si alguno, al volver a
  formatear en Madrid, da la misma fecha y hora. Sin dependencias nuevas aparte de Vitest.
- [x] **Paso 4:** `npm test -- lib/fechas` → pasa. `npm run lint` → sin errores.
- [x] **Paso 5:** commit «Fechas y horas en hora de España».

### Tarea 2: Lógica de planes

**Archivos:**
- Crear: `lib/planes.ts`, `lib/planes.test.ts`, `lib/tipos.ts`

**Interfaces:**
- Consume: `sumarDias`, `diaSemana`, `lunesDe` (Tarea 1).
- Produce, en `lib/tipos.ts`:
  - `Formato = 'slide' | 'reel'`, `Canal = 'ig' | 'tiktok' | 'shorts'`
  - `Estado = 'pendiente' | 'programada'`
  - `Pieza { id, nombre, nombreCorto, formato, canales: Canal[], diasPermitidos: number[], diasPreparacion: number, horaHabitual: string | null, archivada: boolean }`
  - `Estrategia { id, nombre, conEpisodio: boolean, items: { piezaId: string; desplazamiento: number }[] }`
  - `PiezaDePlan { id, planId, piezaId: string | null, nombre, nombreCorto, formato, canales, diasPreparacion, desplazamiento, fecha, hora: string | null, estado: Estado, revisar: boolean }`
  - `NuevaPiezaDePlan = Omit<PiezaDePlan, 'id' | 'planId'>`
  - `Plan { id, lunes, diaD, conEpisodio, numero: string | null, invitado: string | null, tema: string | null, estrategiaId: string | null, estrategiaNombre: string }`
- Produce, en `lib/planes.ts`:
  - `generarPiezasDePlan(estrategia: Estrategia, piezas: Pieza[], diaD: string): NuevaPiezaDePlan[]`
  - `vaJusta(p: Pick<PiezaDePlan, 'estado' | 'fecha' | 'diasPreparacion'>, hoy: string): boolean`
  - `necesitaAtencion(p: PiezaDePlan, hoy: string): boolean` (va justa o `revisar`)
  - `estrategiaDisponible(e: Estrategia, piezas: Pieza[]): boolean`
  - `estrategiasParaPlanificar(es: Estrategia[], piezas: Pieza[], conEpisodio: boolean): Estrategia[]`
  - `moverPiezaDePlan(p: PiezaDePlan, fecha: string, hora: string | null): PiezaDePlan`
  - `diaPermitido(pieza: Pieza, desplazamiento: number): boolean`
  - `proponerNumero(planes: Plan[]): string | null`
  - `proponerDiaD(planes: Plan[], lunes: string): string`

- [x] **Paso 1: tests que fallan** (datos de prueba: las piezas y E1 del prototipo, con
  `horaHabitual: '18:00'` en el clip principal)

```ts
// E1 con D = viernes 2026-10-16: T4 en D-1, clip principal en D, secundario en D+2, T2 en D+4…
const g = generarPiezasDePlan(e1, piezas, '2026-10-16');
expect(g.map((p) => [p.nombreCorto, p.fecha, p.hora])).toEqual([
  ['Historia del invitado', '2026-10-15', null],
  ['Clip principal', '2026-10-16', '18:00'],
  ['Clip secundario', '2026-10-18', null],
  ['Valor + CTA', '2026-10-20', null],
  ['Clip secundario', '2026-10-21', null],
]);
expect(g.every((p) => p.estado === 'pendiente' && !p.revisar)).toBe(true);
// copia fija: cambiar la pieza después no cambia lo generado
piezas[0].nombre = 'Otro'; expect(g[0].nombre).not.toBe('Otro');

expect(vaJusta({ estado: 'pendiente', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-14')).toBe(true);
expect(vaJusta({ estado: 'pendiente', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-13')).toBe(false);
expect(vaJusta({ estado: 'programada', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-16')).toBe(false);

const movida = moverPiezaDePlan({ ...programada, fecha: '2026-10-16', hora: '18:00' }, '2026-10-17', '18:00');
expect([movida.estado, movida.revisar]).toEqual(['pendiente', true]);
const igual = moverPiezaDePlan({ ...programada, fecha: '2026-10-16', hora: '18:00' }, '2026-10-16', '18:00');
expect([igual.estado, igual.revisar]).toEqual(['programada', false]);
const pendienteMovida = moverPiezaDePlan({ ...pendiente }, '2026-10-17', null);
expect(pendienteMovida.revisar).toBe(false);

// archivada: E1 deja de ofrecerse si una de sus piezas está archivada
expect(estrategiasParaPlanificar([e1, e2], conT4Archivada, true).map((e) => e.id)).toEqual(['e2']);
expect(estrategiasParaPlanificar([e1, e3], piezas, false).map((e) => e.id)).toEqual(['e3']);

expect(diaPermitido(t4, -1)).toBe(true);
expect(diaPermitido(t4, 2)).toBe(false);
expect(proponerNumero([{ ...plan, numero: '05' }, { ...plan, numero: '04' }])).toBe('06');
expect(proponerNumero([])).toBe(null);
expect(proponerDiaD([{ ...plan, conEpisodio: true, diaD: '2026-10-16' }], '2026-10-19')).toBe('2026-10-23');
expect(proponerDiaD([], '2026-10-19')).toBe('2026-10-23'); // sin historial: viernes
```

- [x] **Paso 2:** `npm test -- lib/planes` → falla.
- [x] **Paso 3:** implementar. `generarPiezasDePlan` ordena por fecha y hora (las vacías al final del
  día). `proponerNumero` toma el mayor numérico de los planes con episodio y suma 1, conservando dos
  cifras. `proponerDiaD` usa el día de la semana del último plan con episodio; si no hay, viernes.
- [x] **Paso 4:** `npm test` → pasa. `npm run lint` → sin errores.
- [x] **Paso 5:** commit «Lógica de planes: generar, va justa, mover y propuestas».

### Tarea 3: Esquema de la base de datos, seguridad y registro

**Archivos:**
- Crear: `supabase/migrations/20261018090121_esquema_inicial.sql`,
  `supabase/pruebas/seguridad.sql`, `lib/supabase/tipos.ts` (generado)

**Interfaces:**
- Produce las tablas de [diseno.md § Datos](diseno.md#datos), en `snake_case`:
  - `perfiles(id uuid pk → auth.users on delete cascade, nombre text not null)`
  - `piezas(id uuid pk, nombre, nombre_corto, formato text check in ('slide','reel'), canales text[], dias_permitidos int[], dias_preparacion int check >= 0, hora_habitual time null, archivada bool default false)`
  - `estrategias(id, nombre, con_episodio bool)`
  - `estrategia_piezas(id, estrategia_id → cascade, pieza_id → restrict, desplazamiento int check between -1 and 5)`
  - `planes(id, lunes date unique check extract(isodow) = 1, dia_d date check between lunes and lunes + 6, con_episodio, numero, invitado, tema, estrategia_id → on delete set null, estrategia_nombre text not null)`
  - `plan_piezas(id, plan_id → cascade, pieza_id → on delete set null, nombre, nombre_corto, formato, canales, dias_preparacion, desplazamiento, fecha date, hora time null, estado text check in ('pendiente','programada') default 'pendiente', revisar bool default false)`
  - `registro(id, usuario_id uuid default auth.uid(), accion text, tabla text, fila_id uuid, detalle jsonb, creado_en timestamptz default now())`
- Produce: `lib/supabase/tipos.ts` con `mcp__supabase-horizon__generate_typescript_types`; los
  clientes de `lib/supabase/` pasan a usar `Database`.

- [x] **Paso 1: prueba de seguridad que falla** en `supabase/pruebas/seguridad.sql` (se ejecuta con
  `execute_sql`, todo dentro de una transacción que acaba en `rollback`):
  - como `anon`: `select count(*) from planes` → error de permisos.
  - como `authenticated` con `request.jwt.claims` de un usuario de prueba creado dentro de la
    transacción: insertar una pieza funciona y deja en `registro` una fila con ese `usuario_id`,
    `accion = 'crear'`, `tabla = 'piezas'`.
  - como `authenticated`: `insert into registro …` directo → error.
  - borrar una pieza usada por una estrategia → error (`restrict`); archivarla → funciona.
- [x] **Paso 2:** ejecutarla antes de la migración → falla (las tablas no existen).
- [x] **Paso 3:** escribir la migración:
  - RLS activado en todas las tablas.
  - `grant select, insert, update, delete` a `authenticated` en todas salvo `registro` (solo
    `select`); nada a `anon` (el proyecto se creó sin exponer tablas solas).
  - Políticas `to authenticated using (true) with check (true)`.
  - Disparador `registrar_cambio()` (`security definer`, `set search_path = ''`) en `piezas`,
    `estrategias`, `estrategia_piezas`, `planes` y `plan_piezas`, con
    `accion ∈ {'crear','editar','borrar'}`. En `plan_piezas`, si cambia `estado`:
    `'programar'` / `'volver_a_pendiente'`; si cambian `fecha` u `hora`: `'mover'`.
  - Disparador sobre `auth.users` que crea el perfil con `nombre` = parte del correo antes de la
    `@` (editable luego). Relleno de los usuarios que ya existan.
  - Aplicarla con `apply_migration`.
- [x] **Paso 4:** volver a ejecutar la prueba → pasa. `get_advisors` (security) → sin avisos de
  nivel ERROR. Generar `lib/supabase/tipos.ts`. `npm run build` → compila.
- [x] **Paso 5:** commit «Esquema inicial con RLS y registro automático».

### Tarea 4: Datos iniciales

**Archivos:**
- Crear: `supabase/migrations/20261018091032_ajustes_esquema.sql` (ajustes de la revisión de la
  Tarea 3), `supabase/migrations/20261018091225_datos_iniciales.sql`

- [x] **Paso 1:** consulta de comprobación que falla: `select count(*) from piezas` = 9 y
  `from estrategias` = 4.
- [x] **Paso 2:** migración con las piezas y estrategias de `prototipo/index.html` (función
  `semilla`): nombres, formatos, canales, días permitidos, días de preparación y los ítems de E1–E4.
  `nombre_corto` = el texto tras «· » del nombre del prototipo («T4 · Historia del invitado» →
  «Historia del invitado»), o el nombre entero si no lleva prefijo. `hora_habitual` vacía en todas
  (Mario la rellena; no se inventa). Sin planes de ejemplo.
- [x] **Paso 3:** aplicar y repetir la consulta → 9 y 4. Comprobar que E1 tiene 5 ítems.
- [x] **Paso 4:** commit «Piezas y estrategias del prototipo como datos iniciales».

### Tarea 5: Tema, cabecera, Ajustes y acceso por invitación

**Archivos:**
- Modificar: `app/global.css` (tokens del tema claro y variables de Mochi para cada tema),
  `app/layout.tsx` (script previo al pintado que pone `data-tema`), `lib/supabase/sesion.ts` (usa
  `destinoSegunSesion`)
- Crear: `app/(app)/layout.tsx` con la cabecera (logo, **Semanas** `/`, **Estrategias**
  `/estrategias`, icono de cuenta → `/ajustes`); `app/(app)/ajustes/page.tsx` con `SelectorTema`,
  **Cambiar contraseña** y **Salir**; `lib/tema.ts`; `lib/supabase/rutas.ts`;
  `app/auth/confirmar/route.ts`; `app/crear-contrasena/` (página y formulario);
  `lib/contrasena.ts`; `docs/acceso.md`
- Mover: `app/page.tsx`, `app/acciones.ts` e `app/inicio.module.css` → `app/(app)/` (la portada
  sigue provisional hasta la Tarea 6)

**Interfaces:**
- Produce: `type Tema = 'claro' | 'oscuro' | 'sistema'`, `leerTema(): Tema`,
  `guardarTema(t: Tema): void` (en `localStorage`, clave `tema`). Sin atributo = sistema, resuelto
  por `@media (prefers-color-scheme)`.
- Produce: `destinoSegunSesion(ruta: string, conSesion: boolean): string | null` (adónde redirigir,
  o `null` si se queda). `/auth/confirmar` no exige sesión; `/crear-contrasena` sí.
- Produce: `validarContrasena(nueva: string, repetida: string): string | null` (mensaje de error o
  `null`); mínimo 8 caracteres.
- `app/auth/confirmar/route.ts`: lee `token_hash` y `type` de la URL; solo acepta `invite` y
  `recovery`; llama a `supabase.auth.verifyOtp({ type, token_hash })`; si va bien, redirige a
  `/crear-contrasena`; si no, a `/entrar?error=enlace`, donde se muestra «El enlace no es válido o
  ha caducado. Pide otro a Mario.»
- `/crear-contrasena` y **Cambiar contraseña** usan `supabase.auth.updateUser({ password })`.

- [x] **Paso 1: tests que fallan**

```ts
expect(leerTema()).toBe('sistema');                 // sin valor
localStorage.setItem('tema', 'rosa'); expect(leerTema()).toBe('sistema');
guardarTema('claro'); expect(leerTema()).toBe('claro');

expect(destinoSegunSesion('/', false)).toBe('/entrar');
expect(destinoSegunSesion('/estrategias', false)).toBe('/entrar');
expect(destinoSegunSesion('/auth/confirmar', false)).toBe(null);
expect(destinoSegunSesion('/crear-contrasena', false)).toBe('/entrar');
expect(destinoSegunSesion('/crear-contrasena', true)).toBe(null);
expect(destinoSegunSesion('/entrar', true)).toBe('/');
expect(destinoSegunSesion('/entrar', false)).toBe(null);

expect(validarContrasena('corta', 'corta')).toBe('Tiene que tener al menos 8 caracteres.');
expect(validarContrasena('suficiente1', 'suficiente2')).toBe('Las dos contraseñas no coinciden.');
expect(validarContrasena('suficiente1', 'suficiente1')).toBe(null);
```

- [x] **Paso 2:** `npm test` → fallan.
- [x] **Paso 3:** implementar. Tema claro con la lógica de la maqueta (fondo `#f4f6f8`, superficies
  blancas, texto `#0a0e13`, ámbar `#8f5200`) y contraste 4.5:1 en texto pequeño. El script del
  layout va en línea y antes del cuerpo para que no haya destello del tema equivocado. El proxy
  pasa a usar `destinoSegunSesion`. `docs/acceso.md` (runbook, formato de docdocs): cómo invitar,
  cómo mandar una recuperación, y lo que Mario configura en Supabase: plantillas «Invite user» y
  «Reset password» con el enlace
  `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite` (y `type=recovery`), Site
  URL y direcciones permitidas (localhost, vista previa de Vercel y producción). Textos de los
  correos en español.
- [x] **Paso 4:** `npm test`, `npm run lint`, `npm run build`. En el navegador integrado (sin
  sesión): `/entrar`, `/entrar?error=enlace` y que `/ajustes` sin sesión manda a `/entrar`. La
  comprobación con sesión (tema que se mantiene al recargar, «Sistema» con claro y oscuro emulados,
  sección activa de la cabecera, cambiar contraseña, 375 px) la hace el controlador cuando Mario
  haya entrado.
- [x] **Paso 5:** commit «Temas, cabecera, Ajustes y acceso por invitación».

### Tarea 6: Pantalla Semanas (lectura)

**Archivos:**
- Crear: `lib/semanas.ts`, `lib/semanas.test.ts`, `lib/datos/semanas.ts`,
  `app/(app)/semanas/` (componentes `Semana.tsx`, `SemanaPlegada.tsx`, `Dia.tsx`,
  `MarcaEstado.tsx` y su CSS)
- Modificar: `app/(app)/page.tsx` (la pantalla principal)

**Interfaces:**
- Consume: `hoyEnMadrid`, `lunesDe`, `sumarDias` (T1); `necesitaAtencion` (T2); tipos (T2).
- Produce:
  - `construirSemanas(planes: Plan[], piezas: PiezaDePlan[], hoy: string, cuantasAtras = 1, cuantasDelante = 2): VistaSemana[]`
  - `VistaSemana { lunes, plan: Plan | null, dias: { fecha, esHoy, piezas: PiezaDePlan[] }[], posicion: 'pasada' | 'actual' | 'siguiente' | 'lejana', avisoSinPlan: boolean }`
  - `leerSemanas(desde: string, hasta: string): Promise<{ planes: Plan[]; piezas: PiezaDePlan[] }>` (servidor)

- [x] **Paso 1: tests que fallan**

```ts
const v = construirSemanas([planEp05 /* lunes 2026-10-12, D 2026-10-16 */], piezasEp05, '2026-10-15');
expect(v.map((s) => [s.lunes, s.posicion])).toEqual([
  ['2026-10-05', 'pasada'], ['2026-10-12', 'actual'], ['2026-10-19', 'siguiente'], ['2026-10-26', 'lejana'],
]);
const siguiente = v[2];
expect(siguiente.plan).toBe(null);
expect(siguiente.avisoSinPlan).toBe(true);
expect(siguiente.dias[1].piezas.map((p) => p.nombreCorto)).toEqual(['Valor + CTA']); // D+4 cruza
expect(v[3].avisoSinPlan).toBe(false); // solo se avisa de la siguiente
expect(v[1].dias[3].esHoy).toBe(true);
expect(v[1].dias[4].piezas.map((p) => p.hora)).toEqual(['18:00']);
```

- [x] **Paso 2:** `npm test -- lib/semanas` → falla.
- [x] **Paso 3:** implementar `construirSemanas` (orden de las piezas del día por hora, las vacías al
  final), `leerSemanas` y la pantalla según la maqueta y [diseno.md § Semanas](diseno.md#semanas-la-principal).
  La parte que lee datos va dentro de `<Suspense>` (Cache Components). Sin datos: semana actual vacía
  y siguiente con «Sin planificar».
- [x] **Paso 4:** `npm test`, `npm run build`. En el navegador, con un plan creado a mano por SQL en
  una transacción de prueba (o tras la Tarea 9): escritorio y 375 px; tema claro y oscuro.
- [x] **Paso 5:** commit «Pantalla Semanas».

### Tarea 7: Panel de pieza y estado

**Archivos:**
- Crear: `app/(app)/componentes/Panel.tsx` (lateral ≥ 768 px, hoja inferior < 768 px; cierre con
  Escape y botón), `app/(app)/semanas/PanelPieza.tsx`, `app/(app)/semanas/acciones.ts`,
  `lib/datos/registro.ts`

**Interfaces:**
- Produce:
  - `marcarEstado(planPiezaId: string, estado: Estado): Promise<{ error?: string }>` (acción de servidor; al marcar programada pone `revisar = false`)
  - `leerRegistroDe(filaId: string): Promise<{ nombre: string; accion: string; creadoEn: string }[]>`
  - `Panel` con props `{ abierto: boolean; alCerrar: () => void; titulo: string; children }`
- La pieza abierta va en la URL (`?pieza=<id>`) para que el panel sobreviva a una recarga.

- [x] **Paso 1:** test de `marcarEstado` contra Supabase con un cliente simulado: id inexistente →
  `{ error: 'Esa pieza ya no está en el plan' }`; programar una con `revisar = true` la deja con
  `revisar = false`.
- [x] **Paso 2:** implementar el panel (vista normal; el lápiz aún no hace nada), el botón principal
  y el registro de la pieza con frases como «Izan la marcó como programada · 14 oct».
- [x] **Paso 3:** `npm test`, `npm run build`. En el navegador: marcar y desmarcar, ver el registro
  con el nombre propio, recargar con el panel abierto, móvil con hoja inferior.
  *(Comprobado con datos inventados y sin sesión; la comprobación con sesión va en la Tarea 12.)*
- [x] **Paso 4:** commit «Panel de pieza: estado y registro».

### Tarea 8: Funciones SQL de varias filas

**Archivos:**
- Crear: `supabase/migrations/20261018104845_funciones_planes.sql`, `supabase/pruebas/funciones.sql`

**Interfaces:**
- Produce, todas `security invoker` (respetan RLS) y atómicas:
  - `crear_plan(plan jsonb, piezas jsonb) returns uuid`: error `'semana_con_plan'` si ya hay plan ese lunes.
  - `mover_plan(plan_id uuid, nuevo_dia_d date) returns void`: desplaza D y todas sus piezas los mismos días; las programadas pasan a pendiente con `revisar = true`; si el nuevo D cae en otra semana, actualiza `lunes` (y error `'semana_con_plan'` si esa ya tiene plan).
  - `cambiar_estrategia(plan_id uuid, estrategia_id uuid, estrategia_nombre text, piezas jsonb) returns void`: sustituye todas las piezas del plan.

- [x] **Paso 1:** pruebas SQL que fallan: crear dos veces el mismo lunes → la segunda da
  `semana_con_plan` y no deja filas; mover un plan con una pieza programada → esa queda `pendiente`
  con `revisar = true` y la fecha corrida; cambiar de estrategia → las piezas viejas desaparecen; el
  registro anota cada cambio.
- [x] **Paso 2:** migración, aplicarla, repetir las pruebas → pasan. Regenerar `lib/supabase/tipos.ts`.
- [x] **Paso 3:** commit «Funciones para crear, mover y cambiar de estrategia un plan».

### Tarea 9: Planificar

**Archivos:**
- Crear: `app/(app)/semanas/PanelPlanificar.tsx`, `app/(app)/semanas/MiniFila.tsx` (mini fila de
  días de una estrategia, reutilizada en Estrategias), acción `crearPlan` en
  `app/(app)/semanas/acciones.ts`, `lib/datos/estrategias.ts`

**Interfaces:**
- Consume: `generarPiezasDePlan`, `estrategiasParaPlanificar`, `proponerNumero`, `proponerDiaD`
  (T2); `crear_plan` (T8); `existeEnMadrid` (T1).
- Produce:
  - `crearPlan(entrada: { lunes: string; conEpisodio: boolean; diaD: string; numero: string | null; invitado: string | null; tema: string | null; estrategiaId: string }): Promise<{ error?: string }>`
  - `leerEstrategiasYPiezas(): Promise<{ estrategias: Estrategia[]; piezas: Pieza[] }>`

- [x] **Paso 1:** test de `crearPlan` con cliente simulado: si la RPC devuelve `semana_con_plan` →
  `{ error: 'Esa semana ya tiene plan' }`; `diaD` fuera de la semana → `{ error: 'El día de publicación tiene que caer en esa semana' }`.
- [x] **Paso 2:** implementar el panel según [diseno.md § Planificar](diseno.md#planificar): Sí/No,
  datos con las propuestas, estrategias filtradas con su mini fila, vista previa con fechas y horas
  (aviso si alguna hora no existe en España) y **Crear plan**. El botón se desactiva mientras envía.
- [x] **Paso 3:** `npm test`, `npm run build`. En el navegador: planificar la semana siguiente con y
  sin episodio; doble clic en **Crear plan** no duplica; la semana aparece llena y el aviso
  desaparece.
  *(Comprobado con datos inventados y sin sesión; la comprobación con sesión va en la Tarea 12.)*
- [x] **Paso 4:** commit «Planificar una semana».

### Tarea 10: Modo edición de pieza y de semana

**Archivos:**
- Crear: `app/(app)/semanas/PanelSemana.tsx`; acciones `editarPiezaDePlan`, `quitarPiezaDePlan`,
  `editarEpisodio`, `anadirPiezaSuelta`, `moverSemana`, `cambiarEstrategiaDePlan` en
  `app/(app)/semanas/acciones.ts`
- Modificar: `app/(app)/semanas/PanelPieza.tsx` (lápiz → modo edición)

**Interfaces:**
- Consume: `moverPiezaDePlan`, `diaPermitido`, `generarPiezasDePlan` (T2); `mover_plan`,
  `cambiar_estrategia` (T8).
- Produce: cada acción devuelve `Promise<{ error?: string }>`.
  `editarPiezaDePlan(id, fecha, hora, original: { fecha, hora })` aplica `moverPiezaDePlan` antes de
  guardar; `original` es lo que enseñaba el panel y, si la pieza ya no está ahí, no guarda.
  `quitarPiezaDePlan(id)` borra la fila. `anadirPiezaSuelta(planId, piezaId, fecha, hora,
  diaDEsperado)` copia los datos de la pieza; si el día D del plan ya no es `diaDEsperado`, no la
  añade.

- [x] **Paso 1:** tests de las acciones con cliente simulado: editar la fecha de una programada
  guarda `estado = 'pendiente'` y `revisar = true`; quitar una que ya no existe → `'Esa pieza ya no
  está en el plan'`; `cambiarEstrategiaDePlan` con piezas programadas exige
  `confirmado: true` (sin él → `{ error: 'confirmar' }`).
- [x] **Paso 2:** implementar según [diseno.md § Paneles de detalle](diseno.md#paneles-de-detalle):
  lápiz → campos → **Guardar** / **Cancelar**; quitar y cambiar de estrategia piden confirmación.
  Al cambiar una hora, el mismo aviso que al planificar si no existe en España (`existeEnMadrid`).
- [x] **Paso 3:** `npm test`, `npm run build`. En el navegador: cada edición, la marca ámbar de
  «revisar en Metricool» y que desaparece al volver a marcar programada.
  *(Comprobado con datos inventados y sin sesión; la comprobación con sesión va en la Tarea 12.)*
- [x] **Paso 4:** commit «Modo edición de piezas y semanas».

### Tarea 11: Estrategias y Piezas

**Archivos:**
- Crear: `app/(app)/estrategias/page.tsx`, `PanelEstrategia.tsx`, `PanelPiezaPlantilla.tsx`,
  `acciones.ts`

**Interfaces:**
- Consume: `estrategiaDisponible`, `diaPermitido` (T2); `MiniFila` y `Panel` (T7, T9).
- Produce: `guardarEstrategia(e: Omit<Estrategia, 'id'> & { id?: string })`,
  `guardarPieza(p: Omit<Pieza, 'id' | 'archivada'> & { id?: string })`,
  `archivarPieza(id: string, archivada: boolean)`; todas `Promise<{ error?: string }>`.

- [x] **Paso 1:** tests con cliente simulado: `guardarEstrategia` con una pieza en un día que no
  admite → `{ error: 'Esa pieza no puede ir ese día' }`; `guardarPieza` con hora `'25:00'` →
  error; archivar y recuperar cambian solo `archivada`.
- [x] **Paso 2:** implementar según [diseno.md § Estrategias](diseno.md#estrategias): estrategias
  en «Con episodio» y «Sin episodio» con su mini fila y «no disponible» si usan una archivada;
  piezas con archivadas plegadas al final; **Nueva estrategia** y **Nueva pieza**.
- [x] **Paso 3:** `npm test`, `npm run build`. En el navegador: crear y editar una estrategia,
  archivar una pieza que usa (deja de ofrecerse al planificar, y los planes que la tienen se siguen
  viendo), recuperarla.
  *(Comprobado con datos inventados y sin sesión; la comprobación con sesión va en la Tarea 12.)*
- [x] **Paso 4:** commit «Sección Estrategias: estrategias y piezas».

### Tarea 12: Recorrido completo, documentación y publicación

- [ ] **Paso 1:** recorrido en el navegador integrado, escritorio y 375 px, temas claro y oscuro:
  entrar → planificar la semana siguiente → marcar una pieza → editar con el lápiz → cambiar el tema
  en Ajustes → salir. Sin errores en la consola. *Hecho el 2026-10-19 en local y con sesión (la
  cuenta de Mario): planificar, marcar, lápiz, Estrategias y temas. Falta revisar la app en el móvil
  y «Cambiar contraseña» con sesión.*
- [ ] **Paso 2:** revisión de todo el diff de `app-v1` por un revisor con contexto limpio
  (superpowers:requesting-code-review), con foco en la lista «Foco de revisión».
- [ ] **Paso 3:** actualizar `CLAUDE.md` (Mapa, Comandos con `npm test`, Estado con fecha) y
  `README.md`; marcar en [diseno.md](diseno.md) lo que haya cambiado al construir. *Al día el
  2026-10-19 con la publicación y el correo propio; se repite si cambia algo más.*
- [x] **Paso 4:** subir `app-v1`, comprobar con un usuario real y juntarla con `main` (producción).
  Hecho el 2026-10-19: `main` = `e9c61b0`, `app.horizonsport.co` sirve la app. Recuperación con la
  plantilla propia → **Crea tu contraseña** → dentro, y la fila de `perfiles` se creó sola.
- [ ] **Paso 5:** antes de usarla con datos reales, montar una copia periódica de los datos fuera de
  Supabase (el plan gratuito no da copias que Mario pueda restaurar). Se diseña con Mario.
- [ ] **Paso 6:** invitar a Izan y Lluís ([acceso.md § B](acceso.md#b-invitar-a-alguien)), que pongan
  su nombre en Ajustes, y decidir si se quita el plan de prueba de la semana del 26-oct (sin
  episodio). DMARC del dominio de correo, opcional.
