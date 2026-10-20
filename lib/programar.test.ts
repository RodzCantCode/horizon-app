import { describe, expect, it } from 'vitest';
import {
  borradorNuevo,
  cambiarConEpisodio,
  elegirEstrategia,
  moverEpisodioBorrador,
  moverPost,
  postsDelBorrador,
  proponerHoraEpisodio,
  semanaParaProgramar,
  type Borrador,
} from '@/lib/programar';
import type { Estrategia, Pieza, Plan } from '@/lib/tipos';

// Piezas y estrategias del prototipo, como en lib/planes.test.ts (solo las que hacen falta).
function pieza(id: string, nombre: string, horaHabitual: string | null): Pieza {
  return {
    id,
    nombre,
    nombreCorto: nombre,
    formato: 'reel',
    canales: ['ig'],
    diasPermitidos: [],
    diasPreparacion: 2,
    horaHabitual,
    archivada: false,
  };
}

const PIEZAS: Pieza[] = [
  pieza('t1', 'Próximos invitados', null),
  pieza('t2', 'Valor + CTA', null),
  pieza('t3', 'Frases de invitados', null),
  pieza('t4', 'Historia del invitado', null),
  pieza('rp', 'Clip principal', '18:00'),
  pieza('rc', 'Clip secundario', '13:00'),
  pieza('rt', 'Teaser', null),
  pieza('ra', 'Clip de archivo', null),
];

function estrategia(id: string, conEpisodio: boolean, items: [string, number][]): Estrategia {
  return { id, nombre: id, conEpisodio, items: items.map(([piezaId, desplazamiento]) => ({ piezaId, desplazamiento })) };
}

