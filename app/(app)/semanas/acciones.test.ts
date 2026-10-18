import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marcarEstado } from './acciones';

// Tabla plan_piezas simulada en memoria: `update(cambios).eq('id', x).select('id')` cambia la fila x
// si existe y devuelve las filas cambiadas, como PostgREST. Así la prueba mira cómo queda la fila, no
// solo qué se pidió. vi.mock se eleva por encima de los import; las funciones de dentro leen
// `filas` y `fallo` al llamarse, no al definirse.
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

vi.mock('@/lib/supabase/servidor', () => ({
  crearClienteServidor: async () => ({
    from: (tabla: string) => {
      if (tabla !== 'plan_piezas') throw new Error(`Tabla no prevista en la prueba: ${tabla}`);
      return tablaPlanPiezas();
    },
  }),
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh }));

beforeEach(() => {
  filas.clear();
  pedidos.length = 0;
  fallo = null;
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
