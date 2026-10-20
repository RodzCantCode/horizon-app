import { describe, expect, it } from 'vitest';
import {
  construirCalendario,
  etiquetaDe,
  inicioCalendario,
  moverTarjeta,
  rangoCalendario,
  rangoMiniFila,
  SEMANAS_CALENDARIO,
  tituloEpisodio,
} from '@/lib/calendario';
import type { Estrategia, PiezaDePlan, Plan } from '@/lib/tipos';

function plan(cambios: Partial<Plan> = {}): Plan {
  return {
    id: 'plan1',
    lunes: '2026-10-19',
    diaD: '2026-10-23',
    conEpisodio: true,
    numero: '06',
    invitado: null,
    tema: null,
    estrategiaId: 'e1',
    estrategiaNombre: 'E1',
    horaEpisodio: null,
    ...cambios,
  };
}

function pieza(cambios: Partial<PiezaDePlan> = {}): PiezaDePlan {
  return {
    id: 'pp1',
    planId: 'plan1',
    piezaId: 'rp',
    nombre: 'Clip principal',
    nombreCorto: 'Clip principal',
    formato: 'reel',
    canales: ['ig'],
    diasPreparacion: 2,
    desplazamiento: 0,
    fecha: '2026-10-23',
    hora: null,
    estado: 'pendiente',
    revisar: false,
    ...cambios,
  };
}

function estrategia(desplazamientos: number[]): Estrategia {
  return {
    id: 'e',
    nombre: 'E',
    conEpisodio: true,
    items: desplazamientos.map((desplazamiento) => ({ piezaId: 'rp', desplazamiento })),
  };
}

describe('inicioCalendario', () => {
  const hoy = '2026-10-20'; // martes

  it('sin parámetro, el lunes de la semana de hoy', () => {
    expect(inicioCalendario(undefined, hoy)).toBe('2026-10-19');
  });

  it('una fecha que no existe da el lunes de hoy', () => {
    expect(inicioCalendario('2026-13-40', hoy)).toBe('2026-10-19');
    expect(inicioCalendario('hola', hoy)).toBe('2026-10-19');
  });

  it('una fecha que no es lunes (un miércoles) da el lunes de hoy', () => {
    expect(inicioCalendario('2026-10-28', hoy)).toBe('2026-10-19');
  });

  it('un lunes válido se respeta, también en el pasado', () => {
    expect(inicioCalendario('2026-10-26', hoy)).toBe('2026-10-26');
    expect(inicioCalendario('2026-09-07', hoy)).toBe('2026-09-07');
  });
});

describe('rangoCalendario', () => {
  it('va del lunes al domingo de la tercera semana', () => {
    expect(SEMANAS_CALENDARIO).toBe(3);
    expect(rangoCalendario('2026-10-19')).toEqual({ desde: '2026-10-19', hasta: '2026-11-08' });
  });
});

describe('etiquetaDe', () => {
  it('«Del 06» con número', () => {
    expect(etiquetaDe(plan({ numero: '06' }))).toBe('Del 06');
  });

  it('«Del episodio» si tiene episodio pero no número', () => {
    expect(etiquetaDe(plan({ numero: null }))).toBe('Del episodio');
  });

  it('«Sin episodio» si no tiene episodio', () => {
    expect(etiquetaDe(plan({ conEpisodio: false, numero: null }))).toBe('Sin episodio');
  });
});

describe('tituloEpisodio', () => {
  it('«Episodio 06» con número; «Episodio» sin él', () => {
    expect(tituloEpisodio(plan({ numero: '06' }))).toBe('Episodio 06');
    expect(tituloEpisodio(plan({ numero: null }))).toBe('Episodio');
  });
});

