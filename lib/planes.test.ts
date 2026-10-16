import { describe, expect, it } from 'vitest';
import {
  diaPermitido,
  estrategiaDisponible,
  estrategiasParaPlanificar,
  generarPiezasDePlan,
  moverPiezaDePlan,
  necesitaAtencion,
  proponerDiaD,
  proponerNumero,
  vaJusta,
} from '@/lib/planes';
import type { Estrategia, Pieza, PiezaDePlan, Plan } from '@/lib/tipos';

// Datos de prueba tomados de la semilla del prototipo (`prototipo/index.html`). Cada llamada devuelve
// copias nuevas para que un test que muta una pieza no contamine a los demás.
const TODOS = [-1, 0, 1, 2, 3, 4, 5];

function piezasDePrueba(): Pieza[] {
  return [
    { id: 't0', nombre: 'T0 · Semana sin podcast', nombreCorto: 'Semana sin podcast', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [...TODOS], diasPreparacion: 3, horaHabitual: null, archivada: false },
    { id: 't1', nombre: 'T1 · Próximos invitados', nombreCorto: 'Próximos invitados', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [4, 5], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 't2', nombre: 'T2 · Valor + CTA', nombreCorto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [1, 2, 3, 4], diasPreparacion: 3, horaHabitual: null, archivada: false },
    { id: 't3', nombre: 'T3 · Frases de invitados', nombreCorto: 'Frases de invitados', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [...TODOS], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 't4', nombre: 'T4 · Historia del invitado', nombreCorto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [-1], diasPreparacion: 3, horaHabitual: null, archivada: false },
    { id: 'rp', nombre: 'Clip principal', nombreCorto: 'Clip principal', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [0], diasPreparacion: 2, horaHabitual: '18:00', archivada: false },
    { id: 'rc', nombre: 'Clip secundario', nombreCorto: 'Clip secundario', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [1, 2, 3, 4, 5], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 'rt', nombre: 'Teaser', nombreCorto: 'Teaser', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [-1], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 'ra', nombre: 'Clip de archivo', nombreCorto: 'Clip de archivo', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [...TODOS], diasPreparacion: 1, horaHabitual: null, archivada: false },
  ];
}

function estrategia(id: string, nombre: string, conEpisodio: boolean, items: [string, number][]): Estrategia {
  return { id, nombre, conEpisodio, items: items.map(([piezaId, desplazamiento]) => ({ piezaId, desplazamiento })) };
}

