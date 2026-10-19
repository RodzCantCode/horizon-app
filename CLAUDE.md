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

1. Qué se publica esta semana y los próximos días, con fecha y hora.
2. Qué falta por programar en Metricool.
3. Qué semanas que vienen siguen sin planificar.

No hay responsables: van los tres a una, y el registro guarda quién hizo qué. Ahora la app es solo
calendario; más adelante se conectará con Metricool, que seguirá siendo lo que publica. La app no
publica en redes. **Pantallas, estados, horas y datos: [docs/diseno.md](docs/diseno.md).**

## Modelo

| Entidad | Qué es |
| --- | --- |
| Pieza | Tipo de contenido (T0–T4, clip principal, clip secundario, teaser, clip de archivo): nombre corto, formato (Carrusel o Reel), canales, días permitidos respecto al episodio, días de preparación y hora habitual |
| Estrategia | Combinación de piezas en días concretos (D-1 a D+5), para semana con o sin episodio |
| Plan | Episodio (o semana sin episodio) + estrategia elegida. Al generarse guarda una **copia fija** de las piezas con su fecha y hora reales y su estado (pendiente o programada) |

Reglas que no se negocian:

- Editar una estrategia o una pieza **no cambia** los planes ya generados.
- Las piezas se **archivan**, no se borran. Una estrategia que usa una pieza archivada deja de ofrecerse.
- Al mover de fecha u hora un plan o una pieza, las que ya estaban programadas se marcan para revisar.
- Fecha y hora de reloj en **hora de España** (`Europe/Madrid`), guardadas por separado; nunca una
  hora fija en UTC. El cambio de horario no mueve nada (decidido el 16-oct-2026; antes eran solo
  fechas).
- El día de referencia (D) es el día de publicación del episodio; hoy suele ser viernes, pero no se
  da por hecho en el código.

## Stack (decidido el 15-oct-2026)

**Next.js + Supabase (base de datos y login) + Mochi, publicado en Vercel.** Es el mismo stack que
`phsport-app`, otra herramienta interna de Mario con usuarios, calendario y estados: lo resuelto allí
(login con `@supabase/ssr`, RLS, pruebas) se reutiliza en vez de aprenderse de nuevo. Mochi es de
React y da el aspecto de la web casi gratis. Se descartó Astro (el de la web): encaja con webs de
contenido, no con una app con login y datos que cambian.

## Supabase desde Claude

- La conexión va **por proyecto**: `.mcp.json` define `supabase-horizon`, que apunta solo al
  proyecto de Horizon (`project_ref=xxtwmhzdkrmyhjmzoxck`, no es secreto). Hoy la cuenta de Supabase es la personal de
  Mario, con varias organizaciones (PHSPORT, Horizon Sport…): en cada equipo se inicia sesión una vez
  desde `/mcp` → `supabase-horizon` y, al autorizar, se elige la organización **Horizon Sport**. Si un día Horizon pasa a
  su propia cuenta, solo cambia ese inicio de sesión.
- Las conexiones generales de Supabase (el plugin y el conector de claude.ai) están autorizadas para
  **PHSPORT**. En este equipo están bloqueadas en `.claude/settings.local.json` (fuera del repo); en
  otro equipo, no uses una herramienta de Supabase que no sea la de `.mcp.json`. Mirar otra base de
  datos desde aquí solo si Mario lo pide expresamente.
- Sin CLI de Supabase por ahora (decidido el 14-oct-2026).
- `skip_elicitations=execute_sql,apply_migration` en `.mcp.json`: la confirmación propia de Supabase
  no llega a mostrarse en la app de escritorio y se rechaza sola, así que solo queda el permiso de
  Claude (decidido el 17-oct-2026, como en phsport-app). A cambio, **nada que borre en bloque**
  (`drop`, `truncate`, `delete` o `update` sin `where` que acote filas concretas) sin el OK expreso
  de Mario en el chat, aunque técnicamente se pueda. Las pruebas van en `begin … rollback`.

## Estado

18-oct-2026: la app está construida en la rama `app-v1` (Tareas 0–11 de
[docs/plan-construccion.md](docs/plan-construccion.md)). Cada push a `app-v1` publica una vista
previa en Vercel; `main` sigue sirviendo el prototipo y se junta solo con el OK de Mario (publica en
producción). Falta:

