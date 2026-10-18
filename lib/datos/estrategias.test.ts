import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import type { Tables } from '@/lib/supabase/tipos';

// Cliente de Supabase simulado, como en semanas.test.ts: cada consulta apunta las llamadas que recibe
// y, al esperarla, devuelve el resultado preparado para su tabla.
const consultas = new Map<string, { llamadas: unknown[][]; resultado: { data: unknown; error: unknown } }>();

function consultaSimulada(tabla: string) {
  const consulta = consultas.get(tabla);
  if (!consulta) throw new Error(`Tabla no preparada en la prueba: ${tabla}`);
  const encadenar = (metodo: string) => (...args: unknown[]) => {
    consulta.llamadas.push([metodo, ...args]);
    return constructor;
  };
  const constructor = {
    select: encadenar('select'),
    order: encadenar('order'),
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve(consulta.resultado).then(resolver, rechazar),
  };
  return constructor;
}

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({ from: consultaSimulada }),
}));

const filaClipPrincipal: Tables<'piezas'> = {
  id: 'rp',
  nombre: 'Clip principal',
  nombre_corto: 'Clip principal',
  formato: 'reel',
  canales: ['ig', 'tiktok', 'shorts'],
  dias_permitidos: [0],
  dias_preparacion: 2,
  // Postgres devuelve las columnas `time` con segundos.
  hora_habitual: '18:00:00',
  archivada: false,
};

const filaHistoria: Tables<'piezas'> = {
  id: 't4',
  nombre: 'T4 · Historia del invitado',
  nombre_corto: 'Historia del invitado',
  formato: 'slide',
  canales: ['ig', 'tiktok'],
  dias_permitidos: [-1],
  dias_preparacion: 3,
  hora_habitual: null,
  archivada: true,
};

// La estrategia con sus filas de estrategia_piezas anidadas, sin orden: la base no lo garantiza.
const filaE1 = {
  id: 'e1',
  nombre: 'E1 · Anticipación fuerte',
  con_episodio: true,
  estrategia_piezas: [
    { pieza_id: 'rp', desplazamiento: 0 },
    { pieza_id: 'rc', desplazamiento: 5 },
    { pieza_id: 't4', desplazamiento: -1 },
    { pieza_id: 'rc', desplazamiento: 2 },
  ],
};

function preparar(piezas: { data: unknown; error: unknown }, estrategias: { data: unknown; error: unknown }) {
  consultas.set('piezas', { llamadas: [], resultado: piezas });
  consultas.set('estrategias', { llamadas: [], resultado: estrategias });
}

beforeEach(() => consultas.clear());

describe('leerEstrategiasYPiezas', () => {
  it('pasa las piezas a los tipos de la app, con la hora habitual como HH:MM, archivadas incluidas', async () => {
    preparar({ data: [filaClipPrincipal, filaHistoria], error: null }, { data: [], error: null });
    const { piezas } = await leerEstrategiasYPiezas();

    expect(piezas).toEqual([
      {
        id: 'rp',
        nombre: 'Clip principal',
        nombreCorto: 'Clip principal',
        formato: 'reel',
        canales: ['ig', 'tiktok', 'shorts'],
        diasPermitidos: [0],
        diasPreparacion: 2,
        horaHabitual: '18:00',
        archivada: false,
      },
      expect.objectContaining({ id: 't4', horaHabitual: null, archivada: true }),
    ]);
  });

  it('pasa las estrategias con sus piezas en orden de día, de D-1 a D+5', async () => {
    preparar({ data: [], error: null }, { data: [filaE1], error: null });
    const { estrategias } = await leerEstrategiasYPiezas();

    expect(estrategias).toEqual([
      {
        id: 'e1',
        nombre: 'E1 · Anticipación fuerte',
        conEpisodio: true,
        items: [
          { piezaId: 't4', desplazamiento: -1 },
          { piezaId: 'rp', desplazamiento: 0 },
          { piezaId: 'rc', desplazamiento: 2 },
          { piezaId: 'rc', desplazamiento: 5 },
        ],
      },
    ]);
    expect(consultas.get('estrategias')!.llamadas).toContainEqual(['order', 'nombre']);
  });

  it('si Supabase falla, lanza un error', async () => {
    preparar({ data: null, error: { message: 'caído' } }, { data: [], error: null });
    await expect(leerEstrategiasYPiezas()).rejects.toThrow('No se han podido leer las estrategias');

    preparar({ data: [], error: null }, { data: null, error: { message: 'caído' } });
    await expect(leerEstrategiasYPiezas()).rejects.toThrow('No se han podido leer las estrategias');
  });

  it('un formato o un canal que la app no conoce es un error, no un valor más', async () => {
    preparar({ data: [{ ...filaClipPrincipal, formato: 'story' }], error: null }, { data: [], error: null });
    await expect(leerEstrategiasYPiezas()).rejects.toThrow('«story»');

    preparar({ data: [{ ...filaClipPrincipal, canales: ['ig', 'x'] }], error: null }, { data: [], error: null });
    await expect(leerEstrategiasYPiezas()).rejects.toThrow('«x»');
  });
});
