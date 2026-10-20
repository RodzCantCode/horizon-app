# Horizon App

Herramienta interna de Horizon Sport para planificar el contenido de redes de cada episodio.
Repo público. Publicada en `app.horizonsport.co`.

App de Next.js con login de Supabase. Para arrancarla en local (Node 22): `npm install`, copia
`.env.example` como `.env.local` y rellénalo, y `npm run dev`. De momento tiene la pantalla de
entrar, el acceso por invitación ([docs/acceso.md](docs/acceso.md)), Ajustes, la pantalla Calendario,
donde se programa un episodio arrastrando sus posts, cada pieza se abre en un panel y se marca como
programada, y las piezas y las semanas se editan con el lápiz de su panel, y la sección Estrategias,
donde se crean y editan las estrategias y las piezas, y las piezas se archivan o se recuperan.

El prototipo estático de octubre está en `prototipo/index.html`: ábrelo en el navegador. Guarda los
datos en el navegador de cada uno.

Contexto, modelo, reglas y comandos: [CLAUDE.md](CLAUDE.md).
