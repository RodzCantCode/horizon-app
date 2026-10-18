'use client';

import { useState, type FormEvent } from 'react';
import { isAuthError } from '@supabase/supabase-js';
import { Button, TextField } from 'mochi-ui';
import { mensajeErrorContrasena, validarContrasena } from '@/lib/contrasena';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
// Mismo aspecto que el formulario de Entrar.
import estilos from '../entrar/entrar.module.css';

interface PropiedadesFormulario {
  textoBoton: string;
  alGuardar: () => void;
  /** Si se pasa, el formulario lleva también «Cancelar». */
  alCancelar?: () => void;
}

// La contraseña nueva, dos veces. Lo usan /crear-contrasena (tras la invitación o la recuperación)
// y «Cambiar contraseña» en Ajustes; las dos piden sesión, que es la que cambia updateUser.
export function FormularioContrasena({ textoBoton, alGuardar, alCancelar }: PropiedadesFormulario) {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const invalida = validarContrasena(nueva, repetida);
    if (invalida) {
      setError(invalida);
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();
      const { error: errorAuth } = await supabase.auth.updateUser({ password: nueva });
      if (errorAuth) throw errorAuth;
      alGuardar();
    } catch (fallo) {
      // El error de Supabase, para quien mire la consola; en pantalla, el mensaje en español.
      console.error(fallo);
      setError(mensajeErrorContrasena(isAuthError(fallo) ? fallo.code : undefined));
      setGuardando(false);
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={guardar}>
      <TextField
        label="Contraseña nueva"
        type="password"
        name="nueva"
        autoComplete="new-password"
        autoFocus
        required
        value={nueva}
        onValueChange={setNueva}
        disabled={guardando}
        showPasswordLabel="Mostrar contraseña"
        hidePasswordLabel="Ocultar contraseña"
      />
      <TextField
        label="Repite la contraseña"
        type="password"
        name="repetida"
        autoComplete="new-password"
        required
        value={repetida}
        onValueChange={setRepetida}
        disabled={guardando}
        showPasswordLabel="Mostrar contraseña"
        hidePasswordLabel="Ocultar contraseña"
      />
      <p className={estilos.error} role="alert">
        {error}
      </p>
      <div className={estilos.botones}>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          status={guardando ? 'loading' : 'idle'}
          loadingLabel="Guardando"
        >
          {textoBoton}
        </Button>
        {alCancelar ? (
          <Button variant="surface" size="lg" onClick={alCancelar} disabled={guardando}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// La de /crear-contrasena: con la contraseña guardada, a la portada. Navegación completa, como al
// entrar, para que proxy.ts sirva la portada con la sesión ya al día.
export function FormularioCrearContrasena() {
  return (
    <FormularioContrasena
      textoBoton="Guardar contraseña"
      alGuardar={() => window.location.replace('/')}
    />
  );
}
