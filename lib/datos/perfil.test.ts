import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fallos, prepararBase, sesion, tablas } from '@/lib/pruebas/baseSimulada';
import { leerPerfilPropio } from './perfil';

vi.mock('@/lib/supabase/servidor', async () => {
  const { clienteSimulado } = await import('@/lib/pruebas/baseSimulada');
  return { crearClienteServidor: async () => clienteSimulado };
});

const ANA = '11111111-1111-4111-8111-111111111111';
const BRUNO = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  prepararBase();
  tablas.set('perfiles', [
    { id: ANA, nombre: 'Ana' },
    { id: BRUNO, nombre: 'Bruno' },
  ]);
  sesion.claims = { sub: ANA, email: 'ana@ejemplo.test' };
});

describe('leerPerfilPropio', () => {
  it('da el correo de la sesión y el nombre de su perfil, no el de otro', async () => {
    expect(await leerPerfilPropio()).toEqual({ correo: 'ana@ejemplo.test', nombre: 'Ana' });
  });

  it('sin fila de perfil, el nombre sale vacío', async () => {
    sesion.claims = { sub: '33333333-3333-4333-8333-333333333333', email: 'otra@ejemplo.test' };

    expect(await leerPerfilPropio()).toEqual({ correo: 'otra@ejemplo.test', nombre: '' });
  });

  it('si la sesión no trae correo, sale vacío', async () => {
    sesion.claims = { sub: ANA };

    expect(await leerPerfilPropio()).toEqual({ correo: '', nombre: 'Ana' });
  });

  it('si Supabase falla, lanza un error', async () => {
    fallos.set('perfiles', { code: 'XX000', message: 'boom' });

    await expect(leerPerfilPropio()).rejects.toThrow('No se ha podido leer tu perfil');
  });
});
