'use client';

import { useState, type FormEvent } from 'react';
import { Button, TextField } from 'mochi-ui';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import estilos from './entrar.module.css';

// Un solo mensaje para cualquier fallo: no se dice si el correo existe ni qué ha fallado.
const mensajeError = 'No se ha podido entrar. Revisa el correo y la contraseña.';

export function FormularioEntrar() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEntrando(true);
    setError(false);

    try {
      const supabase = crearClienteNavegador();
      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });
      if (errorAuth) throw errorAuth;
      // Navegación completa: así proxy.ts ve la cookie nueva y sirve la portada ya con sesión.
      window.location.replace('/');
    } catch {
      setError(true);
      setEntrando(false);
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={entrar}>
      <TextField
        label="Correo"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={correo}
        onValueChange={setCorreo}
        disabled={entrando}
      />
      <TextField
        label="Contraseña"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={contrasena}
        onValueChange={setContrasena}
        disabled={entrando}
        showPasswordLabel="Mostrar contraseña"
        hidePasswordLabel="Ocultar contraseña"
      />
      <p className={estilos.error} role="alert">
        {error ? mensajeError : null}
      </p>
      <Button
        type="submit"
        variant="accent"
        size="lg"
        status={entrando ? 'loading' : 'idle'}
        loadingLabel="Entrando"
      >
        Entrar
      </Button>
    </form>
  );
}
