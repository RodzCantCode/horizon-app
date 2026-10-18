import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  escrituras,
  fallos,
  filaDe,
  filasEstrategiaPiezas,
  filasPiezas,
  llamadasRpc,
  prepararBase,
  tablas,
} from '@/lib/pruebas/baseSimulada';
import type { Estrategia, Pieza } from '@/lib/tipos';
import { archivarPieza, guardarEstrategia, guardarPieza } from './acciones';

// Las acciones hablan con la base simulada en memoria de lib/pruebas/baseSimulada.ts (con las
// piezas y las estrategias E1, E2 y E3 del prototipo), no con Supabase.
vi.mock('@/lib/supabase/servidor', async () => {
  const { clienteSimulado } = await import('@/lib/pruebas/baseSimulada');
  return { crearClienteServidor: async () => clienteSimulado };
});

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh }));

const NO_GUARDADO = 'No se ha podido guardar. Vuelve a intentarlo.';

beforeEach(() => {
  prepararBase();
  refresh.mockClear();
});

/** Las piezas de una estrategia en la base, como [pieza, desplazamiento]. */
const itemsDe = (estrategiaId: string) =>
  (tablas.get('estrategia_piezas') ?? [])
    .filter((i) => i.estrategia_id === estrategiaId)
    .map((i) => [i.pieza_id, i.desplazamiento]);

function items(...lista: [string, number][]): Estrategia['items'] {
  return lista.map(([piezaId, desplazamiento]) => ({ piezaId, desplazamiento }));
}

