# Horizon App

Herramienta interna de Horizon Sport para planificar el contenido de redes de cada episodio.
Repo público. Previsto en `app.horizonsport.co`.

App de Next.js con login de Supabase. Para arrancarla en local (Node 22): `npm install`, copia
`.env.example` como `.env.local` y rellénalo, y `npm run dev`. De momento tiene la pantalla de
entrar, el acceso por invitación ([docs/acceso.md](docs/acceso.md)), Ajustes y una portada vacía.

El prototipo estático de octubre está en `prototipo/index.html`: ábrelo en el navegador. Guarda los
datos en el navegador de cada uno.

Contexto, modelo, reglas y comandos: [CLAUDE.md](CLAUDE.md).
