import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tables } from '@/lib/supabase/tipos';
import {
  anadirPiezaSuelta,
  cambiarEstrategiaDePlan,
  crearPlan,
  editarEpisodio,
  editarPiezaDePlan,
  marcarEstado,
  moverSemana,
  quitarPiezaDePlan,
} from './acciones';

// Base de datos simulada en memoria, con lo que las acciones usan del cliente de Supabase: from(tabla)
// con select (y una tabla anidada: «*, planes(*)» o «…, plan_piezas(estado)»), insert, update,
// delete, eq, order y maybeSingle; y rpc. Se porta como PostgREST en lo que importa aquí: update y
// delete tocan solo las filas que cumplen los filtros y devuelven las tocadas. Así la prueba mira cómo
// queda la base, no solo qué se pidió. vi.mock se eleva por encima de los import; las funciones de
// dentro leen `tablas`, `fallos` y `respuestaRpc` al llamarse, no al definirse.
type Fila = Record<string, unknown>;
type ErrorBase = { code: string; message: string };
type Escritura = { tabla: string; operacion: 'insert' | 'update' | 'delete'; valores?: Fila; filtros: [string, unknown][] };

const tablas = new Map<string, Fila[]>();
/** Tablas cuya próxima consulta (cualquiera) falla con ese error. */
const fallos = new Map<string, ErrorBase>();
/** Lo que se ha pedido escribir, en orden. */
const escrituras: Escritura[] = [];

function consulta(tabla: string) {
  let operacion: 'select' | Escritura['operacion'] = 'select';
  let valores: Fila | undefined;
  let anidada: string | null = null;
  let una = false;
  const filtros: [string, unknown][] = [];
  const cumple = (fila: Fila) => filtros.every(([columna, valor]) => fila[columna] === valor);

  // La tabla anidada se pega como la da PostgREST: un plan dentro de su pieza, las piezas dentro de
  // su plan. Las estrategias ya llevan sus estrategia_piezas en la fila preparada.
  function conAnidada(fila: Fila): Fila {
    if (anidada === 'planes') {
      return { ...fila, planes: tablas.get('planes')?.find((p) => p.id === fila.plan_id) ?? null };
    }
    if (anidada === 'plan_piezas') {
      return { ...fila, plan_piezas: (tablas.get('plan_piezas') ?? []).filter((p) => p.plan_id === fila.id) };
    }
    return { ...fila };
  }

  function ejecutar(): { data: unknown; error: ErrorBase | null } {
    if (operacion !== 'select') escrituras.push({ tabla, operacion, valores, filtros });
    const fallo = fallos.get(tabla);
    if (fallo) return { data: null, error: fallo };

    const filas = tablas.get(tabla) ?? [];
    if (operacion === 'select') {
      const elegidas = filas.filter(cumple).map(conAnidada);
      return { data: una ? (elegidas[0] ?? null) : elegidas, error: null };
    }
    if (operacion === 'update') {
      const elegidas = filas.filter(cumple);
      for (const fila of elegidas) Object.assign(fila, valores);
      return { data: elegidas.map((fila) => ({ ...fila })), error: null };
    }
    if (operacion === 'delete') {
      tablas.set(tabla, filas.filter((fila) => !cumple(fila)));
      return { data: filas.filter(cumple), error: null };
    }
    const nueva = { id: `nueva-${filas.length + 1}`, ...valores };
    tablas.set(tabla, [...filas, nueva]);
    return { data: [nueva], error: null };
  }

  const constructor = {
    select(columnas = '*') {
      anidada = /(planes|plan_piezas)\(/.exec(columnas)?.[1] ?? null;
      return constructor;
    },
    insert(fila: Fila) {
      operacion = 'insert';
      valores = fila;
      return constructor;
    },
    update(cambios: Fila) {
      operacion = 'update';
      valores = cambios;
      return constructor;
    },
    delete() {
      operacion = 'delete';
      return constructor;
    },
    eq(columna: string, valor: unknown) {
      filtros.push([columna, valor]);
      return constructor;
    },
    order: () => constructor,
    maybeSingle() {
      una = true;
      return constructor;
    },
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve().then(ejecutar).then(resolver, rechazar),
  };
  return constructor;
}

// Llamadas a funciones de la base (rpc) y lo que responde la próxima.
const llamadasRpc: [string, Record<string, unknown>][] = [];
let respuestaRpc: { data: unknown; error: ErrorBase | null } = { data: null, error: null };

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({
    from: consulta,
    rpc: async (funcion: string, argumentos: Record<string, unknown>) => {
      llamadasRpc.push([funcion, argumentos]);
      return respuestaRpc;
    },
  }),
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh }));

