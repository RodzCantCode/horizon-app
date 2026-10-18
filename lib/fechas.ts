// Fechas y horas de la app: texto ISO `YYYY-MM-DD` para los días y `HH:MM` para las horas, siempre
// como reloj de pared en `Europe/Madrid`. Nunca se guardan instantes UTC.
//
// La aritmética de días se hace en UTC puro sobre `Date.UTC(año, mes, día)`: UTC no tiene cambio de
// horario, así que un día son siempre 24 h exactas. Por eso no se usa `new Date('YYYY-MM-DD')` ni la
// hora local del servidor: dependerían de la zona del proceso.

const ZONA = 'Europe/Madrid';
const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

const formatoMadrid = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora de reloj que marca Madrid en un instante, como `YYYY-MM-DD` y `HH:MM`. */
function relojEnMadrid(instante: Date): { fecha: string; hora: string } {
  const partes: Record<string, string> = {};
  for (const { type, value } of formatoMadrid.formatToParts(instante)) {
    partes[type] = value;
  }
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

/** Milisegundos UTC de la medianoche de una fecha `YYYY-MM-DD`. */
function aMilisegundosUtc(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/**
 * Indica si un texto es una fecha `YYYY-MM-DD` que existe en el calendario. Sirve para lo que llega
 * de fuera (la URL, una acción de servidor) antes de hacer cuentas con ello: `2026-02-30` no lo es.
 */
export function esFecha(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && sumarDias(texto, 0) === texto;
}

/**
 * La hora `HH:MM` de un texto escrito a mano: «18:00» tal cual y «9:30» como «09:30». `null` si no es
 * una hora de reloj de 24 h (de 00:00 a 23:59). Para lo que llega de un campo de hora.
 */
export function normalizarHora(texto: string): string | null {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!partes) return null;
  if (Number(partes[1]) > 23 || Number(partes[2]) > 59) return null;
  return `${partes[1].padStart(2, '0')}:${partes[2]}`;
}

/** Lunes de la semana que contiene la fecha (el lunes se devuelve a sí mismo). */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -diaSemana(fecha));
}

/** Fecha resultante de sumar (o restar, con negativos) días enteros. */
export function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(aMilisegundosUtc(fecha) + dias * MS_POR_DIA);
  return resultado.toISOString().slice(0, 10);
}

/** Días enteros de `desde` a `hasta`; negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return (aMilisegundosUtc(hasta) - aMilisegundosUtc(desde)) / MS_POR_DIA;
}

/** Día de hoy en España. De madrugada (00:30 allí) no es el de UTC. */
export function hoyEnMadrid(ahora: Date = new Date()): string {
  return fechaEnMadrid(ahora);
}

/** Día de España en que cayó un instante, como `registro.creado_en` (que se guarda en UTC). */
export function fechaEnMadrid(instante: Date): string {
  return relojEnMadrid(instante).fecha;
}

/**
 * Indica si una hora de reloj `HH:MM` existe en Madrid ese día. La que salta en marzo (02:00–02:59)
 * no existe; la que se repite en octubre sí. Se prueban los dos desfases posibles con UTC (+1 h en
 * invierno, +2 h en verano): la hora existe si alguno, al volver a formatear en Madrid, da la misma
 * fecha y hora. Un texto que no es fecha u hora válidas tampoco existe.
 */
export function existeEnMadrid(fecha: string, hora: string): boolean {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const comoUtc = Date.UTC(anio, mes - 1, dia, horas, minutos);
  if (Number.isNaN(comoUtc)) return false;

  return [1, 2].some((desfase) => {
    const reloj = relojEnMadrid(new Date(comoUtc - desfase * MS_POR_HORA));
    return reloj.fecha === fecha && reloj.hora === hora;
  });
}

/** Día de la semana de una fecha: 0 = lunes … 6 = domingo. */
export function diaSemana(fecha: string): number {
  const domingoCero = new Date(aMilisegundosUtc(fecha)).getUTCDay();
  return (domingoCero + 6) % 7;
}
