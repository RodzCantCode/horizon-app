import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerRegistroDe } from '@/lib/datos/registro';

// Cliente de Supabase simulado, como en semanas.test.ts: cada consulta apunta las llamadas que
// recibe y, al esperarla, devuelve el resultado preparado para su tabla.
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
    in: encadenar('in'),
    order: encadenar('order'),
    limit: encadenar('limit'),
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve(consulta.resultado).then(resolver, rechazar),
  };
  return constructor;
}

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({ from: consultaSimulada }),
}));

const ANA = '11111111-1111-4111-8111-111111111111';
const BRUNO = '22222222-2222-4222-8222-222222222222';
const SIN_PERFIL = '33333333-3333-4333-8333-333333333333';

function preparar(registro: { data: unknown; error: unknown }, perfiles: { data: unknown; error: unknown }) {
  consultas.set('registro', { llamadas: [], resultado: registro });
  consultas.set('perfiles', { llamadas: [], resultado: perfiles });
}

beforeEach(() => consultas.clear());

describe('leerRegistroDe', () => {
  it('lee las 10 últimas anotaciones de la fila, de la más nueva a la más vieja', async () => {
    preparar({ data: [], error: null }, { data: [], error: null });
    await leerRegistroDe('b4');

    const llamadas = consultas.get('registro')!.llamadas;
    expect(llamadas).toContainEqual(['eq', 'fila_id', 'b4']);
    expect(llamadas).toContainEqual(['order', 'creado_en', { ascending: false }]);
    expect(llamadas).toContainEqual(['limit', 10]);
  });

  it('pone a cada anotación el nombre de su perfil; sin usuario es «Sistema»', async () => {
    preparar(
      {
        data: [
          { usuario_id: ANA, accion: 'programar', creado_en: '2026-10-14T09:00:00+00:00' },
          { usuario_id: BRUNO, accion: 'mover', creado_en: '2026-10-13T09:00:00+00:00' },
          { usuario_id: ANA, accion: 'volver_a_pendiente', creado_en: '2026-10-12T09:00:00+00:00' },
          { usuario_id: null, accion: 'crear', creado_en: '2026-10-09T09:00:00+00:00' },
        ],
        error: null,
      },
      {
        data: [
          { id: ANA, nombre: 'Ana' },
          { id: BRUNO, nombre: 'Bruno' },
        ],
        error: null,
      },
    );

    expect(await leerRegistroDe('b4')).toEqual([
      { nombre: 'Ana', accion: 'programar', creadoEn: '2026-10-14T09:00:00+00:00' },
      { nombre: 'Bruno', accion: 'mover', creadoEn: '2026-10-13T09:00:00+00:00' },
      { nombre: 'Ana', accion: 'volver_a_pendiente', creadoEn: '2026-10-12T09:00:00+00:00' },
      { nombre: 'Sistema', accion: 'crear', creadoEn: '2026-10-09T09:00:00+00:00' },
    ]);
    // Cada perfil se pide una vez.
    expect(consultas.get('perfiles')!.llamadas).toContainEqual(['in', 'id', [ANA, BRUNO]]);
  });

  it('un usuario sin perfil (cuenta borrada) sale como «Alguien»', async () => {
    preparar(
      { data: [{ usuario_id: SIN_PERFIL, accion: 'editar', creado_en: '2026-10-14T09:00:00+00:00' }], error: null },
      { data: [], error: null },
    );
    expect(await leerRegistroDe('b4')).toEqual([
      { nombre: 'Alguien', accion: 'editar', creadoEn: '2026-10-14T09:00:00+00:00' },
    ]);
  });

  it('si nadie con cuenta tocó la fila, no pide perfiles', async () => {
    preparar(
      { data: [{ usuario_id: null, accion: 'crear', creado_en: '2026-10-09T09:00:00+00:00' }], error: null },
      { data: null, error: { message: 'no debería pedirse' } },
    );
    expect(await leerRegistroDe('b4')).toEqual([
      { nombre: 'Sistema', accion: 'crear', creadoEn: '2026-10-09T09:00:00+00:00' },
    ]);
    expect(consultas.get('perfiles')!.llamadas).toEqual([]);
  });

  it('si Supabase falla, lanza un error', async () => {
    preparar({ data: null, error: { message: 'caído' } }, { data: [], error: null });
    await expect(leerRegistroDe('b4')).rejects.toThrow('No se ha podido leer el registro');

    preparar(
      { data: [{ usuario_id: ANA, accion: 'editar', creado_en: '2026-10-14T09:00:00+00:00' }], error: null },
      { data: null, error: { message: 'caído' } },
    );
    await expect(leerRegistroDe('b4')).rejects.toThrow('No se ha podido leer el registro');
  });
});