const e1 = estrategia('e1', true, [['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]);
const e2 = estrategia('e2', true, [['rt', -1], ['rp', 0], ['t2', 1]]);
const e3 = estrategia('e3', false, [['t3', -1], ['ra', 1], ['ra', 4], ['t1', 5]]);

function plan(cambios: Partial<Plan>): Plan {
  return {
    id: 'p',
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

// Episodio el viernes 23 de octubre de 2026, a las 19:00.
const BORRADOR: Borrador = borradorNuevo('2026-10-23', '19:00');

/** [índice del ítem, fecha, hora, desplazamiento] de cada post, en el orden de la estrategia. */
const resumen = (b: Borrador, e: Estrategia) =>
  postsDelBorrador(b, e, PIEZAS).map((p) => [p.indice, p.fecha, p.hora, p.desplazamiento]);

describe('borradorNuevo', () => {
  it('empieza con episodio, sin estrategia y sin posts', () => {
    expect(BORRADOR).toEqual({
      conEpisodio: true,
      diaD: '2026-10-23',
      horaEpisodio: '19:00',
      estrategiaId: null,
      fechas: [],
    });
  });
});

describe('elegirEstrategia', () => {
  it('pega sus posts alrededor de D, con la hora habitual de cada pieza', () => {
    const b = elegirEstrategia(BORRADOR, e1);

    expect(b.estrategiaId).toBe('e1');
    expect(b.fechas).toEqual([null, null, null, null, null]);
    expect(resumen(b, e1)).toEqual([
      [0, '2026-10-22', null, -1],
      [1, '2026-10-23', '18:00', 0],
      [2, '2026-10-25', '13:00', 2],
      [3, '2026-10-27', null, 4],
      [4, '2026-10-28', '13:00', 5],
    ]);
  });

  it('elegir otra sustituye los posts, también los que se habían movido', () => {
    const conE1Movida = moverPost(elegirEstrategia(BORRADOR, e1), 2, '2026-11-02');
    const b = elegirEstrategia(conE1Movida, e2);

    expect(b.estrategiaId).toBe('e2');
    expect(b.fechas).toEqual([null, null, null]);
    expect(resumen(b, e2)).toEqual([
      [0, '2026-10-22', null, -1],
      [1, '2026-10-23', '18:00', 0],
      [2, '2026-10-24', null, 1],
    ]);
  });

  it('volver a elegir la misma la vuelve a pegar alrededor de D', () => {
    const movida = moverPost(elegirEstrategia(BORRADOR, e1), 0, '2026-10-19');
    expect(elegirEstrategia(movida, e1).fechas).toEqual([null, null, null, null, null]);
  });

  it('no cambia el borrador recibido', () => {
    const antes = structuredClone(BORRADOR);
    elegirEstrategia(BORRADOR, e1);
    expect(BORRADOR).toEqual(antes);
  });
});

describe('moverPost', () => {
  it('cambia solo ese post; los demás siguen alrededor de D', () => {
    const b = moverPost(elegirEstrategia(BORRADOR, e1), 2, '2026-10-29');

    expect(b.fechas).toEqual([null, null, '2026-10-29', null, null]);
    expect(resumen(b, e1)).toEqual([
      [0, '2026-10-22', null, -1],
      [1, '2026-10-23', '18:00', 0],
      [2, '2026-10-29', '13:00', 6],
      [3, '2026-10-27', null, 4],
      [4, '2026-10-28', '13:00', 5],
    ]);
  });

  it('un post llevado lejos del episodio guarda los días que haya entre D y su fecha', () => {
    const b = moverPost(moverPost(elegirEstrategia(BORRADOR, e1), 4, '2026-11-12'), 0, '2026-10-13');
    expect(resumen(b, e1).map(([indice, , , desplazamiento]) => [indice, desplazamiento])).toEqual([
      [0, -10],
      [1, 0],
      [2, 2],
      [3, 4],
      [4, 20],
    ]);
  });

  it('no cambia el borrador recibido', () => {
    const b = elegirEstrategia(BORRADOR, e1);
    moverPost(b, 1, '2026-10-24');
    expect(b.fechas).toEqual([null, null, null, null, null]);
  });
});

describe('moverEpisodioBorrador', () => {
  it('cambia D y deja cada post en su fecha', () => {
    const b = moverPost(elegirEstrategia(BORRADOR, e1), 3, '2026-10-30');
    const movido = moverEpisodioBorrador(b, '2026-10-24', e1);

    expect(movido.diaD).toBe('2026-10-24');
    expect(movido.fechas).toEqual(['2026-10-22', '2026-10-23', '2026-10-25', '2026-10-30', '2026-10-28']);
    // Las mismas fechas que antes; lo que cambia es su posición respecto al nuevo D.
    expect(resumen(movido, e1)).toEqual([
      [0, '2026-10-22', null, -2],
      [1, '2026-10-23', '18:00', -1],
      [2, '2026-10-25', '13:00', 1],
      [3, '2026-10-30', null, 6],
      [4, '2026-10-28', '13:00', 4],
    ]);
  });

  it('también a otra semana: los posts no se mueven', () => {
    const movido = moverEpisodioBorrador(elegirEstrategia(BORRADOR, e1), '2026-10-30', e1);
    expect(movido.diaD).toBe('2026-10-30');
    expect(postsDelBorrador(movido, e1, PIEZAS).map((p) => p.fecha)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-25',
      '2026-10-27',
      '2026-10-28',
    ]);
  });

  it('sin estrategia elegida solo cambia D', () => {
    expect(moverEpisodioBorrador(BORRADOR, '2026-10-22', null)).toEqual({ ...BORRADOR, diaD: '2026-10-22' });
  });

  it('conserva la hora del episodio', () => {
    expect(moverEpisodioBorrador(BORRADOR, '2026-10-22', null).horaEpisodio).toBe('19:00');
  });
});

describe('cambiarConEpisodio', () => {
  it('sin episodio, la estrategia elegida (que es de las de episodio) se quita', () => {
    const b = cambiarConEpisodio(elegirEstrategia(BORRADOR, e1), false);
    expect(b).toEqual({ ...BORRADOR, conEpisodio: false, estrategiaId: null, fechas: [] });
  });

  it('si no cambia, el borrador sigue igual', () => {
    const b = elegirEstrategia(BORRADOR, e1);
    expect(cambiarConEpisodio(b, true)).toBe(b);
  });

  it('un plan sin episodio pega la estrategia alrededor del día de referencia', () => {
    const sinEpisodio = moverEpisodioBorrador(cambiarConEpisodio(BORRADOR, false), '2026-10-22', null);
    const b = elegirEstrategia(sinEpisodio, e3);

    expect(b.diaD).toBe('2026-10-22');
    expect(resumen(b, e3)).toEqual([
      [0, '2026-10-21', null, -1],
      [1, '2026-10-23', null, 1],
      [2, '2026-10-26', null, 4],
      [3, '2026-10-27', null, 5],
    ]);
  });
});

describe('postsDelBorrador', () => {
  it('cada post es una copia pendiente de su pieza, sin marca de revisar', () => {
    const [primero] = postsDelBorrador(elegirEstrategia(BORRADOR, e2), e2, PIEZAS);
    expect(primero).toEqual({
      indice: 0,
      piezaId: 'rt',
      nombre: 'Teaser',
      nombreCorto: 'Teaser',
      formato: 'reel',
      canales: ['ig'],
      diasPreparacion: 2,
      desplazamiento: -1,
      fecha: '2026-10-22',
      hora: null,
      estado: 'pendiente',
      revisar: false,
    });
  });
});

describe('semanaParaProgramar', () => {
  it('la semana siguiente a la de hoy, si no tiene plan', () => {
    expect(semanaParaProgramar([plan({ lunes: '2026-10-19' })], '2026-10-20')).toBe('2026-10-26');
  });

  it('si la siguiente tiene plan, la primera después que no lo tenga', () => {
    const planes = [plan({ lunes: '2026-10-26' }), plan({ lunes: '2026-11-02' }), plan({ lunes: '2026-11-16' })];
    expect(semanaParaProgramar(planes, '2026-10-25')).toBe('2026-11-09');
  });
});

describe('proponerHoraEpisodio', () => {
  it('la hora del último episodio', () => {
    const planes = [
      plan({ diaD: '2026-10-23', horaEpisodio: '19:00' }),
      plan({ diaD: '2026-10-30', horaEpisodio: '20:30' }),
      plan({ diaD: '2026-11-06', conEpisodio: false, horaEpisodio: null }),
    ];
    expect(proponerHoraEpisodio(planes)).toBe('20:30');
  });

  it('sin episodios, o si el último no tenía hora, ninguna', () => {
    expect(proponerHoraEpisodio([])).toBeNull();
    expect(proponerHoraEpisodio([plan({ diaD: '2026-10-23', horaEpisodio: '19:00' }), plan({ diaD: '2026-10-30' })])).toBeNull();
  });
});