const e1 = estrategia('e1', 'E1 · Anticipación fuerte', true, [['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]);
const e2 = estrategia('e2', 'E2 · Valor primero', true, [['rt', -1], ['rp', 0], ['t2', 1], ['t3', 4], ['rc', 5]]);
const e3 = estrategia('e3', 'E3 · Recopilación', false, [['t3', -1], ['ra', 1], ['ra', 4], ['t1', 5]]);
const e4 = estrategia('e4', 'E4 · Actualidad', false, [['t0', 0], ['ra', 2], ['ra', 4], ['t1', 5]]);

function pieza(id: string, cambios: Partial<Pieza> = {}): Pieza {
  const base = piezasDePrueba().find((p) => p.id === id);
  if (!base) throw new Error(`Pieza de prueba desconocida: ${id}`);
  return { ...base, ...cambios };
}

function piezaDePlan(cambios: Partial<PiezaDePlan> = {}): PiezaDePlan {
  return {
    id: 'pp1',
    planId: 'plan1',
    piezaId: 'rp',
    nombre: 'Clip principal',
    nombreCorto: 'Clip principal',
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    diasPreparacion: 2,
    desplazamiento: 0,
    fecha: '2026-10-16',
    hora: '18:00',
    estado: 'pendiente',
    revisar: false,
    ...cambios,
  };
}

const plan: Plan = {
  id: 'plan1',
  lunes: '2026-10-12',
  diaD: '2026-10-16',
  conEpisodio: true,
  numero: '04',
  invitado: null,
  tema: null,
  estrategiaId: 'e1',
  estrategiaNombre: 'E1 · Anticipación fuerte',
};

describe('generarPiezasDePlan', () => {
  it('coloca cada pieza según su desplazamiento respecto al día D', () => {
    // E1 con D = viernes 2026-10-16: T4 en D-1, clip principal en D, secundario en D+2, T2 en D+4…
    const g = generarPiezasDePlan(e1, piezasDePrueba(), '2026-10-16');
    expect(g.map((p) => [p.nombreCorto, p.fecha, p.hora])).toEqual([
      ['Historia del invitado', '2026-10-15', null],
      ['Clip principal', '2026-10-16', '18:00'],
      ['Clip secundario', '2026-10-18', null],
      ['Valor + CTA', '2026-10-20', null],
      ['Clip secundario', '2026-10-21', null],
    ]);
    expect(g.every((p) => p.estado === 'pendiente' && !p.revisar)).toBe(true);
  });

  it('guarda una copia fija: cambiar la pieza después no cambia lo generado', () => {
    const piezas = piezasDePrueba();
    const g = generarPiezasDePlan(e1, piezas, '2026-10-16');
    const t4 = piezas.find((p) => p.id === 't4')!;
    t4.nombre = 'Otro';
    t4.canales.push('shorts');
    expect(g[0].nombre).toBe('T4 · Historia del invitado');
    expect(g[0].canales).toEqual(['ig', 'tiktok']);
  });

  it('copia el resto de datos de la pieza y su desplazamiento', () => {
    const g = generarPiezasDePlan(e1, piezasDePrueba(), '2026-10-16');
    expect(g[1]).toEqual({
      piezaId: 'rp',
      nombre: 'Clip principal',
      nombreCorto: 'Clip principal',
      formato: 'reel',
      canales: ['ig', 'tiktok', 'shorts'],
      diasPreparacion: 2,
      desplazamiento: 0,
      fecha: '2026-10-16',
      hora: '18:00',
      estado: 'pendiente',
      revisar: false,
    });
  });

  it('ordena por fecha y, dentro del día, por hora con las vacías al final', () => {
    const piezas = [
      ...piezasDePrueba(),
      pieza('t3', { id: 'manana', nombreCorto: 'Mañana', horaHabitual: '09:00' }),
    ];
    const delDia = estrategia('x', 'X', true, [['rc', 0], ['rp', 0], ['ra', 0], ['manana', 0], ['t3', -1]]);
    const g = generarPiezasDePlan(delDia, piezas, '2026-10-16');
    expect(g.map((p) => [p.nombreCorto, p.fecha, p.hora])).toEqual([
      ['Frases de invitados', '2026-10-15', null],
      ['Mañana', '2026-10-16', '09:00'],
      ['Clip principal', '2026-10-16', '18:00'],
      ['Clip secundario', '2026-10-16', null],
      ['Clip de archivo', '2026-10-16', null],
    ]);
  });

  it('cruza de semana: el D+4 de un plan del viernes cae en la semana siguiente', () => {
    const g = generarPiezasDePlan(e1, piezasDePrueba(), '2026-10-16');
    expect(g.at(-1)!.fecha).toBe('2026-10-21');
  });

  it('falla con un mensaje claro si la estrategia usa una pieza que ya no existe', () => {
    const sinRt = piezasDePrueba().filter((p) => p.id !== 'rt');
    expect(() => generarPiezasDePlan(e2, sinRt, '2026-10-16')).toThrow(/rt/);
  });
});

describe('vaJusta', () => {
  it('es cierto cuando quedan los días de preparación o menos', () => {
    expect(vaJusta({ estado: 'pendiente', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-14')).toBe(true);
    expect(vaJusta({ estado: 'pendiente', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-13')).toBe(false);
  });

  it('no avisa si la pieza ya está programada', () => {
    expect(vaJusta({ estado: 'programada', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-16')).toBe(false);
  });

  it('sigue avisando si la fecha ya pasó y no está programada', () => {
    expect(vaJusta({ estado: 'pendiente', fecha: '2026-10-16', diasPreparacion: 2 }, '2026-10-18')).toBe(true);
  });
});

describe('necesitaAtencion', () => {
  it('es cierto si va justa', () => {
    expect(necesitaAtencion(piezaDePlan({ fecha: '2026-10-16' }), '2026-10-14')).toBe(true);
  });

  it('es cierto si hay que revisarla aunque no vaya justa', () => {
    const p = piezaDePlan({ fecha: '2026-10-30', estado: 'pendiente', revisar: true });
    expect(necesitaAtencion(p, '2026-10-14')).toBe(true);
  });

  it('es falso si ni va justa ni hay que revisarla', () => {
    const p = piezaDePlan({ fecha: '2026-10-30', estado: 'programada' });
    expect(necesitaAtencion(p, '2026-10-14')).toBe(false);
  });
});

describe('moverPiezaDePlan', () => {
  const programada = piezaDePlan({ estado: 'programada' });
  const pendiente = piezaDePlan({ estado: 'pendiente' });

  it('si cambia el día, una pieza programada vuelve a pendiente y se marca para revisar', () => {
    const movida = moverPiezaDePlan({ ...programada, fecha: '2026-10-16', hora: '18:00' }, '2026-10-17', '18:00');
    expect([movida.estado, movida.revisar]).toEqual(['pendiente', true]);
    expect([movida.fecha, movida.hora]).toEqual(['2026-10-17', '18:00']);
  });

  it('si solo cambia la hora, también', () => {
    const movida = moverPiezaDePlan({ ...programada }, '2026-10-16', '19:30');
    expect([movida.estado, movida.revisar]).toEqual(['pendiente', true]);
    expect([movida.fecha, movida.hora]).toEqual(['2026-10-16', '19:30']);
  });

  it('si no cambia nada, sigue programada y sin revisar', () => {
    const igual = moverPiezaDePlan({ ...programada, fecha: '2026-10-16', hora: '18:00' }, '2026-10-16', '18:00');
    expect([igual.estado, igual.revisar]).toEqual(['programada', false]);
  });

  it('una pieza pendiente se mueve sin marcarla para revisar', () => {
    const movida = moverPiezaDePlan({ ...pendiente }, '2026-10-17', null);
    expect([movida.estado, movida.revisar]).toEqual(['pendiente', false]);
    expect([movida.fecha, movida.hora]).toEqual(['2026-10-17', null]);
  });

  it('si ya estaba marcada para revisar, se mantiene la marca', () => {
    const movida = moverPiezaDePlan({ ...pendiente, revisar: true }, '2026-10-17', '18:00');
    expect(movida.revisar).toBe(true);
  });

  it('devuelve un objeto nuevo y no modifica el original', () => {
    const original = { ...programada };
    const movida = moverPiezaDePlan(original, '2026-10-17', '20:00');
    expect(movida).not.toBe(original);
    expect(original).toEqual(programada);
  });
});

describe('estrategiaDisponible', () => {
  it('está disponible si todas sus piezas existen y no están archivadas', () => {
    expect(estrategiaDisponible(e1, piezasDePrueba())).toBe(true);
  });

  it('deja de estarlo si alguna de sus piezas está archivada', () => {
    const conT4Archivada = piezasDePrueba().map((p) => (p.id === 't4' ? { ...p, archivada: true } : p));
    expect(estrategiaDisponible(e1, conT4Archivada)).toBe(false);
  });

  it('deja de estarlo si alguna de sus piezas ya no existe', () => {
    expect(estrategiaDisponible(e1, piezasDePrueba().filter((p) => p.id !== 'rc'))).toBe(false);
  });
});

describe('estrategiasParaPlanificar', () => {
  it('no ofrece las estrategias que usan una pieza archivada', () => {
    const conT4Archivada = piezasDePrueba().map((p) => (p.id === 't4' ? { ...p, archivada: true } : p));
    expect(estrategiasParaPlanificar([e1, e2], conT4Archivada, true).map((e) => e.id)).toEqual(['e2']);
  });

  it('filtra por semana con o sin episodio', () => {
    const piezas = piezasDePrueba();
    expect(estrategiasParaPlanificar([e1, e3], piezas, false).map((e) => e.id)).toEqual(['e3']);
    expect(estrategiasParaPlanificar([e1, e2, e3, e4], piezas, true).map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('diaPermitido', () => {
  const t4 = pieza('t4');

  it('acepta un desplazamiento de la lista de la pieza', () => {
    expect(diaPermitido(t4, -1)).toBe(true);
  });

  it('rechaza uno que no está', () => {
    expect(diaPermitido(t4, 2)).toBe(false);
  });
});

describe('proponerNumero', () => {
  it('suma uno al mayor número conservando dos cifras', () => {
    expect(proponerNumero([{ ...plan, numero: '05' }, { ...plan, numero: '04' }])).toBe('06');
    expect(proponerNumero([{ ...plan, numero: '09' }])).toBe('10');
  });

  it('crece a tres cifras cuando hace falta', () => {
    expect(proponerNumero([{ ...plan, numero: '99' }])).toBe('100');
  });

  it('ignora los planes sin número o con un número que no es numérico', () => {
    expect(proponerNumero([{ ...plan, numero: null }, { ...plan, numero: 'piloto' }, { ...plan, numero: '03' }])).toBe('04');
    expect(proponerNumero([{ ...plan, numero: null }, { ...plan, numero: 'piloto' }])).toBe(null);
  });

  it('solo cuenta los planes con episodio', () => {
    const planes = [
      { ...plan, conEpisodio: false, numero: '07' },
      { ...plan, conEpisodio: true, numero: '05' },
    ];
    expect(proponerNumero(planes)).toBe('06');
    expect(proponerNumero([{ ...plan, conEpisodio: false, numero: '07' }])).toBe(null);
  });

  it('devuelve null si no hay planes', () => {
    expect(proponerNumero([])).toBe(null);
  });
});

describe('proponerDiaD', () => {
  it('usa el día de la semana del último plan con episodio', () => {
    expect(proponerDiaD([{ ...plan, conEpisodio: true, diaD: '2026-10-16' }], '2026-10-19')).toBe('2026-10-23');
    // Un episodio del jueves lleva la propuesta al jueves de la semana pedida.
    expect(proponerDiaD([{ ...plan, conEpisodio: true, diaD: '2026-10-15' }], '2026-10-19')).toBe('2026-10-22');
  });

  it('elige el último por fecha y no por posición en la lista', () => {
    const planes = [
      { ...plan, id: 'a', conEpisodio: true, diaD: '2026-10-15' },
      { ...plan, id: 'b', conEpisodio: true, diaD: '2026-10-09' },
    ];
    expect(proponerDiaD(planes, '2026-10-19')).toBe('2026-10-22');
  });

  it('ignora los planes sin episodio', () => {
    const planes = [
      { ...plan, id: 'a', conEpisodio: true, diaD: '2026-10-16' },
      { ...plan, id: 'b', conEpisodio: false, diaD: '2026-10-21' },
    ];
    expect(proponerDiaD(planes, '2026-10-19')).toBe('2026-10-23');
  });

  it('sin historial propone el viernes', () => {
    expect(proponerDiaD([], '2026-10-19')).toBe('2026-10-23');
    expect(proponerDiaD([{ ...plan, conEpisodio: false, diaD: '2026-10-21' }], '2026-10-19')).toBe('2026-10-23');
  });
});
