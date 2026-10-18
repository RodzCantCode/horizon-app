'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from 'mochi-ui';
import { FormularioContrasena } from '@/app/crear-contrasena/formulario';
import estilos from './ajustes.module.css';

// El botón abre el formulario (lo necesario a la vista, el detalle a un clic). Al guardar o
// cancelar se cierra y el foco vuelve al botón.
export function CambiarContrasena() {
  const [abierto, setAbierto] = useState(false);
  const [cambiada, setCambiada] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);

  useEffect(() => {
    if (!abierto && volverAlBoton.current) {
      volverAlBoton.current = false;
      boton.current?.focus();
    }
  }, [abierto]);

  function cerrar(guardada: boolean) {
    volverAlBoton.current = true;
    setCambiada(guardada);
    setAbierto(false);
  }

  return (
    <div className={estilos.contrasena}>
      {abierto ? (
        <div className={estilos.formularioContrasena}>
          <FormularioContrasena
            textoBoton="Guardar"
            alGuardar={() => cerrar(true)}
            alCancelar={() => cerrar(false)}
          />
        </div>
      ) : (
        <Button
          ref={boton}
          variant="surface"
          onClick={() => {
            setCambiada(false);
            setAbierto(true);
          }}
        >
          Cambiar contraseña
        </Button>
      )}
      <p className={estilos.aviso} role="status">
        {cambiada ? 'Contraseña cambiada' : null}
      </p>
    </div>
  );
}
