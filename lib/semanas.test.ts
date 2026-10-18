import { describe, expect, it } from 'vitest';
import {
  avisoDePieza,
  construirSemanas,
  datosPlan,
  etiquetaDia,
  etiquetaSemana,
  rangoSemanas,
  resumenPlegada,
} from '@/lib/semanas';
import type { PiezaDePlan, Plan } from '@/lib/tipos';

// Plan de prueba: episodio 05, semana del 12 de octubre de 2026 y día D el viernes 16, con las piezas
// de la estrategia E1 del prototipo (T4 en D-1, clip principal en D, clip secundario en D+2, T2 en
// D+4 y clip secundario en D+5). Las dos últimas caen en la semana siguiente.
const planEp05: Plan = {
  id: 'plan05',
  lunes: '2026-10-12',
  diaD: '2026-10-16',
  conEpisodio: true,
  numero: '05',
  invitado: null,
  tema: null,
  estrategiaId: 'e1',
  estrategiaNombre: 'E1 · Anticipación fuerte',
};

function piezaDePlan(cambios: Partial<PiezaDePlan> & Pick<PiezaDePlan, 'id' | 'fecha'>): PiezaDePlan {
  return {
    planId: 'plan05',
    piezaId: 'rc',
    nombre: 'Clip secundario',
    nombreCorto: 'Clip secundario',
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    diasPreparacion: 2,
    desplazamiento: 0,
    hora: null,
    estado: 'pendiente',
    revisar: false,
    ...cambios,
  };
}

function piezasEp05(): PiezaDePlan[] {
  return [
    piezaDePlan({ id: 'b3', piezaId: 't4', nombre: 'T4 · Historia del invitado', nombreCorto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], diasPreparacion: 3, desplazamiento: -1, fecha: '2026-10-15', estado: 'programada' }),
    piezaDePlan({ id: 'b4', piezaId: 'rp', nombre: 'Clip principal', nombreCorto: 'Clip principal', desplazamiento: 0, fecha: '2026-10-16', hora: '18:00' }),
    piezaDePlan({ id: 'b5', desplazamiento: 2, fecha: '2026-10-18' }),
    piezaDePlan({ id: 'c1', piezaId: 't2', nombre: 'T2 · Valor + CTA', nombreCorto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], diasPreparacion: 3, desplazamiento: 4, fecha: '2026-10-20' }),
    piezaDePlan({ id: 'c2', desplazamiento: 5, fecha: '2026-10-21' }),
  ];
}

