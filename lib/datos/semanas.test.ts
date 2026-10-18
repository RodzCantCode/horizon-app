import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerPiezaDePlan, leerPlanDeSemana, leerPlanes, leerSemanas } from '@/lib/datos/semanas';
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
    eq: encadenar('eq'),
    gte: encadenar('gte'),
    lte: encadenar('lte'),
    order: encadenar('order'),
    maybeSingle: encadenar('maybeSingle'),
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

describe('leerPiezaDePlan', () => {
  const ID = 'b4b4b4b4-0000-4000-8000-000000000004';

  it('lee la pieza por su id con su plan y las pasa a los tipos de la app', async () => {
    preparar({ data: [], error: null }, { data: { ...filaPieza, id: ID, planes: filaPlan }, error: null });
    const leida = await leerPiezaDePlan(ID);

    expect(consultas.get('plan_piezas')!.llamadas).toContainEqual(['eq', 'id', ID]);
    expect(leida?.pieza).toEqual(expect.objectContaining({ id: ID, planId: 'plan05', hora: '18:00' }));
    expect(leida?.plan).toEqual(expect.objectContaining({ id: 'plan05', diaD: '2026-10-16', numero: '05' }));
  });

  it('si no existe (otra persona la ha quitado), devuelve null', async () => {
    preparar({ data: [], error: null }, { data: null, error: null });
    expect(await leerPiezaDePlan(ID)).toBe(null);
  });

  it('un id que no es un uuid (URL escrita a mano) es una pieza que no existe, sin preguntar a la base', async () => {
    preparar({ data: [], error: null }, { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } });
    expect(await leerPiezaDePlan('no-es-un-id')).toBe(null);
    expect(consultas.get('plan_piezas')!.llamadas).toEqual([]);
  });

  it('si Supabase falla, lanza un error', async () => {
    preparar({ data: [], error: null }, { data: null, error: { message: 'caído' } });
    await expect(leerPiezaDePlan(ID)).rejects.toThrow('No se ha podido leer la pieza');
  });
});

describe('leerPlanes', () => {
  it('lee todos los planes por orden de semana y los pasa a los tipos de la app', async () => {
    preparar({ data: [filaPlan], error: null }, { data: [], error: null });
    const planes = await leerPlanes();

    expect(consultas.get('planes')!.llamadas).toContainEqual(['order', 'lunes']);
    expect(planes).toEqual([expect.objectContaining({ id: 'plan05', lunes: '2026-10-12', diaD: '2026-10-16', numero: '05' })]);
  });

  it('si Supabase falla, lanza un error', async () => {
    preparar({ data: null, error: { message: 'caído' } }, { data: [], error: null });
    await expect(leerPlanes()).rejects.toThrow('No se han podido leer los planes');
  });
});

describe('leerPlanDeSemana', () => {
  it('lee el plan de ese lunes con sus piezas, ordenadas por fecha y hora (sin hora al final)', async () => {
    const piezas = [
      { ...filaPieza, id: 'b6', fecha: '2026-10-18', hora: null },
      { ...filaPieza, id: 'b5', fecha: '2026-10-16', hora: null },
      filaPieza,
      { ...filaPieza, id: 'b3', fecha: '2026-10-15', hora: '20:00:00' },
    ];
    preparar({ data: { ...filaPlan, plan_piezas: piezas }, error: null }, { data: [], error: null });
    const leido = await leerPlanDeSemana('2026-10-12');

    expect(consultas.get('planes')!.llamadas).toContainEqual(['eq', 'lunes', '2026-10-12']);
    expect(leido?.plan).toEqual(expect.objectContaining({ id: 'plan05', diaD: '2026-10-16', numero: '05' }));
    expect(leido?.piezas.map((p) => [p.id, p.hora])).toEqual([
      ['b3', '20:00'],
      ['b4', '18:00'],
      ['b5', null],
      ['b6', null],
    ]);
  });

  it('si esa semana no tiene plan (o otra persona lo ha movido), devuelve null', async () => {
    preparar({ data: null, error: null }, { data: [], error: null });
    expect(await leerPlanDeSemana('2026-10-12')).toBe(null);
  });

  it('si Supabase falla, lanza un error', async () => {
    preparar({ data: null, error: { message: 'caído' } }, { data: [], error: null });
    await expect(leerPlanDeSemana('2026-10-12')).rejects.toThrow('No se ha podido leer la semana');
  });
});
