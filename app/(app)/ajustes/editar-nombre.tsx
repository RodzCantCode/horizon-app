'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button, PencilIcon, TextField } from 'mochi-ui';
import { BotonesGuardar, useEnvio } from '../componentes/edicion';
import { useFocoAlCambiarDeVista } from '../componentes/Panel';
import { cambiarNombre } from './acciones';
import estilos from './ajustes.module.css';

// Tu nombre: se lee con su lápiz y, al pulsarlo, pasa a un campo con **Guardar** y **Cancelar**,
// como los paneles de Semanas y Estrategias. Guardar vuelve a leer a la vez que llega el nombre
// nuevo (la acción refresca la página); el foco va al campo al editar y al lápiz al volver.
export function EditarNombre({ nombre }: { nombre: string }) {
  const [editando, setEditando] = useState(false);
  const zona = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(editando ? 'editar' : 'ver', zona);

  return (
    <div ref={zona}>
      {editando ? (
        <FormularioNombre nombre={nombre} alTerminar={() => setEditando(false)} />
      ) : (
        <div className={estilos.nombre}>
          <div className={estilos.dato}>
            <span className={estilos.etiqueta}>Tu nombre</span>
            <span className={estilos.valor}>{nombre}</span>
          </div>
          <Button variant="surface" iconOnly aria-label="Editar" onClick={() => setEditando(true)}>
            <PencilIcon size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}

// Se monta solo mientras se edita, así el campo y el error empiezan limpios cada vez.
function FormularioNombre({ nombre, alTerminar }: { nombre: string; alTerminar: () => void }) {
  const [valor, setValor] = useState(nombre);
  const { enviando, error, enviar } = useEnvio();

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    enviar(() => cambiarNombre(valor), alTerminar);
  }

  return (
    <form className={estilos.formularioNombre} onSubmit={guardar} noValidate>
      <TextField label="Tu nombre" name="nombre" autoComplete="name" value={valor} onValueChange={setValor} />
      <BotonesGuardar guardando={enviando} error={error} alCancelar={alTerminar} />
    </form>
  );
}
