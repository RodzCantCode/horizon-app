import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClienteServidor } from '@/lib/supabase/servidor';

// Con Cache Components y Partial Prefetching, Next.js prerenderiza el App Shell de cada ruta con las
// cookies a mano: leer cookies no lo detiene. `connection()` sí: en el prerender devuelve una
// promesa que no se resuelve nunca, y en una petición real se resuelve. Aquí se simulan los dos casos
// para comprobar que nada de Supabase (ni las cookies, ni el cliente, que mira la caducidad de la
// sesión con `Date.now()`) corre antes de que llegue la petición.
const { conexion, cookies, createServerClient } = vi.hoisted(() => ({
  conexion: { resolver: () => {} },
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
  createServerClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock('next/server', () => ({
  connection: () =>
    new Promise<void>((resolver) => {
      conexion.resolver = resolver;
    }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

// Deja correr todo lo que ya pueda correr (las promesas resueltas encadenadas).
const vaciarPendientes = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => {
  cookies.mockClear();
  createServerClient.mockClear();
});

describe('crearClienteServidor', () => {
  it('en el prerender se queda esperando la petición sin leer cookies ni crear el cliente', async () => {
    void crearClienteServidor();
    await vaciarPendientes();

    expect(cookies).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('con la petición real lee las cookies y crea el cliente', async () => {
    const cliente = crearClienteServidor();
    await vaciarPendientes();
    conexion.resolver();

    await expect(cliente).resolves.toEqual({ auth: {} });
    expect(cookies).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });
});