// Piezas y estrategias en la base, como las da PostgREST: la estrategia con sus filas de
// estrategia_piezas anidadas y las horas con segundos. Son las del prototipo (E1, E2 y E3), con
// hora habitual solo en el clip principal.
function filaPieza(cambios: Partial<Tables<'piezas'>> & Pick<Tables<'piezas'>, 'id' | 'nombre'>): Tables<'piezas'> {
  return {
    nombre_corto: cambios.nombre,
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    dias_permitidos: [-1, 0, 1, 2, 3, 4, 5],
    dias_preparacion: 2,
    hora_habitual: null,
    archivada: false,
    ...cambios,
  };
}

function filasPiezas(cambios: Record<string, Partial<Tables<'piezas'>>> = {}): Tables<'piezas'>[] {
  return [
    filaPieza({ id: 't1', nombre: 'T1 · Próximos invitados', nombre_corto: 'Próximos invitados', formato: 'slide', canales: ['ig', 'tiktok'] }),
    filaPieza({ id: 't2', nombre: 'T2 · Valor + CTA', nombre_corto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3 }),
    filaPieza({ id: 't3', nombre: 'T3 · Frases de invitados', nombre_corto: 'Frases de invitados', formato: 'slide', canales: ['ig', 'tiktok'] }),
    filaPieza({ id: 't4', nombre: 'T4 · Historia del invitado', nombre_corto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3 }),
    filaPieza({ id: 'rp', nombre: 'Clip principal', hora_habitual: '18:00:00' }),
    filaPieza({ id: 'rc', nombre: 'Clip secundario' }),
    filaPieza({ id: 'rt', nombre: 'Teaser' }),
    filaPieza({ id: 'ra', nombre: 'Clip de archivo', dias_preparacion: 1 }),
  ].map((fila) => ({ ...fila, ...cambios[fila.id] }));
}

function filaEstrategia(id: string, nombre: string, conEpisodio: boolean, items: [string, number][]) {
  return {
    id,
    nombre,
    con_episodio: conEpisodio,
    estrategia_piezas: items.map(([pieza_id, desplazamiento]) => ({ pieza_id, desplazamiento })),
  };
}

