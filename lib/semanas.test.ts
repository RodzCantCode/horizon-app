import { describe, expect, it } from 'vitest';
import {
  avisoDePieza,
  construirSemanas,
  datosPlan,
  esAvisoDeDesfase,
  estadoDePieza,
  etiquetaDia,
  etiquetaSemana,
  fechaLarga,
  fechaYPosicion,
  fraseDeRegistro,
  pasaALaSemana,
  posicionRespectoAD,
  rangoSemanas,
  textoCanales,
  textoFormato,
  textoPreparacion,
  tituloSemana,
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
  horaEpisodio: null,
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

describe('fechaYPosicion', () => {
  it('día de la semana, fecha, hora y posición respecto al día D', () => {
    const [, clipPrincipal, clipSecundario, valor] = piezasEp05();
    expect(fechaYPosicion(clipPrincipal)).toBe('Viernes 16 oct · 18:00 · D');
    expect(fechaYPosicion(clipSecundario)).toBe('Domingo 18 oct · D+2');
    expect(fechaYPosicion(valor)).toBe('Martes 20 oct · D+4');
    expect(fechaYPosicion(piezasEp05()[0])).toBe('Jueves 15 oct · D-1');
  });
});

describe('estadoDePieza', () => {
  const [historia, clipPrincipal, clipSecundario] = piezasEp05();

  it('el estado y, si pide atención, por qué', () => {
    expect(estadoDePieza(historia, '2026-10-15')).toBe('Programada');
    expect(estadoDePieza(clipSecundario, '2026-10-15')).toBe('Pendiente');
    expect(estadoDePieza(clipPrincipal, '2026-10-15')).toBe('Pendiente · va justa');
    expect(estadoDePieza({ ...clipSecundario, revisar: true }, '2026-10-12')).toBe(
      'Pendiente · revisar en Metricool',
    );
  });
});

describe('textos de los datos de una pieza', () => {
  it('formato, canales y días de preparación', () => {
    expect(textoFormato('reel')).toBe('Reel');
    expect(textoFormato('slide')).toBe('Carrusel');
    expect(textoCanales(['ig', 'tiktok', 'shorts'])).toBe('Instagram · TikTok · Shorts');
    expect(textoCanales(['tiktok'])).toBe('TikTok');
    expect(textoPreparacion(1)).toBe('1 día');
    expect(textoPreparacion(3)).toBe('3 días');
    expect(textoPreparacion(0)).toBe('0 días');
  });
});

describe('fraseDeRegistro', () => {
  const entrada = { nombre: 'Ana', accion: 'programar', creadoEn: '2026-10-14T09:12:33.123456+00:00' };

  it('quién, qué y el día', () => {
    expect(fraseDeRegistro(entrada)).toBe('Ana la marcó como programada · 14 oct');
    expect(fraseDeRegistro({ ...entrada, accion: 'volver_a_pendiente' })).toBe('Ana la devolvió a pendiente · 14 oct');
    expect(fraseDeRegistro({ ...entrada, accion: 'mover' })).toBe('Ana la movió · 14 oct');
    expect(fraseDeRegistro({ ...entrada, accion: 'editar' })).toBe('Ana la editó · 14 oct');
    expect(fraseDeRegistro({ ...entrada, accion: 'crear', nombre: 'Sistema' })).toBe('Sistema la creó · 14 oct');
    expect(fraseDeRegistro({ ...entrada, accion: 'borrar' })).toBe('Ana la quitó · 14 oct');
  });

  it('el día es el de España aunque en UTC aún sea el anterior', () => {
    expect(fraseDeRegistro({ ...entrada, creadoEn: '2026-10-14T22:30:00+00:00' })).toBe(
      'Ana la marcó como programada · 15 oct',
    );
  });

  it('una acción que no conoce no rompe la frase', () => {
    expect(fraseDeRegistro({ ...entrada, accion: 'otra' })).toBe('Ana la cambió · 14 oct');
  });
});

describe('posicionRespectoAD', () => {
  it('D, D-1 y D+N', () => {
    expect(posicionRespectoAD(-1)).toBe('D-1');
    expect(posicionRespectoAD(0)).toBe('D');
    expect(posicionRespectoAD(4)).toBe('D+4');
  });
});

describe('fechaLarga', () => {
  it('día de la semana entero, número y mes', () => {
    expect(fechaLarga('2026-10-23')).toBe('Viernes 23 oct');
    expect(fechaLarga('2026-11-01')).toBe('Domingo 1 nov');
  });
});

describe('tituloSemana', () => {
  it('nombra la semana de lunes a domingo, con los dos meses si cambia de mes', () => {
    expect(tituloSemana('2026-10-19')).toBe('Semana del 19 al 25 oct');
    expect(tituloSemana('2026-10-26')).toBe('Semana del 26 oct al 1 nov');
  });
});

describe('pasaALaSemana', () => {
  it('dice a qué semana pasa el plan', () => {
    expect(pasaALaSemana('2026-10-26', '2026-10-21')).toBe('Pasa a la semana del 26 oct al 1 nov');
  });

  it('con el año si esa semana no es del año de hoy', () => {
    expect(pasaALaSemana('2027-10-18', '2026-10-21')).toBe('Pasa a la semana del 18 al 24 oct de 2027');
    expect(pasaALaSemana('2025-10-20', '2026-10-21')).toBe('Pasa a la semana del 20 al 26 oct de 2025');
  });

  it('una semana entre dos años lleva el año del domingo', () => {
    expect(pasaALaSemana('2026-12-28', '2026-12-16')).toBe('Pasa a la semana del 28 dic al 3 ene de 2027');
    expect(pasaALaSemana('2025-12-29', '2026-01-07')).toBe('Pasa a la semana del 29 dic al 4 ene de 2026');
  });
});

describe('esAvisoDeDesfase', () => {
  it('reconoce los avisos de que la pieza o la semana han cambiado con el panel abierto', () => {
    expect(esAvisoDeDesfase('La pieza ha cambiado mientras la editabas. Revisa y vuelve a guardar.')).toBe(true);
    expect(esAvisoDeDesfase('La semana ha cambiado mientras la editabas. Revisa y vuelve a guardar.')).toBe(true);
  });

  it('los demás errores no sacan del modo edición', () => {
    for (const error of [
      'Esa pieza ya no está en el plan',
      'El día tiene que estar entre D-1 y D+5',
      'Esa hora no es válida',
      'No se ha podido guardar. Vuelve a intentarlo.',
    ]) {
      expect(esAvisoDeDesfase(error)).toBe(false);
    }
  });
});
