import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tables } from '@/lib/supabase/tipos';
import { crearPlan, marcarEstado } from './acciones';

// Tabla plan_piezas simulada en memoria: `update(cambios).eq('id', x).select('id')` cambia la fila x
// si existe y devuelve las filas cambiadas, como PostgREST. Así la prueba mira cómo queda la fila, no
// solo qué se pidió. vi.mock se eleva por encima de los import; las funciones de dentro leen
// `filas`, `fallo`, `lecturas` y `respuestaRpc` al llamarse, no al definirse.
type Fila = { id: string; estado: string; revisar: boolean };

const filas = new Map<string, Fila>();
const pedidos: Partial<Fila>[] = [];
let fallo: { code: string; message: string } | null = null;

function tablaPlanPiezas() {
  return {
    update(cambios: Partial<Fila>) {
      pedidos.push(cambios);
      return {
        eq(columna: string, valor: string) {
          if (columna !== 'id') throw new Error(`Filtro no previsto en la prueba: ${columna}`);
          return {
            async select() {
              if (fallo) return { data: null, error: fallo };
              const fila = filas.get(valor);
              if (!fila) return { data: [], error: null };
              Object.assign(fila, cambios);
              return { data: [{ id: fila.id }], error: null };
            },
          };
        },
      };
    },
  };
}

// Tablas que crearPlan solo lee (piezas y estrategias, con lib/datos/estrategias.ts): select y order
// se encadenan y, al esperar la consulta, llega lo preparado en `lecturas`.
const lecturas = new Map<string, { data: unknown; error: unknown }>();

function tablaDeLectura(tabla: string) {
  const resultado = lecturas.get(tabla);
  if (!resultado) throw new Error(`Tabla no preparada en la prueba: ${tabla}`);
  const consulta = {
    select: () => consulta,
    order: () => consulta,
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve(resultado).then(resolver, rechazar),
  };
  return consulta;
}

// Llamadas a funciones de la base (rpc) y lo que responde la próxima.
const llamadasRpc: [string, Record<string, unknown>][] = [];
let respuestaRpc: { data: unknown; error: { code: string; message: string } | null } = {
  data: null,
  error: null,
};

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({
    from: (tabla: string) => (tabla === 'plan_piezas' ? tablaPlanPiezas() : tablaDeLectura(tabla)),
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

beforeEach(() => {
  filas.clear();
  pedidos.length = 0;
  fallo = null;
  lecturas.clear();
  lecturas.set('piezas', { data: filasPiezas(), error: null });
  lecturas.set('estrategias', { data: filasEstrategias, error: null });
  llamadasRpc.length = 0;
  respuestaRpc = { data: '00000000-0000-4000-8000-000000000001', error: null };
  refresh.mockClear();
});

describe('marcarEstado', () => {
  it('programar una pieza marcada para revisar la deja programada y sin la marca', async () => {
    filas.set('p1', { id: 'p1', estado: 'pendiente', revisar: true });

    expect(await marcarEstado('p1', 'programada')).toEqual({});
    expect(filas.get('p1')).toEqual({ id: 'p1', estado: 'programada', revisar: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('volver a pendiente solo cambia el estado', async () => {
    filas.set('p1', { id: 'p1', estado: 'programada', revisar: false });

    expect(await marcarEstado('p1', 'pendiente')).toEqual({});
    expect(pedidos).toEqual([{ estado: 'pendiente' }]);
    expect(filas.get('p1')).toEqual({ id: 'p1', estado: 'pendiente', revisar: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una pieza que ya no existe devuelve el aviso y refresca para que desaparezca', async () => {
    expect(await marcarEstado('borrada', 'programada')).toEqual({
      error: 'Esa pieza ya no está en el plan',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si Supabase falla devuelve un error legible y no refresca', async () => {
    filas.set('p1', { id: 'p1', estado: 'pendiente', revisar: false });
    fallo = { code: '42501', message: 'permission denied for table plan_piezas' };

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
    lecturas.set('piezas', { data: filasPiezas({ rt: { archivada: true } }), error: null });

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
    lecturas.set('estrategias', { data: null, error: { code: '42501', message: 'permission denied' } });

    expect(await crearPlan(entrada)).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});