describe('construirCalendario', () => {
  const hoy = '2026-10-20';
  const lunes = '2026-10-19';

  it('devuelve tres semanas de siete días, de lunes a domingo', () => {
    const semanas = construirCalendario([], [], hoy, lunes);
    expect(semanas.map((s) => s.lunes)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(semanas.every((s) => s.dias.length === 7)).toBe(true);
    expect(semanas[0].dias[0].fecha).toBe('2026-10-19');
    expect(semanas[2].dias[6].fecha).toBe('2026-11-08');
  });

  it('marca hoy y los días pasados', () => {
    const dias = construirCalendario([], [], hoy, lunes)[0].dias;
    expect(dias.map((d) => [d.fecha, d.esHoy, d.esPasado])).toEqual([
      ['2026-10-19', false, true],
      ['2026-10-20', true, false],
      ['2026-10-21', false, false],
      ['2026-10-22', false, false],
      ['2026-10-23', false, false],
      ['2026-10-24', false, false],
      ['2026-10-25', false, false],
    ]);
  });

  it('cada semana lleva el plan cuyo lunes es el suyo, o null', () => {
    const semanas = construirCalendario([plan()], [], hoy, lunes);
    expect(semanas.map((s) => s.plan?.id ?? null)).toEqual(['plan1', null, null]);
  });

  it('un post de un plan de la semana anterior sale en su día con «Del 05»', () => {
    const anterior = plan({ id: 'p5', lunes: '2026-10-12', diaD: '2026-10-16', numero: '05' });
    const post = pieza({ id: 'x', planId: 'p5', fecha: '2026-10-21', desplazamiento: 5 });
    const semanas = construirCalendario([anterior, plan()], [post], hoy, lunes);
    const dia = semanas[0].dias[2];
    expect(dia.fecha).toBe('2026-10-21');
    expect(dia.tarjetas).toEqual([{ tipo: 'post', pieza: post, de: 'Del 05' }]);
    // Y el plan anterior no es el de ninguna de las tres semanas.
    expect(semanas[0].plan?.id).toBe('plan1');
  });

  it('ignora los posts fuera de las tres semanas', () => {
    const antes = pieza({ id: 'a', fecha: '2026-10-18' });
    const despues = pieza({ id: 'b', fecha: '2026-11-09' });
    const semanas = construirCalendario([plan()], [antes, despues], hoy, lunes);
    expect(semanas.flatMap((s) => s.dias.flatMap((d) => d.tarjetas)).filter((t) => t.tipo === 'post')).toEqual([]);
  });

  it('el episodio de un plan con episodio sale en su diaD', () => {
    const p = plan({ horaEpisodio: '10:00' });
    const dia = construirCalendario([p], [], hoy, lunes)[0].dias[4];
    expect(dia.fecha).toBe('2026-10-23');
    expect(dia.tarjetas).toEqual([{ tipo: 'episodio', plan: p }]);
  });

  it('un plan sin episodio no pone tarjeta de episodio y sus posts dicen «Sin episodio»', () => {
    const sin = plan({ conEpisodio: false, numero: null });
    const post = pieza({ fecha: '2026-10-22' });
    const semanas = construirCalendario([sin], [post], hoy, lunes);
    const tarjetas = semanas.flatMap((s) => s.dias.flatMap((d) => d.tarjetas));
    expect(tarjetas).toEqual([{ tipo: 'post', pieza: post, de: 'Sin episodio' }]);
  });

  it('dentro del día, por hora, con el episodio en su hora y lo que no tiene hora al final', () => {
    const p = plan({ horaEpisodio: '12:00' });
    const sinHora = pieza({ id: 'sin', hora: null });
    const tarde = pieza({ id: 'tarde', hora: '18:00' });
    const temprano = pieza({ id: 'temprano', hora: '09:00' });
    const dia = construirCalendario([p], [sinHora, tarde, temprano], hoy, lunes)[0].dias[4];
    expect(
      dia.tarjetas.map((t) => (t.tipo === 'post' ? t.pieza.id : 'episodio')),
    ).toEqual(['temprano', 'episodio', 'tarde', 'sin']);
  });

  it('un episodio sin hora va después de los posts con hora', () => {
    const p = plan({ horaEpisodio: null });
    const conHora = pieza({ id: 'con', hora: '18:00' });
    const dia = construirCalendario([p], [conHora], hoy, lunes)[0].dias[4];
    expect(dia.tarjetas.map((t) => (t.tipo === 'post' ? t.pieza.id : 'episodio'))).toEqual(['con', 'episodio']);
  });

  it('un post cuyo plan no está en la lista sale igual, con «de» vacío', () => {
    const huerfano = pieza({ planId: 'otro', fecha: '2026-10-21' });
    const dia = construirCalendario([], [huerfano], hoy, lunes)[0].dias[2];
    expect(dia.tarjetas).toEqual([{ tipo: 'post', pieza: huerfano, de: '' }]);
  });

  it('con un lunes a mano en el pasado, todo el rango es pasado', () => {
    const semanas = construirCalendario([], [], hoy, '2026-09-07');
    expect(semanas.flatMap((s) => s.dias).every((d) => d.esPasado && !d.esHoy)).toBe(true);
  });
});

describe('moverTarjeta', () => {
  const hoy = '2026-10-20';
  const lunes = '2026-10-19';
  const ids = (tarjetas: { tipo: string; pieza?: PiezaDePlan }[]) =>
    tarjetas.map((t) => (t.tipo === 'post' ? t.pieza!.id : 'episodio'));

  it('lleva un post a su día nuevo, en su hora, y lo quita del de antes', () => {
    const movido = pieza({ id: 'm', fecha: '2026-10-23', hora: '12:00' });
    const otros = [pieza({ id: 'a', fecha: '2026-10-28', hora: '09:00' }), pieza({ id: 'b', fecha: '2026-10-28', hora: '18:00' })];
    const semanas = construirCalendario([plan()], [movido, ...otros], hoy, lunes);
    const despues = moverTarjeta(semanas, { tipo: 'post', id: 'm', fecha: '2026-10-28' });

    expect(ids(despues[0].dias[4].tarjetas)).toEqual(['episodio']);
    const dia = despues[1].dias[2];
    expect(dia.fecha).toBe('2026-10-28');
    expect(ids(dia.tarjetas)).toEqual(['a', 'm', 'b']);
    expect(dia.tarjetas[1]).toEqual({ tipo: 'post', pieza: { ...movido, fecha: '2026-10-28' }, de: 'Del 06' });
    // Las semanas de antes no cambian (useOptimistic las vuelve a usar si falla).
    expect(ids(semanas[0].dias[4].tarjetas)).toEqual(['m', 'episodio']);
  });

  it('un post programado vuelve a pendiente y queda para revisar, como hará la base', () => {
    const programado = pieza({ id: 'm', estado: 'programada', revisar: false });
    const semanas = construirCalendario([plan()], [programado], hoy, lunes);
    const [tarjeta] = moverTarjeta(semanas, { tipo: 'post', id: 'm', fecha: '2026-10-24' })[0].dias[5].tarjetas;
    expect(tarjeta).toMatchObject({ pieza: { fecha: '2026-10-24', estado: 'pendiente', revisar: true } });
  });

  it('lleva el episodio a su día nuevo, con su día D y su semana, sin mover sus posts', () => {
    const post = pieza({ id: 'p', fecha: '2026-10-23' });
    const semanas = construirCalendario([plan()], [post], hoy, lunes);
    const despues = moverTarjeta(semanas, { tipo: 'episodio', planId: 'plan1', fecha: '2026-10-27' });

    expect(ids(despues[0].dias[4].tarjetas)).toEqual(['p']);
    expect(despues[1].dias[1].tarjetas).toEqual([
      { tipo: 'episodio', plan: { ...plan(), diaD: '2026-10-27', lunes: '2026-10-26' } },
    ]);
  });

  it('a un día que no se ve, la tarjeta deja de verse', () => {
    const semanas = construirCalendario([plan()], [pieza({ id: 'm' })], hoy, lunes);
    const despues = moverTarjeta(semanas, { tipo: 'post', id: 'm', fecha: '2026-11-20' });
    expect(despues.flatMap((s) => s.dias.flatMap((d) => ids(d.tarjetas)))).toEqual(['episodio']);
  });

  it('si la tarjeta no está, las semanas no cambian', () => {
    const semanas = construirCalendario([plan()], [pieza()], hoy, lunes);
    expect(moverTarjeta(semanas, { tipo: 'post', id: 'otra', fecha: '2026-10-21' })).toBe(semanas);
    expect(moverTarjeta(semanas, { tipo: 'episodio', planId: 'otro', fecha: '2026-10-21' })).toBe(semanas);
  });
});

describe('rangoMiniFila', () => {
  it('se amplía a los desplazamientos de la estrategia', () => {
    expect(rangoMiniFila(estrategia([-5, 0, 14]))).toEqual({ desde: -5, hasta: 14 });
  });

  it('nunca es menor que -2…12', () => {
    expect(rangoMiniFila(estrategia([0, 3]))).toEqual({ desde: -2, hasta: 12 });
  });

  it('sin ítems, -2…12', () => {
    expect(rangoMiniFila(estrategia([]))).toEqual({ desde: -2, hasta: 12 });
  });

  it('crece por los dos lados a la vez', () => {
    expect(rangoMiniFila(estrategia([-7, 14]))).toEqual({ desde: -7, hasta: 14 });
  });
});
