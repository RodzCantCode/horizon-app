// Tipos del dominio de la app. Fechas como texto ISO `YYYY-MM-DD` y horas como `HH:MM`, siempre de
// reloj en `Europe/Madrid` (ver `lib/fechas.ts`).

export type Formato = 'slide' | 'reel';
export type Canal = 'ig' | 'tiktok' | 'shorts';
export type Estado = 'pendiente' | 'programada';

/** Los formatos y los canales que hay, en el orden en que se enseñan. */
export const FORMATOS: readonly Formato[] = ['slide', 'reel'];
export const CANALES: readonly Canal[] = ['ig', 'tiktok', 'shorts'];

/** Tipo de contenido que se puede poner en una estrategia. Se archiva, no se borra. */
export type Pieza = {
  id: string;
  nombre: string;
  /** Nombre sin el prefijo de la serie (por ejemplo «Valor + CTA» en vez de «T2 · Valor + CTA»). */
  nombreCorto: string;
  formato: Formato;
  canales: Canal[];
  /** Desplazamientos respecto al día D (D-1 = -1, D = 0, D+4 = 4) en los que puede ir. */
  diasPermitidos: number[];
  /** Días antes de publicar a los que hay que empezar a prepararla. */
  diasPreparacion: number;
  /** Hora `HH:MM` a la que suele publicarse; `null` si no tiene una fija. */
  horaHabitual: string | null;
  archivada: boolean;
};

/** Combinación de piezas en días concretos respecto al día D. */
export type Estrategia = {
  id: string;
  nombre: string;
  conEpisodio: boolean;
  items: { piezaId: string; desplazamiento: number }[];
};

/**
 * Copia fija de una pieza dentro de un plan, con su fecha y hora reales. Editar o archivar la pieza
 * original no la cambia. `piezaId` queda en `null` si la pieza original se borra.
 */
export type PiezaDePlan = {
  id: string;
  planId: string;
  piezaId: string | null;
  nombre: string;
  nombreCorto: string;
  formato: Formato;
  canales: Canal[];
  diasPreparacion: number;
  desplazamiento: number;
  fecha: string;
  hora: string | null;
  estado: Estado;
  /** Se marca al mover de fecha u hora una pieza que ya estaba programada en Metricool. */
  revisar: boolean;
};

/** Lo que genera la lógica antes de que la base de datos le ponga `id` y `planId`. */
export type NuevaPiezaDePlan = Omit<PiezaDePlan, 'id' | 'planId'>;

/** Episodio (o semana sin episodio) con la estrategia elegida. */
export type Plan = {
  id: string;
  /** Lunes de la semana del plan. */
  lunes: string;
  /** Día de referencia: el de publicación del episodio. */
  diaD: string;
  conEpisodio: boolean;
  numero: string | null;
  invitado: string | null;
  tema: string | null;
  estrategiaId: string | null;
  estrategiaNombre: string;
  /** Hora `HH:MM` de publicación del episodio; `null` si no la tiene (o es una semana sin episodio). */
  horaEpisodio: string | null;
};

/**
 * Una anotación del registro (quién hizo qué y cuándo), ya con el nombre de la persona. `accion` es
 * la que escribe la base: crear, editar, borrar, programar, volver_a_pendiente o mover. `creadoEn` es
 * un instante ISO (la única fecha de la app que no es de reloj en Madrid).
 */
export type EntradaRegistro = {
  nombre: string;
  accion: string;
  creadoEn: string;
};
