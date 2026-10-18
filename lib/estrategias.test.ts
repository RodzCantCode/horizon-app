import { describe, expect, it } from 'vitest';
import {
  estrategiasQueUsan,
  motivoNoDisponible,
  piezasParaAnadir,
  preguntaArchivar,
  resumenPieza,
  textoDias,
} from '@/lib/estrategias';
import type { Estrategia, Pieza } from '@/lib/tipos';

// Piezas y estrategias del prototipo (`prototipo/index.html`), como en lib/planes.test.ts.
const TODOS = [-1, 0, 1, 2, 3, 4, 5];

function piezasDePrueba(cambios: Record<string, Partial<Pieza>> = {}): Pieza[] {
  return [
    { id: 't1', nombre: 'T1 · Próximos invitados', nombreCorto: 'Próximos invitados', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [4, 5], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 't2', nombre: 'T2 · Valor + CTA', nombreCorto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [1, 2, 3, 4], diasPreparacion: 3, horaHabitual: null, archivada: false },
    { id: 't3', nombre: 'T3 · Frases de invitados', nombreCorto: 'Frases de invitados', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [...TODOS], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 't4', nombre: 'T4 · Historia del invitado', nombreCorto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], diasPermitidos: [-1], diasPreparacion: 3, horaHabitual: null, archivada: false },
    { id: 'rp', nombre: 'Clip principal', nombreCorto: 'Clip principal', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [0], diasPreparacion: 2, horaHabitual: '18:00', archivada: false },
    { id: 'rc', nombre: 'Clip secundario', nombreCorto: 'Clip secundario', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [1, 2, 3, 4, 5], diasPreparacion: 2, horaHabitual: null, archivada: false },
    { id: 'rt', nombre: 'Teaser', nombreCorto: 'Teaser', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], diasPermitidos: [-1], diasPreparacion: 2, horaHabitual: null, archivada: false },
  ].map((p) => ({ ...p, ...cambios[p.id] }) as Pieza);
}

function estrategia(id: string, nombre: string, conEpisodio: boolean, items: [string, number][]): Estrategia {
  return { id, nombre, conEpisodio, items: items.map(([piezaId, desplazamiento]) => ({ piezaId, desplazamiento })) };
}

const e1 = estrategia('e1', 'E1 · Anticipación fuerte', true, [['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]);
const e2 = estrategia('e2', 'E2 · Valor primero', true, [['rt', -1], ['rp', 0], ['t2', 1], ['t3', 4], ['rc', 5]]);
const e3 = estrategia('e3', 'E3 · Recopilación', false, [['t3', -1], ['t1', 5]]);

describe('textoDias', () => {
  it('pone los días sueltos uno a uno, de D-1 a D+5', () => {
    expect(textoDias([0])).toBe('D');
    expect(textoDias([-1])).toBe('D-1');
    expect(textoDias([5, 4])).toBe('D+4, D+5');
  });

  it('junta tres o más días seguidos en un tramo', () => {
    expect(textoDias([-1, 0, 1, 2, 3, 4, 5])).toBe('D-1 a D+5');
    expect(textoDias([1, 2, 3, 4])).toBe('D+1 a D+4');
    expect(textoDias([-1, 1, 2, 3, 5])).toBe('D-1, D+1 a D+3, D+5');
  });
});

describe('resumenPieza', () => {
  it('formato, canales, días, preparación y hora en una línea', () => {
    const [, t2, , , rp] = piezasDePrueba();
    expect(resumenPieza(t2)).toBe('Carrusel · Instagram, TikTok · D+1 a D+4 · 3 días de preparación · sin hora');
    expect(resumenPieza(rp)).toBe('Reel · Instagram, TikTok, Shorts · D · 2 días de preparación · 18:00');
  });
});

describe('motivoNoDisponible', () => {
  it('una estrategia sin piezas archivadas está disponible', () => {
    expect(motivoNoDisponible(e1, piezasDePrueba())).toBeNull();
  });

  it('dice qué piezas archivadas usa, cada una una vez', () => {
    expect(motivoNoDisponible(e2, piezasDePrueba({ rt: { archivada: true } }))).toBe(
      'No disponible: Teaser está archivada',
    );
    expect(
      motivoNoDisponible(e1, piezasDePrueba({ t4: { archivada: true }, rc: { archivada: true } })),
    ).toBe('No disponible: T4 · Historia del invitado y Clip secundario están archivadas');
  });

  it('una estrategia sin piezas tampoco está disponible, y lo dice', () => {
    expect(motivoNoDisponible({ ...e1, items: [] }, piezasDePrueba())).toBe('No disponible: no tiene piezas');
  });

  it('si una de sus piezas ya no existe, también lo dice', () => {
    const conPiezaBorrada = estrategia('e9', 'E9', true, [['borrada', 0]]);
    expect(motivoNoDisponible(conPiezaBorrada, piezasDePrueba())).toBe('No disponible: usa una pieza que ya no existe');
  });
});

describe('estrategiasQueUsan', () => {
  it('las estrategias que tienen la pieza en algún día', () => {
    expect(estrategiasQueUsan('rp', [e1, e2, e3]).map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(estrategiasQueUsan('t1', [e1, e2, e3]).map((e) => e.id)).toEqual(['e3']);
    expect(estrategiasQueUsan('rt', [e1, e3])).toEqual([]);
  });
});

describe('preguntaArchivar', () => {
  it('cuenta cuántas estrategias dejarán de ofrecerse', () => {
    expect(preguntaArchivar(1)).toBe('La usa 1 estrategia, que dejará de ofrecerse al planificar. ¿Archivar igualmente?');
    expect(preguntaArchivar(3)).toBe('La usan 3 estrategias, que dejarán de ofrecerse al planificar. ¿Archivar igualmente?');
  });
});

describe('piezasParaAnadir', () => {
  it('solo las no archivadas que admiten ese día y que no están ya en él', () => {
    const piezas = piezasDePrueba({ t3: { archivada: true } });
    // D-1 admite T3 (archivada), T4 (ya está) y Teaser.
    expect(piezasParaAnadir(piezas, e1.items, -1).map((p) => p.id)).toEqual(['rt']);
    // D+4 admite T1, T2 (ya está), T3 (archivada) y el clip secundario.
    expect(piezasParaAnadir(piezas, e1.items, 4).map((p) => p.id)).toEqual(['t1', 'rc']);
  });
});
