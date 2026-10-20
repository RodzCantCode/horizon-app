import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  antesDeEscribir,
  escrituras,
  fallos,
  filaDe,
  filasPiezas,
  llamadasRpc,
  prepararBase,
  rpc,
  tablas,
} from '@/lib/pruebas/baseSimulada';
import type { Tables } from '@/lib/supabase/tipos';
import {
  anadirPiezaSuelta,
  cambiarEstrategiaDePlan,
  crearPlan,
  editarEpisodio,
  editarPiezaDePlan,
  marcarEstado,
  moverEpisodio,
  moverSemana,
  quitarPiezaDePlan,
} from './acciones';

// Las acciones hablan con la base simulada en memoria de lib/pruebas/baseSimulada.ts (con las
// piezas y las estrategias E1, E2 y E3 del prototipo), no con Supabase.
vi.mock('@/lib/supabase/servidor', async () => {
  const { clienteSimulado } = await import('@/lib/pruebas/baseSimulada');
  return { crearClienteServidor: async () => clienteSimulado };
});

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh }));

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
    hora_episodio: null,
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

beforeEach(() => {
  prepararBase();
  rpc.respuesta = { data: '00000000-0000-4000-8000-000000000001', error: null };
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
  // Semana del lunes 19 de octubre de 2026, episodio el viernes 23 con la estrategia E1. El lunes no
  // lo manda el navegador: sale del día D.
  const entrada = {
    conEpisodio: true,
    diaD: '2026-10-23',
    numero: '06',
    invitado: 'Invitada de prueba',
    tema: null,
    estrategiaId: 'e1',
  };

  const piezasEnviadas = () => llamadasRpc[0][1].piezas as Record<string, unknown>[];

  it('si esa semana ya tiene plan (doble pulsación u otra persona), lo dice y refresca', async () => {
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    expect(await crearPlan(entrada)).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('un día de publicación que no es una fecha no llega a la base', async () => {
    for (const diaD of ['2026-10-32', '2026-02-30', '23/10/2026', '']) {
      expect(await crearPlan({ ...entrada, diaD })).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('el lunes del plan sale del día D, aunque el navegador mande otro', async () => {
    // D el domingo 25: su semana es la del lunes 19, no la del 26 que manda el navegador.
    const conOtroLunes = { ...entrada, diaD: '2026-10-25', lunes: '2026-10-26' };
    expect(await crearPlan(conOtroLunes)).toEqual({});
    expect(llamadasRpc[0][1].plan).toEqual(expect.objectContaining({ lunes: '2026-10-19', dia_d: '2026-10-25' }));
  });

  it('con fechas, cada pieza va en la suya (también lejos de D) y se guarda la hora del episodio', async () => {
    // Una fecha por ítem de E1, en su orden (t4, rp, rc, t2, rc); null deja la de la estrategia.
    const fechas = ['2026-10-13', null, '2026-11-12', null, '2026-10-24'];
    expect(await crearPlan({ ...entrada, fechas, horaEpisodio: '9:30' })).toEqual({});

    expect(llamadasRpc[0][1].plan).toEqual(expect.objectContaining({ lunes: '2026-10-19', hora_episodio: '09:30' }));
    expect(piezasEnviadas().map((p) => [p.pieza_id, p.fecha, p.desplazamiento])).toEqual([
      ['t4', '2026-10-13', -10],
      ['rp', '2026-10-23', 0],
      ['rc', '2026-10-24', 1],
      ['t2', '2026-10-27', 4],
      ['rc', '2026-11-12', 20],
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una fecha de pieza que no es una fecha no llega a la base', async () => {
    for (const fecha of ['2026-02-30', '', '13/10/2026']) {
      const fechas = ['2026-10-22', fecha, null, null, null];
      expect(await crearPlan({ ...entrada, fechas })).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('si la estrategia ha cambiado de número de posts mientras se programaba, avisa, no crea nada y refresca', async () => {
    // E1 tiene cinco ítems; el navegador colocó cuatro (la estrategia que leyó al abrir el modo).
    for (const fechas of [['2026-10-22', null, null, null], ['2026-10-22', null, null, null, null, null]]) {
      expect(await crearPlan({ ...entrada, fechas })).toEqual({
        error: 'La estrategia ha cambiado mientras programabas. Vuelve a elegirla.',
      });
    }
    expect(llamadasRpc).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('una hora del episodio que no es una hora no llega a la base', async () => {
    expect(await crearPlan({ ...entrada, horaEpisodio: '25:00' })).toEqual({ error: 'Esa hora no es válida' });
    expect(llamadasRpc).toEqual([]);
  });

  it('con fechas, si esa semana ya tiene plan, lo dice y refresca', async () => {
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    const fechas = ['2026-10-21', null, null, null, null];
    expect(await crearPlan({ ...entrada, fechas, horaEpisodio: '19:00' })).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
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
            hora_episodio: null,
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

  it('con episodio hace falta el número', async () => {
    for (const numero of [null, '', '   ']) {
      expect(await crearPlan({ ...entrada, numero })).toEqual({ error: 'Falta el número del episodio' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('sin episodio no se guardan número, invitado, tema ni hora del episodio', async () => {
    const sinEpisodio = {
      ...entrada,
      conEpisodio: false,
      estrategiaId: 'e3',
      numero: '06',
      tema: 'Tema',
      horaEpisodio: '19:00',
    };
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
      hora_episodio: null,
    });
    expect(piezasEnviadas().map((p) => p.fecha)).toEqual(['2026-10-22', '2026-10-24', '2026-10-27', '2026-10-28']);
  });

  it('si Supabase falla por otra cosa, da un error legible y no refresca', async () => {
    rpc.respuesta = { data: null, error: { code: '42501', message: 'permission denied for function crear_plan' } };

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

  // Lo que enseñaba el panel de la pieza de filaPiezaDePlan(): D a las 18:00.
  const ORIGINAL = { fecha: '2026-10-23', hora: '18:00' };

  it('mover de día una programada la deja pendiente y marcada para revisar en Metricool', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada' })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00', ORIGINAL)).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(
      expect.objectContaining({ fecha: '2026-10-24', hora: '18:00', estado: 'pendiente', revisar: true }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('el desplazamiento se recalcula desde el día D del plan', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-22', '18:00', ORIGINAL)).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ fecha: '2026-10-22', desplazamiento: -1 }));
  });

  it('guardar sin cambiar día ni hora no la marca para revisar', async () => {
    // La base da «18:00:00» y el panel manda «18:00»: es la misma hora.
    tablas.set('plan_piezas', [filaPiezaDePlan({ estado: 'programada' })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-23', '18:00', ORIGINAL)).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ estado: 'programada', revisar: false }));
  });

  it('se puede llevar a cualquier día: a D+20 y a D-10 guarda desplazamiento 20 y -10', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);
    expect(await editarPiezaDePlan(CLIP, '2026-11-12', '18:00', ORIGINAL)).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ fecha: '2026-11-12', desplazamiento: 20 }));

    tablas.set('plan_piezas', [filaPiezaDePlan()]);
    expect(await editarPiezaDePlan(CLIP, '2026-10-13', '18:00', ORIGINAL)).toEqual({});
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ fecha: '2026-10-13', desplazamiento: -10 }));
  });

  it('una fecha que no existe no se guarda', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    for (const fecha of ['2026-02-30', '24/10/2026', '']) {
      expect(await editarPiezaDePlan(CLIP, fecha, '18:00', ORIGINAL)).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(escrituras).toEqual([]);
    expect(filaDe('plan_piezas', CLIP)).toEqual(filaPiezaDePlan());
  });

  it('si otra persona la ha movido lejos con el panel abierto, no la pisa', async () => {
    // B ha llevado el clip a D+20; A lo arrastra desde el 23, donde lo veía, al 13.
    tablas.set('plan_piezas', [filaPiezaDePlan({ fecha: '2026-11-12', desplazamiento: 20 })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-13', '18:00', ORIGINAL)).toEqual({
      error: 'La pieza ha cambiado mientras la editabas. Revisa y vuelve a guardar.',
    });
    expect(escrituras).toEqual([]);
    expect(filaDe('plan_piezas', CLIP)).toEqual(filaPiezaDePlan({ fecha: '2026-11-12', desplazamiento: 20 }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una hora vacía se guarda como sin hora (null), nunca como texto vacío', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-23', '', ORIGINAL)).toEqual({});
    expect(escrituras[0].valores).toHaveProperty('hora', null);
    expect(filaDe('plan_piezas', CLIP)).toHaveProperty('hora', null);
  });

  it('una hora que no es una hora no se guarda', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);

    for (const hora of ['25:00', '18.00', 'tarde']) {
      expect(await editarPiezaDePlan(CLIP, '2026-10-23', hora, ORIGINAL)).toEqual({ error: 'Esa hora no es válida' });
    }
    expect(escrituras).toEqual([]);
  });

  it('si la pieza ya no está en el plan (otra persona la ha quitado), lo dice y refresca', async () => {
    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00', ORIGINAL)).toEqual({
      error: 'Esa pieza ya no está en el plan',
    });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('con el panel desfasado no deshace la semana que otra persona ha movido', async () => {
    // B ha movido la semana al sábado 24: el clip principal está ya en el 24. A tenía el panel
    // abierto con el clip en el 23 a las 18:00, cambia solo la hora a las 19:00 y guarda.
    tablas.set('planes', [filaPlan({ dia_d: '2026-10-24' })]);
    tablas.set('plan_piezas', [filaPiezaDePlan({ fecha: '2026-10-24' })]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-23', '19:00', ORIGINAL)).toEqual({
      error: 'La pieza ha cambiado mientras la editabas. Revisa y vuelve a guardar.',
    });
    expect(escrituras).toEqual([]);
    expect(filaDe('plan_piezas', CLIP)).toEqual(filaPiezaDePlan({ fecha: '2026-10-24' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si la hora ha cambiado con el panel abierto, tampoco guarda', async () => {
    for (const hora of ['19:30:00', null]) {
      tablas.set('plan_piezas', [filaPiezaDePlan({ hora })]);

      expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00', ORIGINAL)).toEqual({
        error: 'La pieza ha cambiado mientras la editabas. Revisa y vuelve a guardar.',
      });
    }
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('si la pieza cambia entre la lectura y la escritura (0 filas), lo dice y refresca', async () => {
    tablas.set('plan_piezas', [filaPiezaDePlan()]);
    // Otra persona la marca como programada justo después de que la acción la lea.
    antesDeEscribir.set('plan_piezas.update', () => {
      Object.assign(filaDe('plan_piezas', CLIP)!, { estado: 'programada' });
    });

    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00', ORIGINAL)).toEqual({
      error: 'La pieza ha cambiado mientras la editabas. Revisa y vuelve a guardar.',
    });
    // Queda lo que hizo la otra persona, sin el cambio de día.
    expect(filaDe('plan_piezas', CLIP)).toEqual(filaPiezaDePlan({ estado: 'programada' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('el cambio va solo a esa pieza: filtra por su id, y por el día y el estado que se leyeron', async () => {
    // Otra pieza del mismo plan, el mismo día y con el mismo estado: solo la distingue el id.
    const otra = filaPiezaDePlan({ id: T4, pieza_id: 't4', nombre: 'T4 · Historia del invitado' });
    tablas.set('plan_piezas', [filaPiezaDePlan(), otra]);

    expect(await editarPiezaDePlan(CLIP, '2026-10-24', '18:00', ORIGINAL)).toEqual({});
    expect(escrituras.map((e) => e.filtros)).toEqual([
      [
        ['id', CLIP],
        ['fecha', '2026-10-23'],
        ['estado', 'pendiente'],
      ],
    ]);
    expect(filaDe('plan_piezas', CLIP)).toEqual(expect.objectContaining({ fecha: '2026-10-24', desplazamiento: 1 }));
    expect(filaDe('plan_piezas', T4)).toEqual(otra);
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

    expect(await editarEpisodio(PLAN, { numero: ' 07 ', invitado: '', tema: '  Tema de prueba ', hora: '' })).toEqual({});
    expect(filaDe('planes', PLAN)).toEqual(filaPlan({ numero: '07', invitado: null, tema: 'Tema de prueba' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('con episodio hace falta el número', async () => {
    tablas.set('planes', [filaPlan()]);

    expect(await editarEpisodio(PLAN, { numero: '  ', invitado: null, tema: null, hora: null })).toEqual({
      error: 'Falta el número del episodio',
    });
    expect(escrituras).toEqual([]);
  });

  it('una semana sin episodio no guarda número, invitado ni tema', async () => {
    tablas.set('planes', [filaPlan({ con_episodio: false, numero: null, invitado: null })]);

    expect(await editarEpisodio(PLAN, { numero: '07', invitado: 'Alguien', tema: null, hora: '19:00' })).toEqual({
      error: 'Esa semana no tiene episodio',
    });
    expect(escrituras).toEqual([]);
  });

  it('guarda la hora del episodio; vacía es sin hora', async () => {
    tablas.set('planes', [filaPlan()]);
    expect(await editarEpisodio(PLAN, { numero: '06', invitado: null, tema: null, hora: '9:30' })).toEqual({});
    expect(filaDe('planes', PLAN)).toHaveProperty('hora_episodio', '09:30');

    expect(await editarEpisodio(PLAN, { numero: '06', invitado: null, tema: null, hora: '  ' })).toEqual({});
    expect(filaDe('planes', PLAN)).toHaveProperty('hora_episodio', null);
  });

  it('una hora que no es una hora no se guarda', async () => {
    tablas.set('planes', [filaPlan()]);

    for (const hora of ['25:00', '19.00', 'tarde']) {
      expect(await editarEpisodio(PLAN, { numero: '06', invitado: null, tema: null, hora })).toEqual({
        error: 'Esa hora no es válida',
      });
    }
    expect(escrituras).toEqual([]);
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    expect(await editarEpisodio(PLAN, { numero: '07', invitado: null, tema: null, hora: null })).toEqual({
      error: 'Ese plan ya no existe',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('anadirPiezaSuelta', () => {
  beforeEach(() => tablas.set('planes', [filaPlan()]));

  it('copia los datos de la pieza en ese día, con la hora elegida, y la deja pendiente', async () => {
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30', '2026-10-23')).toEqual({});

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
    expect(await anadirPiezaSuelta(PLAN, 'rp', '2026-10-23', '', '2026-10-23')).toEqual({});
    expect(escrituras[0].valores).toHaveProperty('hora', null);
  });

  it('una pieza archivada no se puede añadir', async () => {
    tablas.set('piezas', filasPiezas({ t2: { archivada: true } }));

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30', '2026-10-23')).toEqual({
      error: 'Esa pieza ya no está disponible',
    });
    expect(escrituras).toEqual([]);
    // Refresca para que la lista del panel deje de ofrecerla.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('se puede añadir en cualquier día: a D+20 guarda desplazamiento 20', async () => {
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-11-12', '11:30', '2026-10-23')).toEqual({});
    expect(escrituras[0].valores).toEqual(expect.objectContaining({ fecha: '2026-11-12', desplazamiento: 20 }));
  });

  it('una fecha que no existe o una hora que no es una hora no se guardan', async () => {
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-02-30', '11:30', '2026-10-23')).toEqual({
      error: 'Esa fecha no es válida',
    });
    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11', '2026-10-23')).toEqual({ error: 'Esa hora no es válida' });
    expect(escrituras).toEqual([]);
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    tablas.set('planes', []);

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30', '2026-10-23')).toEqual({ error: 'Ese plan ya no existe' });
    expect(escrituras).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el plan desaparece entre la lectura y el alta (clave ajena rota), dice lo mismo', async () => {
    fallos.set('plan_piezas', { code: '23503', message: 'insert or update on table "plan_piezas" violates foreign key constraint' });

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30', '2026-10-23')).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el día D del plan ha cambiado con el panel abierto, no la añade', async () => {
    // Otra persona ha movido la semana al sábado 24; el panel aún tenía el viernes 23.
    tablas.set('planes', [filaPlan({ dia_d: '2026-10-24' })]);

    expect(await anadirPiezaSuelta(PLAN, 't2', '2026-10-24', '11:30', '2026-10-23')).toEqual({
      error: 'La semana ha cambiado mientras la editabas. Revisa y vuelve a guardar.',
    });
    expect(escrituras).toEqual([]);
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
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'plan_no_existe' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una fecha que no existe no llega a la base', async () => {
    for (const fecha of ['2026-02-30', '30/10/2026', '']) {
      expect(await moverSemana(PLAN, fecha)).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('se puede mover a cualquier semana, por lejos que quede: el calendario navega a todas', async () => {
    expect(await moverSemana(PLAN, '2027-10-23')).toEqual({});
    expect(await moverSemana(PLAN, '2026-01-02')).toEqual({});
    expect(llamadasRpc.map(([, argumentos]) => argumentos.nuevo_dia_d)).toEqual(['2027-10-23', '2026-01-02']);
  });

  it('si Supabase falla por otra cosa, da un error legible y no refresca', async () => {
    rpc.respuesta = { data: null, error: { code: '42501', message: 'permission denied for function mover_plan' } };

    expect(await moverSemana(PLAN, '2026-10-30')).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('moverEpisodio', () => {
  it('mueve solo el episodio con mover_episodio y refresca', async () => {
    expect(await moverEpisodio(PLAN, '2026-11-06')).toEqual({});
    expect(llamadasRpc).toEqual([['mover_episodio', { plan_id: PLAN, nuevo_dia_d: '2026-11-06' }]]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si la semana de destino ya tiene plan, lo dice y refresca', async () => {
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'semana_con_plan' } };

    expect(await moverEpisodio(PLAN, '2026-10-30')).toEqual({ error: 'Esa semana ya tiene plan' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('si el plan ya no existe, lo dice y refresca', async () => {
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'plan_no_existe' } };

    expect(await moverEpisodio(PLAN, '2026-10-30')).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('una fecha que no existe no llega a la base', async () => {
    for (const fecha of ['2026-02-30', '30/10/2026', '']) {
      expect(await moverEpisodio(PLAN, fecha)).toEqual({ error: 'Esa fecha no es válida' });
    }
    expect(llamadasRpc).toEqual([]);
  });

  it('si Supabase falla por otra cosa, da un error legible y no refresca', async () => {
    rpc.respuesta = { data: null, error: { code: '42501', message: 'permission denied for function mover_episodio' } };

    expect(await moverEpisodio(PLAN, '2026-10-30')).toEqual({ error: 'No se ha podido guardar. Vuelve a intentarlo.' });
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
    rpc.respuesta = { data: null, error: { code: 'P0001', message: 'plan_no_existe' } };
    expect(await cambiarEstrategiaDePlan(PLAN, 'e2', true)).toEqual({ error: 'Ese plan ya no existe' });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