const filasEstrategias = [
  filaEstrategia('e1', 'E1 · Anticipación fuerte', true, [['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]),
  filaEstrategia('e2', 'E2 · Valor primero', true, [['rt', -1], ['rp', 0], ['t2', 1], ['t3', 4], ['rc', 5]]),
  filaEstrategia('e3', 'E3 · Recopilación', false, [['t3', -1], ['ra', 1], ['ra', 4], ['t1', 5]]),
];

// Un plan en la base: el episodio 06, semana del lunes 19 de octubre de 2026 y día D el viernes 23,
// con la estrategia E1. Los ids de las piezas de plan son uuid porque así los lee leerPiezaDePlan.
const PLAN = 'a0a0a0a0-0000-4000-8000-000000000001';
const CLIP = 'b1b1b1b1-0000-4000-8000-000000000001';
const T4 = 'b1b1b1b1-0000-4000-8000-000000000002';

function filaPlan(cambios: Partial<Tables<'planes'>> = {}): Tables<'planes'> {
  return {
    id: PLAN,
    lunes: '2026-10-19',
    dia_d: '2026-10-23',
    con_episodio: true,
    numero: '06',
    invitado: 'Invitada de prueba',
    tema: null,
    estrategia_id: 'e1',
    estrategia_nombre: 'E1 · Anticipación fuerte',
    ...cambios,
  };
}

/** El clip principal del plan, en D a las 18:00 (la base da las horas con segundos). */
function filaPiezaDePlan(cambios: Partial<Tables<'plan_piezas'>> = {}): Tables<'plan_piezas'> {
  return {
    id: CLIP,
    plan_id: PLAN,
    pieza_id: 'rp',
    nombre: 'Clip principal',
    nombre_corto: 'Clip principal',
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    dias_preparacion: 2,
    desplazamiento: 0,
    fecha: '2026-10-23',
    hora: '18:00:00',
    estado: 'pendiente',
    revisar: false,
    ...cambios,
  };
}

const filaDe = (tabla: string, id: string) => tablas.get(tabla)?.find((f) => f.id === id);

beforeEach(() => {
  tablas.clear();
  tablas.set('piezas', filasPiezas());
  tablas.set('estrategias', filasEstrategias.map((e) => ({ ...e })));
  tablas.set('planes', []);
  tablas.set('plan_piezas', []);
  fallos.clear();
  escrituras.length = 0;
  llamadasRpc.length = 0;
  respuestaRpc = { data: '00000000-0000-4000-8000-000000000001', error: null };
  refresh.mockClear();
});

describe('marcarEstado', () => {
  it('programar una pieza marcada para revisar la deja programada y sin la marca', async () => {
    tablas.set('plan_piezas', [{ id: 'p1', estado: 'pendiente', revisar: true }]);

    expect(await marcarEstado('p1', 'programada')).toEqual({});
    expect(filaDe('plan_piezas', 'p1')).toEqual({ id: 'p1', estado: 'programada', revisar: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('volver a pendiente solo cambia el estado', async () => {
    tablas.set('plan_piezas', [{ id: 'p1', estado: 'programada', revisar: false }]);

    expect(await marcarEstado('p1', 'pendiente')).toEqual({});
    expect(escrituras).toEqual([
      { tabla: 'plan_piezas', operacion: 'update', valores: { estado: 'pendiente' }, filtros: [['id', 'p1']] },
    ]);
    expect(filaDe('plan_piezas', 'p1')).toEqual({ id: 'p1', estado: 'pendiente', revisar: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una pieza que ya no existe devuelve el aviso y refresca para que desaparezca', async () => {
    expect(await marcarEstado('borrada', 'programada')).toEqual({
      error: 'Esa pieza ya no está en el plan',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si Supabase falla devuelve un error legible y no refresca', async () => {
    tablas.set('plan_piezas', [{ id: 'p1', estado: 'pendiente', revisar: false }]);
    fallos.set('plan_piezas', { code: '42501', message: 'permission denied for table plan_piezas' });

    expect(await marcarEstado('p1', 'programada')).toEqual({
      error: 'No se ha podido guardar. Vuelve a intentarlo.',
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('crearPlan', () => {
  // Semana del lunes 19 de octubre de 2026, episodio el viernes 23 con la estrategia E1.
  const entrada = {
    lunes: '2026-10-19',
    conEpisodio: true,
    diaD: '2026-10-23',
    numero: '06',
    invitado: 'Invitada de prueba',
    tema: null,
    estrategiaId: 'e1',
  };

  const piezasEnviadas = () => llamadasRpc[0][1].piezas as Record<string, unknown>[];

  it('si esa semana ya tiene plan (doble pulsación u otra persona), lo dice y refresca', async () => {
    respuestaRpc = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    expect(await crearPlan(entrada)).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('un día de publicación fuera de esa semana no llega a la base', async () => {
    for (const diaD of ['2026-10-26', '2026-10-18', '2026-10-32', '']) {
      expect(await crearPlan({ ...entrada, diaD })).toEqual({
        error: 'El día de publicación tiene que caer en esa semana',
      });
    }
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('crea el plan con las piezas que genera el servidor, en snake_case', async () => {
    expect(await crearPlan({ ...entrada, invitado: '  Invitada de prueba ', tema: '' })).toEqual({});

    expect(llamadasRpc).toEqual([
      [
        'crear_plan',
        {
          plan: {
            lunes: '2026-10-19',
            dia_d: '2026-10-23',
            con_episodio: true,
            numero: '06',
            invitado: 'Invitada de prueba',
            tema: null,
            estrategia_id: 'e1',
            estrategia_nombre: 'E1 · Anticipación fuerte',
          },
          piezas: [
            { pieza_id: 't4', nombre: 'T4 · Historia del invitado', nombre_corto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3, desplazamiento: -1, fecha: '2026-10-22', hora: null },
            { pieza_id: 'rp', nombre: 'Clip principal', nombre_corto: 'Clip principal', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], dias_preparacion: 2, desplazamiento: 0, fecha: '2026-10-23', hora: '18:00' },
            { pieza_id: 'rc', nombre: 'Clip secundario', nombre_corto: 'Clip secundario', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], dias_preparacion: 2, desplazamiento: 2, fecha: '2026-10-25', hora: null },
            { pieza_id: 't2', nombre: 'T2 · Valor + CTA', nombre_corto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3, desplazamiento: 4, fecha: '2026-10-27', hora: null },
            { pieza_id: 'rc', nombre: 'Clip secundario', nombre_corto: 'Clip secundario', formato: 'reel', canales: ['ig', 'tiktok', 'shorts'], dias_preparacion: 2, desplazamiento: 5, fecha: '2026-10-28', hora: null },
          ],
        },
      ],
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una pieza sin hora va con hora null, nunca con texto vacío', async () => {
    expect(await crearPlan(entrada)).toEqual({});

    const horas = piezasEnviadas().map((p) => p.hora);
    expect(horas).toEqual([null, '18:00', null, null, null]);
    for (const pieza of piezasEnviadas()) expect(pieza).toHaveProperty('hora');
  });

  it('las piezas salen de la base, no de lo que mande el navegador', async () => {
    // Lo que llegue de más en la entrada (unas piezas, por ejemplo) no se usa.
    const conPiezas = { ...entrada, piezas: [{ nombre: 'Inventada', fecha: '2026-10-19' }] };
    expect(await crearPlan(conPiezas)).toEqual({});
    expect(piezasEnviadas().map((p) => p.nombre)).not.toContain('Inventada');
    expect(piezasEnviadas()).toHaveLength(5);
  });

  it('una estrategia que usa una pieza archivada no se puede usar', async () => {
    tablas.set('piezas', filasPiezas({ rt: { archivada: true } }));

    expect(await crearPlan({ ...entrada, estrategiaId: 'e2' })).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    expect(llamadasRpc).toEqual([]);
    // Refresca para que la lista del panel deje de ofrecerla.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una estrategia que no existe o que es del otro tipo no se puede usar', async () => {
    expect(await crearPlan({ ...entrada, estrategiaId: 'borrada' })).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    expect(await crearPlan({ ...entrada, estrategiaId: 'e3' })).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    expect(await crearPlan({ ...entrada, conEpisodio: false, estrategiaId: 'e1' })).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    expect(llamadasRpc).toEqual([]);
  });

  it('la semana tiene que empezar en un lunes de verdad', async () => {
    for (const lunes of ['2026-10-20', '2026-02-30', 'no-es-fecha']) {
      expect(await crearPlan({ ...entrada, lunes })).toEqual({ error: 'Esa semana no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('con episodio hace falta el número', async () => {
    for (const numero of [null, '', '   ']) {
      expect(await crearPlan({ ...entrada, numero })).toEqual({ error: 'Falta el número del episodio' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('sin episodio no se guardan número, invitado ni tema', async () => {
    const sinEpisodio = { ...entrada, conEpisodio: false, estrategiaId: 'e3', numero: '06', tema: 'Tema' };
    expect(await crearPlan(sinEpisodio)).toEqual({});

    expect(llamadasRpc[0][1].plan).toEqual({
      lunes: '2026-10-19',
      dia_d: '2026-10-23',
      con_episodio: false,
      numero: null,
      invitado: null,
      tema: null,
      estrategia_id: 'e3',
      estrategia_nombre: 'E3 · Recopilación',
    });
    expect(piezasEnviadas().map((p) => p.fecha)).toEqual(['2026-10-22', '2026-10-24', '2026-10-27', '2026-10-28']);
  });

  it('si Supabase falla por otra cosa, da un error legible y no refresca', async () => {
    respuestaRpc = { data: null, error: { code: '42501', message: 'permission denied for function crear_plan' } };

    expect(await crearPlan(entrada)).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('si no se pueden leer las estrategias, da el mismo error legible sin llamar a la base', async () => {
    fallos.set('estrategias', { code: '42501', message: 'permission denied' });

    expect(await crearPlan(entrada)).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('editarPiezaDePlan', () => {
  beforeEach(() => tablas.set('planes', [filaPlan()]));

  it('mover de día una programada la deja pendiente y marcada para revisar en Metricool', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada' })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00')).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(
      expect.objectContaining({ fecha: '2026-10-24', hora: '18:00', estado: 'pendiente', revisar: true }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('el desplazamiento se recalcula desde el día D del plan', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-22', '18:00')).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ fecha: '2026-10-22', desplazamiento: -1 }));
  });

  it('guardar sin cambiar día ni hora no la marca para revisar', async () => {
    // La base da «18:00:00» y el panel manda «18:00»: es la misma hora.
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada' })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-23', '18:00')).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ estado: 'programada', revisar: false }));
  });

  it('un día fuera de D-1…D+5 no se guarda', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    for (const fecha of ['2026-10-21', '2026-10-29', '2026-02-30', '']) {
      expect(await editarPiezaDePlan(CLIP, fecha, '18:00')).toEqual({
        error: 'El día tiene que estar entre D-1 y D+5',
      });
    }
    expect(escrituras).toEqual([]);
    expect(filaDe('plan_piezas', CLIP)).toEqual(filaPiezaDePlan());
  });

  it('una hora vacía se guarda como sin hora (null), nunca como texto vacío', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-23', '')).toEqual({});
    expect(escrituras[0].valores).toHaveProperty('hora', null);
    expect(filaDe('plan_piezas', CLIP)).toHaveProperty('hora', null);
  });

  it('una hora que no es una hora no se guarda', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    for (const hora of ['25:00', '18.00', 'tarde']) {
      expect(await editarPiezaDePlan(CLIP, '2026-10-23', hora)).toEqual({ error: 'Esa hora no es válida' });
    }
    expect(escrituras).toEqual([]);
  });

  it('si la pieza ya no está en el plan (otra persona la ha quitado), lo dice y refresca', async () => {
    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00')).toEqual({
      error: 'Esa pieza ya no está en el plan',
    });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('quitarPiezaDePlan', () => {
  it('borra solo esa pieza, filtrando por su id', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan(), filaPiezaDePlan({ id: T4, pieza_id: 't4', fecha: '2026-10-22' })]);

    expect(await quitarPiezaDePlan(CLIP)).toEqual({});
    expect(escrituras).toEqual([{ tabla: 'plan_piezas', operacion: 'delete', filtros: [['id', CLIP]] }]);
    expect(tablas.get('plan_piezas')!.map((f) => f.id)).toEqual([T4]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una pieza que ya no existe devuelve el aviso y refresca', async () => {
    expect(await quitarPiezaDePlan(CLIP)).toEqual({ error: 'Esa pieza ya no está en el plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si Supabase falla, da un error legible y no refresca', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);
    fallos.set('plan_piezas', { code: '42501', message: 'permission denied for table plan_piezas' });

    expect(await quitarPiezaDePlan(CLIP)).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('editarEpisodio', () => {
  it('guarda número, invitado y tema sin espacios de más, y vacíos como null', async () => {
    tablas.set('planes', [filaPlan()]);

    expect(await editarEpisodio(PLAN, { numero: ' 07 ', invitado: '', tema: '  Tema de prueba ' })).toEqual({});
    expect(filaDe('planes', PLAN)).toEqual(filaPlan({ numero: '07', invitado: null, tema: 'Tema de prueba' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('con episodio hace falta el número', async () => {
    tablas.set('planes', [filaPlan()]);

    expect(await editarEpisodio(PLAN, { numero: '  ', invitado: null, tema: null })).toEqual({
      error: 'Falta el número del episodio',
    });
    expect(escrituras).toEqual([]);
  });

  it('una semana sin episodio no guarda número, invitado ni tema', async () => {
    tablas.set('planes', [filaPlan({ con_episodio: false, numero: null, invitado: null })]);

    expect(await editarEpisodio(PLAN, { numero: '07', invitado: 'Alguien', tema: null })).toEqual({
      error: 'Esa semana no tiene episodio',
    });
    expect(escrituras).toEqual([]);
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    expect(await editarEpisodio(PLAN, { numero: '07', invitado: null, tema: null })).toEqual({
      error: 'Ese plan ya no existe',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('anadirPiezaSuelta', () => {
  beforeEach(() => tablas.set('planes', [filaPlan()]));

  it('copia los datos de la pieza en ese día, con la hora elegida, y la deja pendiente', async () => {
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30')).toEqual({});

    expect(escrituras).toEqual([
      {
        tabla: 'plan_piezas',
        operacion: 'insert',
        valores: {
          plan_id: PLAN,
          pieza_id: 't2',
          nombre: 'T2 · Valor + CTA',
          nombre_corto: 'Valor + CTA',
          formato: 'slide',
          canales: ['ig', 'tiktok'],
          dias_preparacion: 3,
          desplazamiento: 1,
          fecha: '2026-10-24',
          hora: '11:30',
        },
        filtros: [],
      },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una hora vacía va como null', async () => {
    expect(await anadirPiezaSuelta(PLAN, 'rp', '2026-10-23', '')).toEqual({});
    expect(escrituras[0].valores).toHaveProperty('hora', null);
  });

  it('una pieza archivada no se puede añadir', async () => {
    tablas.set('piezas', filasPiezas({ t2: { archivada: true } }));

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30')).toEqual({
      error: 'Esa pieza ya no está disponible',
    });
    expect(escrituras).toEqual([]);
    // Refresca para que la lista del panel deje de ofrecerla.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('un día fuera de D-1…D+5 o una hora que no es una hora no se guardan', async () => {
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-29', '11:30')).toEqual({
      error: 'El día tiene que estar entre D-1 y D+5',
    });
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11')).toEqual({ error: 'Esa hora no es válida' });
    expect(escrituras).toEqual([]);
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    tablas.set('planes', []);

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30')).toEqual({ error: 'Ese plan ya no existe' });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el plan desaparece entre la lectura y el alta (clave ajena rota), dice lo mismo', async () => {
    fallos.set('plan_piezas', { code: '23503', message: 'insert or update on table "plan_piezas" violates foreign key constraint' });

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30')).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('moverSemana', () => {
  it('mueve el plan con mover_plan y refresca', async () => {
    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({});
    expect(llamadasRpc).toEqual([['mover_plan', { plan_id: PLAN, nuevo_dia_d: '2026-10-30' }]]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si la semana de destino ya tiene plan, lo dice y refresca', async () => {
    respuestaRpc = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    respuestaRpc = { data: null, error: { code: 'P0001', message: 'plan_no_existe' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una fecha que no existe no llega a la base', async () => {
    for (const fecha of ['2026-02-30', '30/10/2026', '']) {
      expect(await moverSemana(PLAN, fecha)).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('si Supabase falla por otra cosa, da un error legible y no refresca', async () => {
    respuestaRpc = { data: null, error: { code: '42501', message: 'permission denied for function mover_plan' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('cambiarEstrategiaDePlan', () => {
  beforeEach(() => tablas.set('planes', [filaPlan()]));

  it('con piezas ya programadas, sin confirmar no cambia nada y pide confirmación', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada' })]);

    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', false)).toEqual({ error: 'confirmar' });
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('confirmado, cambia la estrategia con las piezas generadas en el servidor desde el D de la base', async () => {
    // El D de la base es el jueves 22, no el que pudiera tener el panel.
    tablas.set('planes', [filaPlan({ dia_d: '2026-10-22' })]);
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada', fecha: '2026-10-22' })]);

    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', true)).toEqual({});
    expect(llamadasRpc).toHaveLength(1);
    const [funcion, argumentos] = llamadasRpc[0];
    expect(funcion).toBe('cambiar_estrategia');
    expect(argumentos).toEqual(
      expect.objectContaining({ plan_id: PLAN, estrategia_id: 'e2', estrategia_nombre: 'E2 · Valor primero' }),
    );
    const piezas = argumentos.piezas as Record<string, unknown>[];
    expect(piezas.map((p) => [p.pieza_id, p.fecha, p.hora])).toEqual([
      ['rt', '2026-10-21', null],
      ['rp', '2026-10-22', '18:00'],
      ['t2', '2026-10-23', null],
      ['t3', '2026-10-26', null],
      ['rc', '2026-10-27', null],
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('sin piezas programadas no hace falta confirmar', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', false)).toEqual({});
    expect(llamadasRpc.map(([funcion]) => funcion)).toEqual(['cambiar_estrategia']);
  });

  it('una estrategia del otro tipo o que usa una pieza archivada no se puede usar', async () => {
    expect(await cambiarEstrategiaDePlan(PLAN, 'e3', true)).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    tablas.set('piezas', filasPiezas({ rt: { archivada: true } }));
    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', true)).toEqual({
      error: 'Esa estrategia ya no está disponible',
    });
    expect(llamadasRpc).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    tablas.set('planes', []);
    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', true)).toEqual({ error: 'Ese plan ya no existe' });
    expect(llamadasRpc).toEqual([]);

    // O si desaparece entre la lectura y el cambio.
    tablas.set('planes', [filaPlan()]);
    respuestaRpc = { data: null, error: { code: 'P0001', message: 'plan_no_existe' } };
    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', true)).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
