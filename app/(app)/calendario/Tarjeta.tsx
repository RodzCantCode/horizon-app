import type { DragEvent } from 'react';
import Link from 'next/link';
import { tituloEpisodio, type TarjetaCalendario } from '@/lib/calendario';
import { avisoDePieza } from '@/lib/semanas';
import { MarcaEstado } from '../semanas/MarcaEstado';
import { empezarArrastre } from './Programar';
import estilos from './calendario.module.css';

const TEXTO_AVISO = { 'va-justa': 'va justa', revisar: 'revisar' } as const;

// Una tarjeta de un día del Calendario. Un post: su marca de estado (MarcaEstado, como en Inicio), la
// hora en su línea, el nombre y de qué es («Del 06», «Sin episodio»); abre su panel (?pieza=<id>),
// que al cerrarse devuelve el foco aquí por data-pieza. El episodio: la tarjeta invertida con la hora,
// «Episodio 06» y dónde sale; abre el panel de su semana (?semana=<lunes del plan>). `href` lo da
// Calendario.tsx, con la semana que se ve.
//
// Con `arrastre` (fuera del modo programar y a partir de 1024 px), se arrastra a otro día: lo que
// pasa al soltarla lo decide Calendario.tsx.
export function Tarjeta({
  tarjeta,
  hoy,
  href,
  arrastre,
}: {
  tarjeta: TarjetaCalendario;
  hoy: string;
  href: string;
  arrastre?: { arrastrando: boolean; alEmpezar: () => void; alTerminar: () => void };
}) {
  const eventos = arrastre
    ? {
        draggable: true,
        'data-arrastrable': '',
        'data-arrastrando': arrastre.arrastrando ? '' : undefined,
        onDragStart: (evento: DragEvent<HTMLAnchorElement>) => {
          empezarArrastre(evento.dataTransfer, tarjeta.tipo === 'post' ? tarjeta.pieza.id : `episodio-${tarjeta.plan.id}`);
          arrastre.alEmpezar();
        },
        onDragEnd: arrastre.alTerminar,
      }
    : // Sin arrastre, el navegador no debe arrastrar el enlace por su cuenta: soltarlo en un campo (por
      // ejemplo «Invitado», en el modo programar) escribiría su dirección.
      { draggable: false };

  if (tarjeta.tipo === 'episodio') {
    const { plan } = tarjeta;
    return (
      <Link href={href} scroll={false} className={estilos.tarjeta} data-tipo="episodio" {...eventos}>
        <span className={estilos.marcaEpisodio} aria-hidden="true" />
        <span className={estilos.texto}>
          {plan.horaEpisodio && <span className={estilos.hora}>{plan.horaEpisodio}</span>}
          <span>{tituloEpisodio(plan)}</span>
          <span className={estilos.de}>YouTube y Spotify</span>
        </span>
      </Link>
    );
  }

  const { pieza, de } = tarjeta;
  const aviso = avisoDePieza(pieza, hoy);
  return (
    <Link href={href} scroll={false} className={estilos.tarjeta} data-pieza={pieza.id} {...eventos}>
      <MarcaEstado pieza={pieza} hoy={hoy} />
      <span className={estilos.texto}>
        {pieza.hora && <span className={estilos.hora}>{pieza.hora}</span>}
        <span>{pieza.nombre}</span>
        {de && <span className={estilos.de}>{de}</span>}
      </span>
      {aviso && (
        <span className={estilos.aviso} aria-hidden="true">
          {TEXTO_AVISO[aviso]}
        </span>
      )}
    </Link>
  );
}
