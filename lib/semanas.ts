// Lógica pura de la pantalla Semanas: qué semanas se ven, qué plan y qué piezas tiene cada día, y
// los textos de sus encabezados y de los paneles (pieza, planificar y semana). Sin acceso a datos:
// recibe los planes, las piezas y el registro ya leídos (`lib/datos/`) y el día de hoy en España
// (`hoyEnMadrid`), así se prueba entera.

import { diaSemana, fechaEnMadrid, lunesDe, sumarDias } from '@/lib/fechas';
import { compararFechaYHora, DESPLAZAMIENTOS, necesitaAtencion } from '@/lib/planes';
import type { Canal, EntradaRegistro, Formato, PiezaDePlan, Plan } from '@/lib/tipos';

export type PosicionSemana = 'pasada' | 'actual' | 'siguiente' | 'lejana';

export type VistaDia = {
  fecha: string;
  esHoy: boolean;
  /** Ordenadas por hora, con las que no tienen hora al final. */
  piezas: PiezaDePlan[];
};

export type VistaSemana = {
  lunes: string;
  plan: Plan | null;
  /** De lunes a domingo. */
  dias: VistaDia[];
  posicion: PosicionSemana;
  /** Solo se avisa de la semana siguiente sin plan; planificar más lejos se puede, no se exige. */
  avisoSinPlan: boolean;
};

const CUANTAS_ATRAS = 1;
const CUANTAS_DELANTE = 2;

/**
 * Semanas que se ven alrededor de hoy, en orden: `cuantasAtras` pasadas, la actual y `cuantasDelante`
 * después (la primera es la siguiente; el resto, lejanas). Cada pieza va al día de su fecha, sea de
 * un plan de esa semana o de otro: el D+4 de un plan del viernes sale en la semana siguiente aunque
 * esa no tenga plan. Lo que cae fuera de esas semanas se ignora.
 */
export function construirSemanas(
  planes: Plan[],
  piezas: PiezaDePlan[],
  hoy: string,
  cuantasAtras = CUANTAS_ATRAS,
  cuantasDelante = CUANTAS_DELANTE,
): VistaSemana[] {
  const lunesActual = lunesDe(hoy);

  const piezasPorFecha = new Map<string, PiezaDePlan[]>();
  for (const pieza of piezas) {
    const delDia = piezasPorFecha.get(pieza.fecha) ?? [];
    delDia.push(pieza);
    piezasPorFecha.set(pieza.fecha, delDia);
  }

  const semanas: VistaSemana[] = [];
  for (let desplazamiento = -cuantasAtras; desplazamiento <= cuantasDelante; desplazamiento++) {
    const lunes = sumarDias(lunesActual, desplazamiento * 7);
    const plan = planes.find((p) => p.lunes === lunes) ?? null;
    const posicion: PosicionSemana =
      desplazamiento < 0
        ? 'pasada'
        : desplazamiento === 0
          ? 'actual'
          : desplazamiento === 1
            ? 'siguiente'
            : 'lejana';

    const dias = Array.from({ length: 7 }, (_, i): VistaDia => {
      const fecha = sumarDias(lunes, i);
      // `sort` es estable: a igual hora se mantiene el orden en que llegaron.
      const delDia = [...(piezasPorFecha.get(fecha) ?? [])].sort(compararFechaYHora);
      return { fecha, esHoy: fecha === hoy, piezas: delDia };
    });

    semanas.push({ lunes, plan, dias, posicion, avisoSinPlan: posicion === 'siguiente' && plan === null });
  }
  return semanas;
}

/**
 * Por qué pide atención una pieza (y se marca en ámbar): «revisar» si se movió estando programada y
 * hay que revisarla en Metricool; si no, «va-justa» si falta poco para publicarla. `null` si nada.
 */
export function avisoDePieza(p: PiezaDePlan, hoy: string): 'revisar' | 'va-justa' | null {
  if (!necesitaAtencion(p, hoy)) return null;
  return p.revisar ? 'revisar' : 'va-justa';
}

