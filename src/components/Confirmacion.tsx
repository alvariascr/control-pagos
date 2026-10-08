import { useState } from 'react'

// Pregunta "¿Seguro?" para acciones que no se pueden deshacer, dentro de la misma app en vez
// de window.confirm (algunos navegadores lo bloquean y devuelve "no" sin mostrar nada).
export default function Confirmacion({
  pregunta,
  textoConfirmar,
  onConfirmar,
  onCancelar,
}: {
  pregunta: string
  textoConfirmar: string
  onConfirmar: () => Promise<void>
  onCancelar: () => void
}) {
  const [trabajando, setTrabajando] = useState(false)

  async function confirmar() {
    setTrabajando(true)
    await onConfirmar()
    setTrabajando(false)
  }

  return (
    <div className="confirmar">
      <p>{pregunta}</p>
      <div className="confirmar-botones">
        <button className="btn-secondary" onClick={onCancelar} disabled={trabajando}>
          Cancelar
        </button>
        <button className="btn-confirmar" onClick={confirmar} disabled={trabajando}>
          {trabajando ? 'Un momento...' : textoConfirmar}
        </button>
      </div>
    </div>
  )
}
