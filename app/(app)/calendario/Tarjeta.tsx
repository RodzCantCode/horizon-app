import Link from 'next/link';
import { tituloEpisodio, type TarjetaCalendario } from '@/lib/calendario';
import { avisoDePieza } from '@/lib/semanas';
import { MarcaEstado } from '../semanas/MarcaEstado';
import estilos from './calendario.module.css';

const TEXTO_AVISO = { 'va-justa': 'va justa', revisar: 'revisar' } as const;

// Una tarjeta de un día del Calendario. Un post: su marca de estado (MarcaEstado, como en Inicio), la
// hora en su línea, el nombre y de qué es («Del 06», «Sin episodio»); abre su panel (?pieza=<id>),
// que al cerrarse devuelve el foco aquí por data-pieza. El episodio: la tarjeta invertida con la hora,
// «Episodio 06» y dónde sale; abre el panel de su semana (?semana=<lunes del plan>). `href` lo da
// Calendario.tsx, con la semana que se ve.
export function Tarjeta({ tarjeta, hoy, href }: { tarjeta: TarjetaCalendario; hoy: string; href: string }) {
  if (tarjeta.tipo === 'episodio') {
    const { plan } = tarjeta;
    return (
      <Link href={href} scroll={false} className={estilos.tarjeta} data-tipo="episodio">
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
    <Link href={href} scroll={false} className={estilos.tarjeta} data-pieza={pieza.id}>
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
