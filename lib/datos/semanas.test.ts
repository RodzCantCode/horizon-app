import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerSemanas } from '@/lib/datos/semanas';
import type { Tables } from '@/lib/supabase/tipos';

// Cliente de Supabase simulado (vi.mock se eleva por encima de los import): cada consulta apunta las
// llamadas que recibe (select, gte, lte, order) y, al esperarla, devuelve el resultado preparado
// para su tabla.
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
    gte: encadenar('gte'),
    lte: encadenar('lte'),
    order: encadenar('order'),
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve(consulta.resultado).then(resolver, rechazar),
  };
  return constructor;
}

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({ from: consultaSimulada }),
}));

const filaPlan: Tables<'planes'> = {
  id: 'plan05',
  lunes: '2026-10-12',
  dia_d: '2026-10-16',
  con_episodio: true,
  numero: '05',
  invitado: null,
  tema: null,
  estrategia_id: 'e1',
  estrategia_nombre: 'E1 · Anticipación fuerte',
};

const filaPieza: Tables<'plan_piezas'> = {
  id: 'b4',
  plan_id: 'plan05',
  pieza_id: 'rp',
  nombre: 'Clip principal',
  nombre_corto: 'Clip principal',
  formato: 'reel',
  canales: ['ig', 'tiktok', 'shorts'],
  dias_preparacion: 2,
  desplazamiento: 0,
  fecha: '2026-10-16',
  // Postgres devuelve las columnas `time` con segundos.
  hora: '18:00:00',
  estado: 'pendiente',
  revisar: false,
};

function preparar(planes: { data: unknown; error: unknown }, piezas: { data: unknown; error: unknown }) {
  consultas.set('planes', { llamadas: [], resultado: planes });
  consultas.set('plan_piezas', { llamadas: [], resultado: piezas });
}

beforeEach(() => consultas.clear());

describe('leerSemanas', () => {
  it('lee los planes por su lunes y las piezas por su fecha dentro del rango', async () => {
    preparar({ data: [], error: null }, { data: [], error: null });
    await leerSemanas('2026-10-05', '2026-11-01');

    const planes = consultas.get('planes')!.llamadas;
    expect(planes).toContainEqual(['gte', 'lunes', '2026-10-05']);
    expect(planes).toContainEqual(['lte', 'lunes', '2026-11-01']);

    const piezas = consultas.get('plan_piezas')!.llamadas;
    expect(piezas).toContainEqual(['gte', 'fecha', '2026-10-05']);
    expect(piezas).toContainEqual(['lte', 'fecha', '2026-11-01']);
  });

  it('pasa las filas a los tipos de la app, con la hora como HH:MM', async () => {
    preparar(
      { data: [filaPlan], error: null },
      { data: [filaPieza, { ...filaPieza, id: 'b5', hora: null }], error: null },
    );
    const { planes, piezas } = await leerSemanas('2026-10-05', '2026-11-01');

    expect(planes).toEqual([
      {
        id: 'plan05',
        lunes: '2026-10-12',
        diaD: '2026-10-16',
        conEpisodio: true,
        numero: '05',
        invitado: null,
        tema: null,
        estrategiaId: 'e1',
        estrategiaNombre: 'E1 · Anticipación fuerte',
      },
    ]);
    expect(piezas).toEqual([
      {
        id: 'b4',
        planId: 'plan05',
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
      },
      expect.objectContaining({ id: 'b5', hora: null }),
    ]);
  });

  it('si Supabase falla, lanza un error en vez de enseñar semanas vacías', async () => {
    preparar({ data: null, error: { message: 'caído' } }, { data: [], error: null });
    await expect(leerSemanas('2026-10-05', '2026-11-01')).rejects.toThrow('No se han podido leer las semanas');

    preparar({ data: [], error: null }, { data: null, error: { message: 'caído' } });
    await expect(leerSemanas('2026-10-05', '2026-11-01')).rejects.toThrow('No se han podido leer las semanas');
  });

  it('un formato, estado o canal que la app no conoce es un error, no un valor más', async () => {
    preparar({ data: [], error: null }, { data: [{ ...filaPieza, estado: 'publicada' }], error: null });
    await expect(leerSemanas('2026-10-05', '2026-11-01')).rejects.toThrow('«publicada»');

    preparar({ data: [], error: null }, { data: [{ ...filaPieza, canales: ['ig', 'x'] }], error: null });
    await expect(leerSemanas('2026-10-05', '2026-11-01')).rejects.toThrow('«x»');
  });
});