describe('construirSemanas', () => {
  it('ordena las semanas, avisa solo de la siguiente sin plan y lleva a ella las piezas que cruzan', () => {
    const v = construirSemanas([planEp05], piezasEp05(), '2026-10-15');
    expect(v.map((s) => [s.lunes, s.posicion])).toEqual([
      ['2026-10-05', 'pasada'],
      ['2026-10-12', 'actual'],
      ['2026-10-19', 'siguiente'],
      ['2026-10-26', 'lejana'],
    ]);
    const siguiente = v[2];
    expect(siguiente.plan).toBe(null);
    expect(siguiente.avisoSinPlan).toBe(true);
    expect(siguiente.dias[1].piezas.map((p) => p.nombreCorto)).toEqual(['Valor + CTA']); // D+4 cruza
    expect(v[3].avisoSinPlan).toBe(false); // solo se avisa de la siguiente
    expect(v[1].dias[3].esHoy).toBe(true);
    expect(v[1].dias[4].piezas.map((p) => p.hora)).toEqual(['18:00']);
  });

  it('pone cada plan en la semana de su lunes', () => {
    const v = construirSemanas([planEp05], piezasEp05(), '2026-10-15');
    expect(v.map((s) => s.plan?.id ?? null)).toEqual([null, 'plan05', null, null]);
    expect(v[1].avisoSinPlan).toBe(false);
  });

  it('no avisa de la siguiente si ya tiene plan', () => {
    const planEp06: Plan = { ...planEp05, id: 'plan06', lunes: '2026-10-19', diaD: '2026-10-23', numero: '06' };
    const v = construirSemanas([planEp05, planEp06], [], '2026-10-15');
    expect(v[2].plan?.id).toBe('plan06');
    expect(v[2].avisoSinPlan).toBe(false);
  });

  it('da siete días de lunes a domingo y marca hoy en un solo día', () => {
    const v = construirSemanas([], [], '2026-10-15');
    expect(v[1].dias.map((d) => d.fecha)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(v.flatMap((s) => s.dias).filter((d) => d.esHoy).map((d) => d.fecha)).toEqual(['2026-10-15']);
  });

  it('el domingo sigue siendo de la semana que empezó el lunes anterior', () => {
    const v = construirSemanas([], [], '2026-10-18');
    expect(v.find((s) => s.posicion === 'actual')?.lunes).toBe('2026-10-12');
    expect(v[1].dias[6].esHoy).toBe(true);
  });

  it('el lunes empieza semana nueva', () => {
    const v = construirSemanas([], [], '2026-10-19');
    expect(v.find((s) => s.posicion === 'actual')?.lunes).toBe('2026-10-19');
    expect(v[1].dias[0].esHoy).toBe(true);
  });

  it('ordena las piezas del día por hora, con las que no tienen hora al final', () => {
    const piezas = [
      piezaDePlan({ id: 'sin-hora', fecha: '2026-10-16' }),
      piezaDePlan({ id: 'tarde', fecha: '2026-10-16', hora: '20:00' }),
      piezaDePlan({ id: 'manana', fecha: '2026-10-16', hora: '09:30' }),
    ];
    const v = construirSemanas([], piezas, '2026-10-15');
    expect(v[1].dias[4].piezas.map((p) => p.id)).toEqual(['manana', 'tarde', 'sin-hora']);
  });

  it('sin datos: todas las semanas sin plan ni piezas y solo la siguiente avisa', () => {
    const v = construirSemanas([], [], '2026-10-15');
    expect(v.every((s) => s.plan === null)).toBe(true);
    expect(v.every((s) => s.dias.every((d) => d.piezas.length === 0))).toBe(true);
    expect(v.map((s) => s.avisoSinPlan)).toEqual([false, false, true, false]);
  });

  it('ignora las piezas y los planes que caen fuera de las semanas que se ven', () => {
    const fuera = [piezaDePlan({ id: 'antes', fecha: '2026-10-04' }), piezaDePlan({ id: 'despues', fecha: '2026-11-02' })];
    const planLejano: Plan = { ...planEp05, id: 'lejano', lunes: '2026-11-02', diaD: '2026-11-06' };
    const v = construirSemanas([planLejano], fuera, '2026-10-15');
    expect(v.flatMap((s) => s.dias).flatMap((d) => d.piezas)).toEqual([]);
    expect(v.every((s) => s.plan === null)).toBe(true);
  });

  it('acepta cuántas semanas enseñar antes y después de la actual', () => {
    const v = construirSemanas([], [], '2026-10-15', 2, 3);
    expect(v.map((s) => [s.lunes, s.posicion])).toEqual([
      ['2026-09-28', 'pasada'],
      ['2026-10-05', 'pasada'],
      ['2026-10-12', 'actual'],
      ['2026-10-19', 'siguiente'],
      ['2026-10-26', 'lejana'],
      ['2026-11-02', 'lejana'],
    ]);
  });
});

describe('avisoDePieza', () => {
  const clip = piezaDePlan({ id: 'b4', fecha: '2026-10-16', diasPreparacion: 2 });

  it('va justa cuando faltan sus días de preparación o menos; antes, nada', () => {
    expect(avisoDePieza(clip, '2026-10-13')).toBe(null);
    expect(avisoDePieza(clip, '2026-10-14')).toBe('va-justa');
  });

  it('revisar gana a va justa', () => {
    expect(avisoDePieza({ ...clip, revisar: true }, '2026-10-13')).toBe('revisar');
    expect(avisoDePieza({ ...clip, revisar: true }, '2026-10-15')).toBe('revisar');
  });

  it('una programada no avisa', () => {
    expect(avisoDePieza({ ...clip, estado: 'programada' }, '2026-10-15')).toBe(null);
  });
});

describe('rangoSemanas', () => {
  it('va del lunes de la primera semana que se ve al domingo de la última', () => {
    expect(rangoSemanas('2026-10-15')).toEqual({ desde: '2026-10-05', hasta: '2026-11-01' });
    expect(rangoSemanas('2026-10-15', 0, 1)).toEqual({ desde: '2026-10-12', hasta: '2026-10-25' });
  });
});

describe('etiquetaSemana', () => {
  it('junta los días si la semana es de un solo mes', () => {
    expect(etiquetaSemana('2026-10-12')).toBe('12–18 oct');
  });

  it('nombra los dos meses si la semana cambia de mes o de año', () => {
    expect(etiquetaSemana('2026-10-26')).toBe('26 oct – 1 nov');
    expect(etiquetaSemana('2026-12-28')).toBe('28 dic – 3 ene');
  });
});

describe('etiquetaDia', () => {
  it('da el día de la semana abreviado y el número', () => {
    expect(etiquetaDia('2026-10-12')).toBe('Lun 12');
    expect(etiquetaDia('2026-10-14')).toBe('Mié 14');
    expect(etiquetaDia('2026-10-17')).toBe('Sáb 17');
    expect(etiquetaDia('2026-11-01')).toBe('Dom 1');
  });
});

describe('datosPlan', () => {
  it('con episodio: número, invitado y tema, saltándose los vacíos', () => {
    expect(datosPlan({ ...planEp05, invitado: 'Invitada', tema: 'Tema' })).toBe('Ep 05 · Invitada · Tema');
    expect(datosPlan(planEp05)).toBe('Ep 05');
    expect(datosPlan({ ...planEp05, numero: null, invitado: 'Invitada' })).toBe('Episodio · Invitada');
  });

  it('sin episodio o sin plan', () => {
    expect(datosPlan({ ...planEp05, conEpisodio: false, numero: null })).toBe('Sin episodio');
    expect(datosPlan(null)).toBe('Sin planificar');
  });
});

describe('resumenPlegada', () => {
  const semana = (plan: Plan | null, piezas: PiezaDePlan[]) =>
    construirSemanas(plan ? [plan] : [], piezas, '2026-10-15').find((s) => s.lunes === '2026-10-12')!;

  it('cuenta las piezas y cuántas faltan por programar', () => {
    const todas = piezasEp05().slice(0, 3).map((p) => ({ ...p, estado: 'programada' as const }));
    expect(resumenPlegada(semana(planEp05, todas))).toBe('Ep 05 · 3 piezas, todas programadas');
    expect(resumenPlegada(semana(planEp05, piezasEp05()))).toBe('Ep 05 · 3 piezas, 2 pendientes');
    expect(resumenPlegada(semana(planEp05, piezasEp05().slice(1, 2)))).toBe('Ep 05 · 1 pieza, pendiente');
    expect(resumenPlegada(semana(planEp05, piezasEp05().slice(0, 1)))).toBe('Ep 05 · 1 pieza, programada');
  });

  it('sin piezas, solo los datos del plan', () => {
    expect(resumenPlegada(semana(planEp05, []))).toBe('Ep 05');
    expect(resumenPlegada(semana(null, []))).toBe('Sin planificar');
    expect(resumenPlegada(semana(null, piezasEp05().slice(1, 2)))).toBe('Sin planificar · 1 pieza, pendiente');
  });
});
