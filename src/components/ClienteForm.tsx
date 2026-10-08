import { useState, type FormEvent } from 'react'
import { MAXIMO_NOMBRE, MAXIMO_TELEFONO } from '../lib/limites'
import { filtrarTelefono, filtrarTexto, limpiarTexto, telefonoValido } from '../lib/sanitizar'
import type { ClienteInput } from '../lib/types'

// Formulario de cliente. Se usa para agregar (vacío) y para editar (con valores).
export default function ClienteForm({
  inicial,
  textoBoton,
  onGuardar,
}: {
  inicial?: ClienteInput
  textoBoton: string
  // Devuelve true si se guardó, para limpiar el formulario solo en ese caso.
  onGuardar: (datos: ClienteInput) => Promise<boolean>
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '')
  const [guardando, setGuardando] = useState(false)

  const telefonoOk = telefonoValido(telefono)
  const valido = limpiarTexto(nombre) !== '' && telefonoOk

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    const ok = await onGuardar({
      nombre: limpiarTexto(nombre, MAXIMO_NOMBRE),
      telefono: telefono.trim() === '' ? null : telefono.trim(),
    })
    setGuardando(false)
    if (ok && !inicial) {
      setNombre('')
      setTelefono('')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="cliente-nombre">Nombre</label>
        <input
          id="cliente-nombre"
          value={nombre}
          maxLength={MAXIMO_NOMBRE}
          placeholder="Ej: María Pérez"
          onChange={(e) => setNombre(filtrarTexto(e.target.value, MAXIMO_NOMBRE))}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="cliente-telefono">Teléfono (opcional)</label>
        <input
          id="cliente-telefono"
          type="tel"
          inputMode="tel"
          value={telefono}
          maxLength={MAXIMO_TELEFONO}
          placeholder="Ej: 8888 8888"
          aria-invalid={!telefonoOk}
          onChange={(e) => setTelefono(filtrarTelefono(e.target.value))}
        />
        {!telefonoOk && <p className="campo-error">El teléfono debe tener entre 8 y 15 dígitos.</p>}
      </div>
      <p className="nota nota-form">Con el teléfono puedes mandar un recordatorio por WhatsApp.</p>
      <button className="btn-primary" type="submit" disabled={!valido || guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
