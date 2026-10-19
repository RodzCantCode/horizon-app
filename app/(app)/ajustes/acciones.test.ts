import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escrituras, fallos, prepararBase, sesion, tablas } from '@/lib/pruebas/baseSimulada';
import { cambiarNombre } from './acciones';

// Las acciones hablan con la base simulada en memoria de lib/pruebas/baseSimulada.ts, no con Supabase.
vi.mock('@/lib/supabase/servidor', async () => {
  const { clienteSimulado } = await import('@/lib/pruebas/baseSimulada');
  return { crearClienteServidor: async () => clienteSimulado };
});

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh }));

const ANA = '11111111-1111-4111-8111-111111111111';
const BRUNO = '22222222-2222-4222-8222-222222222222';
const NO_GUARDADO = 'No se ha podido guardar el nombre. Inténtalo otra vez.';

beforeEach(() => {
  prepararBase();
  tablas.set('perfiles', [
    { id: ANA, nombre: 'ana' },
    { id: BRUNO, nombre: 'bruno' },
  ]);
  sesion.claims = { sub: ANA, email: 'ana@ejemplo.test' };
  refresh.mockClear();
});

const nombreDe = (id: string) => tablas.get('perfiles')?.find((p) => p.id === id)?.nombre;

describe('cambiarNombre', () => {
  it('guarda el nombre recortado, solo en la fila de la sesión, y refresca', async () => {
    expect(await cambiarNombre('  Ana María  ')).toEqual({});

    expect(nombreDe(ANA)).toBe('Ana María');
    expect(nombreDe(BRUNO)).toBe('bruno');
    expect(escrituras).toEqual([
      { tabla: 'perfiles', operacion: 'update', valores: { nombre: 'Ana María' }, filtros: [['id', ANA]] },
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([['', 'vacío'], ['   ', 'solo espacios'], ['\n\t ', 'solo blancos']])(
    'rechaza un nombre vacío (%j, %s)',
    async (nombre) => {
      expect(await cambiarNombre(nombre)).toEqual({ error: 'Escribe tu nombre.' });
      expect(escrituras).toEqual([]);
      expect(nombreDe(ANA)).toBe('ana');
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it('rechaza 41 caracteres y acepta 40', async () => {
    expect(await cambiarNombre('a'.repeat(41))).toEqual({ error: 'Como mucho 40 caracteres.' });
    expect(escrituras).toEqual([]);

    expect(await cambiarNombre('a'.repeat(40))).toEqual({});
    expect(nombreDe(ANA)).toBe('a'.repeat(40));
  });

  it('cuenta los 40 sin los espacios de los lados', async () => {
    expect(await cambiarNombre(`  ${'a'.repeat(40)}  `)).toEqual({});
  });

  it('si no hay fila del usuario (0 filas), da error y no refresca', async () => {
    sesion.claims = { sub: '33333333-3333-4333-8333-333333333333' };

    expect(await cambiarNombre('Nuevo')).toEqual({ error: NO_GUARDADO });
    expect(nombreDe(ANA)).toBe('ana');
    expect(nombreDe(BRUNO)).toBe('bruno');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('si la base falla, da el error en español y no refresca', async () => {
    fallos.set('perfiles.update', { code: 'XX000', message: 'boom' });

    expect(await cambiarNombre('Nuevo')).toEqual({ error: NO_GUARDADO });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sin sesión no escribe', async () => {
    sesion.claims = null;

    expect(await cambiarNombre('Nuevo')).toEqual({ error: NO_GUARDADO });
    expect(escrituras).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});
