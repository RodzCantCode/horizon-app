import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Skeleton } from 'mochi-ui';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { estrategiasQueUsan, resumenPieza } from '@/lib/estrategias';
import { estrategiaDisponible } from '@/lib/planes';
import { exigirSesion } from '@/lib/supabase/servidor';
import type { Estrategia, Pieza } from '@/lib/tipos';
import { MiniFila } from '../semanas/MiniFila';
import { BotonNuevo } from './BotonNuevo';
import { PanelEstrategia } from './PanelEstrategia';
import { PanelPiezaPlantilla } from './PanelPiezaPlantilla';
import estilos from './estrategias.module.css';

export const metadata: Metadata = {
  title: 'Estrategias · Horizon Sport',
};

// Estrategias, una sección de la navegación (docs/diseno.md § Estrategias): las estrategias en
// «Con episodio» y «Sin episodio», cada una con su mini fila de días, y las piezas, con las
// archivadas plegadas al final. Pulsar una abre su panel (?estrategia=<id> o ?pieza=<id>), donde se
// ve, se edita con el lápiz y, una pieza, se archiva o se recupera; **Nueva estrategia** y **Nueva
// pieza** abren el mismo panel para crear una (=nueva). Editar nunca cambia los planes ya creados.
export default function Estrategias({ searchParams }: PageProps<'/estrategias'>) {
  return (
    <main className={estilos.pagina}>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Lo que se ve mientras llegan los datos: el titular y huecos con la forma de las estrategias.
function Cargando() {
  return (
    <div className={estilos.cargando}>
      <h1 className={`ancha ${estilos.titular}`}>Estrategias</h1>
      <span className="solo-lectores">Cargando las estrategias</span>
      <Skeleton shape="line" width="min(10rem, 50%)" />
      <Skeleton shape="block" height="6.5rem" />
      <Skeleton shape="block" height="6.5rem" />
    </div>
  );
}

// Lee la sesión de las cookies y los datos, así que va dentro de <Suspense> (Cache Components). Una
// sola lectura de estrategias y piezas para las listas y los paneles.
async function Contenido({ searchParams }: Pick<PageProps<'/estrategias'>, 'searchParams'>) {
  await exigirSesion();
  const [{ estrategias, piezas }, parametros] = await Promise.all([leerEstrategiasYPiezas(), searchParams]);
  const idEstrategia = textoDe(parametros.estrategia);
  const idPieza = textoDe(parametros.pieza);
  const activas = piezas.filter((p) => !p.archivada);
  const archivadas = piezas.filter((p) => p.archivada);

  return (
    <>
      <section className={estilos.seccion} aria-labelledby="titulo-estrategias">
        <div className={estilos.cabecera}>
          <h1 id="titulo-estrategias" className={`ancha ${estilos.titular}`}>
            Estrategias
          </h1>
          <BotonNuevo parametro="estrategia">Nueva estrategia</BotonNuevo>
        </div>
        <GrupoEstrategias
          id="con-episodio"
          titulo="Con episodio"
          estrategias={estrategias.filter((e) => e.conEpisodio)}
          piezas={piezas}
        />
        <GrupoEstrategias
          id="sin-episodio"
          titulo="Sin episodio"
          estrategias={estrategias.filter((e) => !e.conEpisodio)}
          piezas={piezas}
        />
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-piezas">
        <div className={estilos.cabecera}>
          <h2 id="titulo-piezas" className={`ancha ${estilos.titular}`}>
            Piezas
          </h2>
          <BotonNuevo parametro="pieza">Nueva pieza</BotonNuevo>
        </div>
        {activas.length > 0 ? <ListaPiezas piezas={activas} /> : <p className={estilos.vacio}>Ninguna</p>}
        {/* Plegadas al final: se abren al pulsar la línea, como las semanas pasadas. */}
        {archivadas.length > 0 && (
          <details className={estilos.archivadas}>
            <summary className={estilos.lineaArchivadas}>
              <span>{`Archivadas (${archivadas.length})`}</span>
              <span className={estilos.flecha} aria-hidden="true">
                ▸
              </span>
            </summary>
            <ListaPiezas piezas={archivadas} />
          </details>
        )}
      </section>

      {idEstrategia && (
        <PanelEstrategia
          key={idEstrategia}
          id={idEstrategia}
          estrategia={estrategias.find((e) => e.id === idEstrategia) ?? null}
          piezas={piezas}
        />
      )}
      {idPieza && (
        <PanelPiezaPlantilla
          key={idPieza}
          id={idPieza}
          pieza={piezas.find((p) => p.id === idPieza) ?? null}
          usadaEn={estrategiasQueUsan(idPieza, estrategias).map((e) => e.nombre)}
        />
      )}
    </>
  );
}

/** Un parámetro de la URL como texto no vacío, o `null`. */
function textoDe(valor: string | string[] | undefined): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

function GrupoEstrategias({
  id,
  titulo,
  estrategias,
  piezas,
}: {
  id: string;
  titulo: string;
  estrategias: Estrategia[];
  piezas: Pieza[];
}) {
  return (
    <section className={estilos.grupo} aria-labelledby={id}>
      <h2 id={id} className="estrecha">
        {titulo}
      </h2>
      {estrategias.length > 0 ? (
        <ul className={estilos.rejilla} data-ancha="">
          {estrategias.map((e) => (
            <li key={e.id} className={estilos.tarjeta}>
              <div className={estilos.cabeceraTarjeta}>
                {/* El enlace cubre toda la tarjeta (::after); al cerrar el panel, el foco vuelve aquí. */}
                <Link
                  href={`/estrategias?estrategia=${e.id}`}
                  scroll={false}
                  className={estilos.enlace}
                  data-estrategia={e.id}
                >
                  {e.nombre}
                </Link>
                {!estrategiaDisponible(e, piezas) && <span className={estilos.noDisponible}>No disponible</span>}
              </div>
              <MiniFila estrategia={e} piezas={piezas} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={estilos.vacio}>Ninguna</p>
      )}
    </section>
  );
}

function ListaPiezas({ piezas }: { piezas: Pieza[] }) {
  return (
    <ul className={estilos.rejilla}>
      {piezas.map((p) => (
        <li key={p.id} className={estilos.tarjeta}>
          <Link href={`/estrategias?pieza=${p.id}`} scroll={false} className={estilos.enlace} data-pieza={p.id}>
            {p.nombre}
          </Link>
          <p className={estilos.resumen}>{resumenPieza(p)}</p>
        </li>
      ))}
    </ul>
  );
}