1. La prueba con sesión: el recorrido completo con un usuario real (Tarea 12).
2. Que el correo de invitación llegue a Izan y Lluís ([docs/acceso.md § Requisitos
   previos](docs/acceso.md#requisitos-previos)).
3. Antes de usarla con datos reales, una copia periódica de los datos fuera de Supabase (el plan
   gratuito no da copias que Mario pueda restaurar).

Supabase: proyecto «Horizon Sport - App» (organización «Horizon Sport», plan gratuito, Europa);
Supabase pausa los proyectos gratuitos tras una semana sin uso y se reactivan desde el panel sin
perder datos. Vercel: proyecto `horizon-app` (equipo `Rodz`, plan Hobby), enlazado al repo.

## Diseño

Mismo sistema visual que la web (ver `docs/DISENO.md` en `horizon-web`, enlazado arriba): fondo tinta, una sola
familia (Archivo) con el contraste en la anchura, azul `#169EFF` solo en la acción principal, sin
textos de ayuda tipo tooltip. Debe funcionar bien en el móvil.

- Los tokens (colores, fuente) son los de la web, con los mismos nombres, en `app/global.css`. Solo
  está lo que la app usa; si hace falta algo más, se copia de la web con su nombre. El tema claro
  (mismos tokens con otros valores) y los dos que la web no tiene (`--azul-texto`, `--ambar`) los
  define la app en ese mismo archivo.
- **Botones y campos, siempre de Mochi** (`mochi-ui`), con la paleta de Horizon redefiniendo sus
  variables `--mochi-*` en `app/global.css` (misma tabla que la web). Azul sólido (`variant="accent"`)
  solo en la acción principal de cada pantalla; el resto, `surface`.
- Mochi se instala **fijando una etiqueta** de https://github.com/RodzCantCode/mochi, igual que en la
  web: aquí la `v0.3.1` (la web sigue en la 0.3.0). Para subir: `npm install
  github:RodzCantCode/mochi#vX.Y.Z` y revisar botones y campos en escritorio y móvil.
- En Next.js los botones de Mochi se hidratan y miden su ancho con JavaScript (estilo en línea), así
  que una clase con `width: 100%` no los ensancha. Van con su ancho natural.
- `LinkButton as={Link}` solo va en un componente de cliente: desde uno de servidor, el prerender
  falla («Functions cannot be passed directly to Client Components»). Se envuelve en uno de cliente,
  como `app/(app)/semanas/BotonPlanificar.tsx`.
- Fuente: Archivo desde `next/font/google` con el eje `wdth` (`app/layout.tsx`).

## Comandos

Node 22 (`.nvmrc`; en Vercel lo fija `engines` de `package.json`).

| Comando | Qué hace |
| --- | --- |
| `npm install` | Dependencias. Descarga y compila Mochi desde GitHub, así que necesita conexión |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Compilación de producción (la misma que hace Vercel) |
| `npm run lint` | ESLint |
| `npm test` | Pruebas de `lib/` y de las acciones de servidor (Vitest), sin red: las acciones hablan con la base simulada de `lib/pruebas/` |

Las pruebas de la base, `supabase/pruebas/*.sql`, se ejecutan enteras con `execute_sql` de
`supabase-horizon`, siempre dentro de `begin … rollback` (ya lo llevan): devuelven una fila por
comprobación.

Antes de `npm run dev`, copia `.env.example` como `.env.local` y rellénalo (URL del proyecto y clave
publicable; las dos son públicas por diseño). `.env.local` no se sube. La clave secreta
(`service_role`) no se usa en la app.

## Mapa

| Ruta | Qué es |
| --- | --- |
| `app/layout.tsx` | Raíz: fuente, estilos de Mochi y el guion que pone el tema elegido antes de pintar (claro, oscuro o sistema: `lib/tema.ts`) |
| `app/global.css` | Tokens de Horizon (tema oscuro y claro) y variables de Mochi |
| `app/(app)/` | Lo que va con cabecera (Semanas `/`, Estrategias, Ajustes). Semanas es `page.tsx` con sus componentes en `semanas/`: pulsar una pieza abre su panel (`?pieza=<id>` en la URL: estado y registro, sobrevive a una recarga); **Planificar** abre el de planificar esa semana (`?planificar=<lunes>`: datos del episodio, estrategia con su mini fila, vista previa y **Crear plan**); el encabezado de una semana con plan abre el suyo (`?semana=<lunes>`: episodio, estrategia y piezas). En los paneles de pieza y de semana, el lápiz pasa a modo edición (estado del panel, no va en la URL). Acciones de servidor en `semanas/acciones.ts`. Estrategias es `estrategias/page.tsx`: estrategias con su mini fila y piezas (archivadas plegadas al final); cada una abre su panel (`?estrategia=<id>`, `?pieza=<id>`; con `=nueva`, el de crear una), con lápiz y, en las piezas, **Archivar**/**Recuperar**. Acciones en `estrategias/acciones.ts`. Ajustes es `ajustes/page.tsx`: **Tu cuenta** (correo de la sesión y nombre editable con el lápiz, `editar-nombre.tsx`; acción `cambiarNombre` en `ajustes/acciones.ts`, lectura en `lib/datos/perfil.ts`), tema, contraseña y salir. Si una lectura falla, `error.tsx` |
| `app/(app)/componentes/` | `Panel.tsx`: el panel de detalle de todas las pantallas (Drawer de Mochi a la derecha; por debajo de 768 px, su Dialog en hoja) y `usePanelDeLaUrl` (abrirlo y cerrarlo con un parámetro de la URL; lo usan los de Estrategias, los de Semanas llevan su propia copia); `edicion.tsx`: el envío de las acciones del modo edición (`useEnvio`) y **Guardar**/**Cancelar** |
| `app/entrar/` | `/entrar`: correo y contraseña. Sin registro: solo por invitación. `aceptar-enlace.tsx` recoge el enlace por defecto de los correos de Supabase (llega aquí con la sesión en el fragmento) y lleva a **Crea tu contraseña** |
| `app/auth/confirmar/`, `app/crear-contrasena/` | Adonde llevará el enlace de los correos con plantillas propias (hace falta SMTP propio, pendiente), y **Crea tu contraseña**. Lo que se configura en Supabase: [docs/acceso.md](docs/acceso.md) |
| `proxy.ts` | Corre antes de cada ruta (en Next.js 16 el `middleware` se llama `proxy`): refresca la sesión y decide adónde va cada uno (`lib/supabase/rutas.ts`) |
| `lib/supabase/` | Clientes de Supabase con `@supabase/ssr`: `navegador.ts`, `servidor.ts` y `sesion.ts` (el del proxy); `rutas.ts`, qué rutas piden sesión; `enlace.ts`, qué trae el fragmento del enlace por defecto |
| `lib/*.ts` | Lógica sin pantalla ni base de datos, con sus pruebas al lado (`*.test.ts`): `fechas.ts` (días y horas en `Europe/Madrid`), `planes.ts` (generar un plan, va justa, mover, propuestas), `semanas.ts` (qué semanas se ven y los textos de Semanas), `estrategias.ts` (los de Estrategias), `tema.ts`, `contrasena.ts`; los tipos, en `tipos.ts` |
| `lib/datos/` | Lecturas de Supabase en el servidor. Pasan las filas de la base (snake_case) a los tipos de `lib/tipos.ts`, y al revés lo que se manda a la base (`crear_plan`, `cambiar_estrategia`, una pieza suelta): las pantallas y la lógica de `lib/` no ven las de la base |
| `lib/pruebas/baseSimulada.ts` | Base de datos en memoria que sustituye al cliente de Supabase en las pruebas de las acciones de servidor, con las piezas y estrategias del prototipo |
| `supabase/migrations/` | Las migraciones aplicadas, con la versión que registró `apply_migration` |
| `supabase/pruebas/` | Pruebas de la base en SQL: `seguridad.sql` (RLS y registro) y `funciones.sql` (`crear_plan`, `mover_plan`, `cambiar_estrategia`) |
| `docs/plan-construccion.md` | El plan por tareas con que se construyó, y lo que queda (Tarea 12) |
| `docs/acceso.md` | Cómo invitar, cómo mandar una recuperación y qué configurar en Supabase |
| `prototipo/index.html` | Prototipo de octubre: referencia del modelo, no de la interfaz. No se sirve |
| `AGENTS.md` | Lo escribe `next dev`: avisa a los agentes de que lean la documentación de Next que viene en `node_modules/next/dist/docs/`. No se edita a mano |

Next.js 16 con Cache Components activado (`next.config.ts`, lo que trae `create-next-app`): lo que
lee la petición (cookies, sesión) va dentro de `<Suspense>`, como `ListaSemanas` en
`app/(app)/page.tsx`.
Con Partial Prefetching (`partialPrefetching` en `next.config.ts`), leer cookies no saca nada del
prerender del App Shell: por eso `crearClienteServidor()` (`lib/supabase/servidor.ts`) espera antes
a la petición real con `connection()`, y «hoy» (`hoyEnMadrid()`) se calcula siempre después de
pedir el cliente o la sesión. Si no, Next.js avisa en desarrollo de un valor inestable (`Date.now()`,
`new Date()`) en el prerender.

## Convenciones

- Todo en español: copy, nombres en el código y commits.
- Commits: título corto en español y cuerpo con el porqué.