/** Del lunes de la primera semana que se ve al domingo de la última: lo que hay que leer. */
export function rangoSemanas(
  hoy: string,
  cuantasAtras = CUANTAS_ATRAS,
  cuantasDelante = CUANTAS_DELANTE,
): { desde: string; hasta: string } {
  const lunesActual = lunesDe(hoy);
  return {
    desde: sumarDias(lunesActual, -cuantasAtras * 7),
    hasta: sumarDias(lunesActual, cuantasDelante * 7 + 6),
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function diaYMes(fecha: string): { dia: number; mes: string } {
  const [, mes, dia] = fecha.split('-').map(Number);
  return { dia, mes: MESES[mes - 1] };
}

/** «12–18 oct»; si la semana cambia de mes, «26 oct – 1 nov». */
export function etiquetaSemana(lunes: string): string {
  const inicio = diaYMes(lunes);
  const fin = diaYMes(sumarDias(lunes, 6));
  return inicio.mes === fin.mes
    ? `${inicio.dia}–${fin.dia} ${fin.mes}`
    : `${inicio.dia} ${inicio.mes} – ${fin.dia} ${fin.mes}`;
}

/** «Mié 14». */
export function etiquetaDia(fecha: string): string {
  return `${DIAS[diaSemana(fecha)]} ${diaYMes(fecha).dia}`;
}

/** Línea de datos del encabezado: «Ep 05 · Invitado · Tema», «Sin episodio» o «Sin planificar». */
export function datosPlan(plan: Plan | null): string {
  if (plan === null) return 'Sin planificar';
  if (!plan.conEpisodio) return 'Sin episodio';
  const episodio = plan.numero ? `Ep ${plan.numero}` : 'Episodio';
  return [episodio, plan.invitado, plan.tema].filter(Boolean).join(' · ');
}

/** «3 piezas, todas programadas», «3 piezas, 2 pendientes», «1 pieza, pendiente»; sin piezas, nada. */
function resumenPiezas(piezas: PiezaDePlan[]): string | null {
  if (piezas.length === 0) return null;
  if (piezas.length === 1) return `1 pieza, ${piezas[0].estado}`;
  const pendientes = piezas.filter((p) => p.estado === 'pendiente').length;
  const estado =
    pendientes === 0 ? 'todas programadas' : `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`;
  return `${piezas.length} piezas, ${estado}`;
}

/**
 * Línea de una semana plegada: el episodio (sin invitado ni tema, para que quepa) y cuántas piezas
 * tiene y cuántas faltan por programar. «Ep 04 · 3 piezas, todas programadas».
 */
export function resumenPlegada(semana: VistaSemana): string {
  const { plan } = semana;
  const cabeza = datosPlan(plan ? { ...plan, invitado: null, tema: null } : null);
  const piezas = resumenPiezas(semana.dias.flatMap((d) => d.piezas));
  return piezas === null ? cabeza : `${cabeza} · ${piezas}`;
}

// --- Panel de una pieza ----------------------------------------------

const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** «D», «D-1», «D+4». */
export function posicionRespectoAD(desplazamiento: number): string {
  if (desplazamiento === 0) return 'D';
  return desplazamiento > 0 ? `D+${desplazamiento}` : `D${desplazamiento}`;
}

/** «Viernes 16 oct». */
export function fechaLarga(fecha: string): string {
  const { dia, mes } = diaYMes(fecha);
  return `${DIAS_LARGOS[diaSemana(fecha)]} ${dia} ${mes}`;
}

/** Cuándo se publica y dónde cae respecto al episodio: «Viernes 16 oct · 18:00 · D». */
export function fechaYPosicion(p: PiezaDePlan): string {
  return [fechaLarga(p.fecha), p.hora, posicionRespectoAD(p.desplazamiento)].filter(Boolean).join(' · ');
}

const TEXTO_AVISO = { 'va-justa': 'va justa', revisar: 'revisar en Metricool' } as const;

/** «Programada», «Pendiente» y, si pide atención, por qué: «Pendiente · va justa». */
export function estadoDePieza(p: PiezaDePlan, hoy: string): string {
  const estado = p.estado === 'programada' ? 'Programada' : 'Pendiente';
  const aviso = avisoDePieza(p, hoy);
  return aviso ? `${estado} · ${TEXTO_AVISO[aviso]}` : estado;
}

const FORMATOS: Record<Formato, string> = { reel: 'Reel', slide: 'Carrusel' };
const CANALES: Record<Canal, string> = { ig: 'Instagram', tiktok: 'TikTok', shorts: 'Shorts' };

export function textoFormato(formato: Formato): string {
  return FORMATOS[formato];
}

/** «Instagram · TikTok · Shorts». */
export function textoCanales(canales: Canal[]): string {
  return canales.map((c) => CANALES[c]).join(' · ');
}

/** «1 día», «3 días». */
export function textoPreparacion(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

// Las frases hablan de una pieza («la»). Una acción que no está aquí se lee «la cambió».
const VERBOS: Record<string, string> = {
  crear: 'la creó',
  editar: 'la editó',
  borrar: 'la quitó',
  programar: 'la marcó como programada',
  volver_a_pendiente: 'la devolvió a pendiente',
  mover: 'la movió',
};

/** «Ana la marcó como programada · 14 oct», con el día de España en que se hizo. */
export function fraseDeRegistro(e: EntradaRegistro): string {
  const { dia, mes } = diaYMes(fechaEnMadrid(new Date(e.creadoEn)));
  return `${e.nombre} ${VERBOS[e.accion] ?? 'la cambió'} · ${dia} ${mes}`;
}

// --- Panel de planificar ---------------------------------------------

/** «del 19 al 25 oct»; si la semana cambia de mes, «del 26 oct al 1 nov». */
function delLunesAlDomingo(lunes: string): string {
  const inicio = diaYMes(lunes);
  const fin = diaYMes(sumarDias(lunes, 6));
  const desde = inicio.mes === fin.mes ? `${inicio.dia}` : `${inicio.dia} ${inicio.mes}`;
  return `del ${desde} al ${fin.dia} ${fin.mes}`;
}

/** «Planificar la semana del 19 al 25 oct»; si cambia de mes, «del 26 oct al 1 nov». */
export function tituloPlanificar(lunes: string): string {
  return `Planificar la semana ${delLunesAlDomingo(lunes)}`;
}

// --- Panel de una semana ---------------------------------------------

/** «Semana del 19 al 25 oct»; si cambia de mes, «del 26 oct al 1 nov». */
export function tituloSemana(lunes: string): string {
  return `Semana ${delLunesAlDomingo(lunes)}`;
}

/**
 * Los días en que puede ir una pieza de un plan, de D-1 a D+5, para elegirlos en un panel:
 * «Jueves 22 oct · D-1».
 */
export function diasDelPlan(diaD: string): { fecha: string; etiqueta: string }[] {
  return DESPLAZAMIENTOS.map((desplazamiento) => {
    const fecha = sumarDias(diaD, desplazamiento);
    return { fecha, etiqueta: `${fechaLarga(fecha)} · ${posicionRespectoAD(desplazamiento)}` };
  });
}