describe('guardarEstrategia', () => {
  const e1 = {
    id: 'e1',
    nombre: 'E1 · Anticipación fuerte',
    conEpisodio: true,
    items: items(['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]),
  };

  it('una pieza en un día que no admite no se guarda', async () => {
    tablas.set('piezas', filasPiezas({ t4: { dias_permitidos: [-1] } }));

    expect(await guardarEstrategia({ ...e1, items: items(['t4', 0]) })).toEqual({
      error: 'Esa pieza no puede ir ese día',
    });
    expect(escrituras).toEqual([]);
  });

  it('un día fuera de D-1…D+5 tampoco', async () => {
    expect(await guardarEstrategia({ ...e1, items: items(['t3', 6]) })).toEqual({
      error: 'Esa pieza no puede ir ese día',
    });
    expect(await guardarEstrategia({ ...e1, items: items(['t3', -2]) })).toEqual({
      error: 'Esa pieza no puede ir ese día',
    });
    expect(escrituras).toEqual([]);
  });

  it('sin nombre no se guarda', async () => {
    expect(await guardarEstrategia({ ...e1, nombre: '   ' })).toEqual({ error: 'Falta el nombre' });
    expect(escrituras).toEqual([]);
  });

  it('sin ninguna pieza no se guarda', async () => {
    expect(await guardarEstrategia({ ...e1, items: [] })).toEqual({ error: 'Pon al menos una pieza' });
    expect(escrituras).toEqual([]);
  });

  it('al editarla cambia su nombre y su tipo y sustituye sus piezas, solo las suyas', async () => {
    const cambiada = { ...e1, nombre: '  E1 · Nueva  ', conEpisodio: false, items: items(['t3', -1], ['ra', 3]) };

    expect(await guardarEstrategia(cambiada)).toEqual({});
    expect(filaDe('estrategias', 'e1')).toEqual({ id: 'e1', nombre: 'E1 · Nueva', con_episodio: false });
    expect(itemsDe('e1')).toEqual([['t3', -1], ['ra', 3]]);
    // Las de las otras estrategias siguen igual.
    const deOtras = (filas: Record<string, unknown>[]) => filas.filter((i) => i.estrategia_id !== 'e1');
    expect(deOtras(tablas.get('estrategia_piezas')!)).toEqual(deOtras(filasEstrategiaPiezas()));
    expect(escrituras.map(({ tabla, operacion, filtros }) => [tabla, operacion, filtros])).toEqual([
      ['estrategias', 'update', [['id', 'e1']]],
      ['estrategia_piezas', 'delete', [['estrategia_id', 'e1']]],
      ['estrategia_piezas', 'insert', []],
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una nueva se crea con sus piezas', async () => {
    const nueva = { nombre: 'E5 · Prueba', conEpisodio: true, items: items(['rp', 0], ['rc', 1]) };

    expect(await guardarEstrategia(nueva)).toEqual({});
    const creada = tablas.get('estrategias')!.find((e) => e.nombre === 'E5 · Prueba');
    expect(creada).toEqual(expect.objectContaining({ con_episodio: true }));
    expect(itemsDe(creada!.id as string)).toEqual([['rp', 0], ['rc', 1]]);
    expect(escrituras.map(({ tabla, operacion }) => [tabla, operacion])).toEqual([
      ['estrategias', 'insert'],
      ['estrategia_piezas', 'insert'],
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('puede seguir llevando una pieza archivada que ya tenía (y seguirá sin ofrecerse)', async () => {
    tablas.set('piezas', filasPiezas({ t4: { archivada: true } }));

    expect(await guardarEstrategia({ ...e1, nombre: 'E1 · Renombrada' })).toEqual({});
    expect(filaDe('estrategias', 'e1')).toHaveProperty('nombre', 'E1 · Renombrada');
    // Se ha vuelto a escribir con la pieza archivada dentro, no se ha quedado como estaba.
    expect(escrituras.map(({ tabla, operacion }) => [tabla, operacion])).toEqual([
      ['estrategias', 'update'],
      ['estrategia_piezas', 'delete'],
      ['estrategia_piezas', 'insert'],
    ]);
    expect(itemsDe('e1')).toEqual([['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]);
  });

  it('no deja añadir una pieza archivada que no tenía, y refresca', async () => {
    // El teaser se archivó mientras alguien editaba E1 y lo añade al guardar.
    tablas.set('piezas', filasPiezas({ rt: { archivada: true } }));

    expect(await guardarEstrategia({ ...e1, items: [...e1.items, ...items(['rt', -1])] })).toEqual({
      error: 'Esa pieza está archivada',
    });
    expect(escrituras).toEqual([]);
    expect(itemsDe('e1')).toEqual([['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una nueva no puede llevar ninguna pieza archivada', async () => {
    tablas.set('piezas', filasPiezas({ rt: { archivada: true } }));

    expect(await guardarEstrategia({ nombre: 'E5', conEpisodio: true, items: items(['rt', -1]) })).toEqual({
      error: 'Esa pieza está archivada',
    });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('la misma pieza dos veces el mismo día no se guarda', async () => {
    expect(await guardarEstrategia({ ...e1, items: items(['rp', 0], ['rc', 2], ['rp', 0]) })).toEqual({
      error: 'Esa pieza ya está en ese día',
    });
    expect(escrituras).toEqual([]);
    // En días distintos, sí (E1 lleva el clip secundario en D+2 y D+5).
    expect(await guardarEstrategia(e1)).toEqual({});
  });

  it('si la estrategia ya no existe, lo dice, refresca y no toca piezas', async () => {
    expect(await guardarEstrategia({ ...e1, id: 'borrada' })).toEqual({ error: 'Esa estrategia ya no existe' });
    expect(escrituras.map(({ tabla }) => tabla)).toEqual(['estrategias']);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si una de sus piezas ya no existe, lo dice, refresca y no escribe', async () => {
    expect(await guardarEstrategia({ ...e1, items: items(['borrada', 0]) })).toEqual({
      error: 'Esa pieza ya no existe',
    });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si fallan las piezas tras borrar las de antes, da el error legible y refresca', async () => {
    // Sin transacción: la estrategia queda sin piezas hasta que se vuelva a guardar (ver acciones.ts).
    fallos.set('estrategia_piezas.insert', { code: '08006', message: 'connection failure' });

    expect(await guardarEstrategia(e1)).toEqual({ error: NO_GUARDADO });
    expect(itemsDe('e1')).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si Supabase falla al leer las piezas, da el error legible sin escribir', async () => {
    fallos.set('piezas', { code: '42501', message: 'permission denied for table piezas' });

    expect(await guardarEstrategia(e1)).toEqual({ error: NO_GUARDADO });
    expect(escrituras).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('guardarPieza', () => {
  // El clip principal del prototipo como lo manda el panel.
  const clip: Omit<Pieza, 'archivada'> = {
    id: 'rp',
    nombre: 'Clip principal',
    nombreCorto: 'Clip principal',
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    diasPermitidos: [-1, 0, 1, 2, 3, 4, 5],
    diasPreparacion: 2,
    horaHabitual: '18:00',
  };

  it('una hora que no es una hora no se guarda', async () => {
    for (const horaHabitual of ['25:00', '18.00', 'tarde']) {
      expect(await guardarPieza({ ...clip, horaHabitual })).toEqual({ error: 'Esa hora no es válida' });
    }
    expect(escrituras).toEqual([]);
  });

  it('al editarla cambia sus datos en snake_case, sin tocar si está archivada', async () => {
    const cambios = {
      ...clip,
      nombre: ' Clip principal largo ',
      nombreCorto: 'Clip largo',
      canales: ['shorts', 'ig'] as Pieza['canales'],
      diasPermitidos: [1, 0],
      diasPreparacion: 4,
      horaHabitual: '9:30',
    };

    expect(await guardarPieza(cambios)).toEqual({});
    expect(escrituras).toEqual([
      {
        tabla: 'piezas',
        operacion: 'update',
        valores: {
          nombre: 'Clip principal largo',
          nombre_corto: 'Clip largo',
          formato: 'reel',
          canales: ['ig', 'shorts'],
          dias_permitidos: [0, 1],
          dias_preparacion: 4,
          hora_habitual: '09:30',
        },
        filtros: [['id', 'rp']],
      },
    ]);
    expect(filaDe('piezas', 'rp')).toHaveProperty('archivada', false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una hora vacía es sin hora (null)', async () => {
    expect(await guardarPieza({ ...clip, horaHabitual: '' })).toEqual({});
    expect(filaDe('piezas', 'rp')).toHaveProperty('hora_habitual', null);
    expect(await guardarPieza({ ...clip, horaHabitual: null })).toEqual({});
    expect(filaDe('piezas', 'rp')).toHaveProperty('hora_habitual', null);
  });

  it('una nueva se crea sin archivar', async () => {
    const nueva = { ...clip, id: undefined, nombre: 'Clip vertical', nombreCorto: 'Vertical', diasPermitidos: [2] };

    expect(await guardarPieza(nueva)).toEqual({});
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toEqual(expect.objectContaining({ tabla: 'piezas', operacion: 'insert' }));
    expect(escrituras[0].valores).not.toHaveProperty('archivada');
    expect(tablas.get('piezas')!.find((p) => p.nombre === 'Clip vertical')).toEqual(
      expect.objectContaining({ nombre_corto: 'Vertical', dias_permitidos: [2], hora_habitual: '18:00' }),
    );
  });

  it('sin nombre o sin nombre corto no se guarda', async () => {
    expect(await guardarPieza({ ...clip, nombre: ' ' })).toEqual({ error: 'Falta el nombre' });
    expect(await guardarPieza({ ...clip, nombreCorto: '' })).toEqual({ error: 'Falta el nombre corto' });
    expect(escrituras).toEqual([]);
  });

  it('el formato, los canales y los días tienen que ser de los que hay', async () => {
    expect(await guardarPieza({ ...clip, formato: 'story' as Pieza['formato'] })).toEqual({ error: 'Elige el formato' });
    expect(await guardarPieza({ ...clip, canales: [] })).toEqual({ error: 'Elige al menos un canal' });
    expect(await guardarPieza({ ...clip, canales: ['ig', 'x' as Pieza['canales'][number]] })).toEqual({
      error: 'Ese canal no es válido',
    });
    expect(await guardarPieza({ ...clip, diasPermitidos: [] })).toEqual({ error: 'Elige al menos un día' });
    expect(await guardarPieza({ ...clip, diasPermitidos: [0, 6] })).toEqual({
      error: 'Los días tienen que estar entre D-1 y D+5',
    });
    expect(escrituras).toEqual([]);
  });

  it('los días de preparación son un entero, 0 o más', async () => {
    for (const diasPreparacion of [-1, 1.5, Number.NaN]) {
      expect(await guardarPieza({ ...clip, diasPreparacion })).toEqual({
        error: 'Los días de preparación tienen que ser un número entero, 0 o más',
      });
    }
    expect(await guardarPieza({ ...clip, diasPreparacion: 0 })).toEqual({});
  });

  it('no deja quitar un día en el que una estrategia la usa', async () => {
    // E1 lleva la historia del invitado en D-1.
    const t4 = { ...clip, id: 't4', nombre: 'T4 · Historia del invitado', nombreCorto: 'Historia del invitado' };

    expect(await guardarPieza({ ...t4, diasPermitidos: [0] })).toEqual({
      error: 'Una estrategia la usa en un día que quitas: cámbiala antes',
    });
    expect(escrituras).toEqual([]);
    expect(await guardarPieza({ ...t4, diasPermitidos: [-1, 0] })).toEqual({});
  });

  it('si la pieza ya no existe, lo dice y refresca', async () => {
    expect(await guardarPieza({ ...clip, id: 'borrada' })).toEqual({ error: 'Esa pieza ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('archivarPieza', () => {
  const original = () => filasPiezas().find((p) => p.id === 'rt');

  it('archivar y recuperar cambian solo archivada', async () => {
    expect(await archivarPieza('rt', true, true)).toEqual({});
    expect(filaDe('piezas', 'rt')).toEqual({ ...original(), archivada: true });

    expect(await archivarPieza('rt', false)).toEqual({});
    expect(filaDe('piezas', 'rt')).toEqual(original());

    expect(escrituras).toEqual([
      { tabla: 'piezas', operacion: 'update', valores: { archivada: true }, filtros: [['id', 'rt']] },
      { tabla: 'piezas', operacion: 'update', valores: { archivada: false }, filtros: [['id', 'rt']] },
    ]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('si la usa alguna estrategia, sin confirmar no la archiva y pide confirmación', async () => {
    // El teaser va en E2.
    expect(await archivarPieza('rt', true)).toEqual({ error: 'confirmar' });
    expect(escrituras).toEqual([]);
    expect(filaDe('piezas', 'rt')).toHaveProperty('archivada', false);
    // Refresca para que el panel cuente bien las estrategias que la usan.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si no la usa ninguna, no hace falta confirmar', async () => {
    tablas.set('estrategia_piezas', filasEstrategiaPiezas().filter((i) => i.pieza_id !== 'rt'));

    expect(await archivarPieza('rt', true)).toEqual({});
    expect(filaDe('piezas', 'rt')).toHaveProperty('archivada', true);
  });

  it('recuperarla no pide confirmación aunque la usen', async () => {
    tablas.set('piezas', filasPiezas({ rt: { archivada: true } }));

    expect(await archivarPieza('rt', false)).toEqual({});
    expect(filaDe('piezas', 'rt')).toHaveProperty('archivada', false);
  });

  it('si la pieza ya no existe, lo dice y refresca', async () => {
    expect(await archivarPieza('borrada', true, true)).toEqual({ error: 'Esa pieza ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si Supabase falla, da un error legible y no refresca', async () => {
    fallos.set('piezas', { code: '42501', message: 'permission denied for table piezas' });

    expect(await archivarPieza('rt', true, true)).toEqual({ error: NO_GUARDADO });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('editar estrategias y piezas no toca los planes', () => {
  it('ninguna acción escribe en planes ni en plan_piezas ni llama a sus funciones', async () => {
    const plan = { id: 'plan-1', lunes: '2026-10-19', dia_d: '2026-10-23', estrategia_id: 'e1' };
    const copia = { id: 'pp-1', plan_id: 'plan-1', pieza_id: 'rp', nombre: 'Clip principal', hora: '18:00:00' };
    tablas.set('planes', [{ ...plan }]);
    tablas.set('plan_piezas', [{ ...copia }]);

    expect(
      await guardarEstrategia({ id: 'e1', nombre: 'E1 · Otra', conEpisodio: true, items: items(['rp', 0]) }),
    ).toEqual({});
    expect(
      await guardarPieza({
        id: 'rp',
        nombre: 'Clip principal nuevo',
        nombreCorto: 'Clip nuevo',
        formato: 'reel',
        canales: ['ig'],
        diasPermitidos: [0],
        diasPreparacion: 1,
        horaHabitual: '20:00',
      }),
    ).toEqual({});
    expect(await archivarPieza('rp', true, true)).toEqual({});
    expect(await archivarPieza('rp', false)).toEqual({});

    expect(escrituras.map((e) => e.tabla)).not.toContain('planes');
    expect(escrituras.map((e) => e.tabla)).not.toContain('plan_piezas');
    expect(llamadasRpc).toEqual([]);
    expect(tablas.get('planes')).toEqual([plan]);
    expect(tablas.get('plan_piezas')).toEqual([copia]);
  });
});
