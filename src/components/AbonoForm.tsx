import { useState, type FormEvent } from 'react'
import { hoy } from '../lib/formato'
import { FECHA_MAXIMA, FECHA_MINIMA, MAXIMO_MONTO, MAXIMO_TEXTO } from '../lib/limites'
import { fechaValida, filtrarTexto, limpiarTexto } from '../lib/sanitizar'
import type { AbonoInput } from '../lib/types'
import CampoMonto from './CampoMonto'

// Formulario de abono (un pago del cliente). Se usa para agregar (vacío) y para editar
// (con valores).
export default function AbonoForm({
  inicial,
  textoBoton,
  etiqueta = 'Abono (₡)',
  maximo = MAXIMO_MONTO,
  fechaRequerida = false,
  onGuardar,
}: {
  inicial?: AbonoInput
  textoBoton: string
  // Texto del campo de monto y máximo permitido (los pagos a un proveedor pueden ser más altos).
  etiqueta?: string
  maximo?: number
  // Los abonos de clientes pueden quedar sin fecha (anotaciones viejas); otros pagos no.
  fechaRequerida?: boolean
  // Devuelve true si se guardó, para limpiar el formulario solo en ese caso.
  onGuardar: (datos: AbonoInput) => Promise<boolean>
}) {
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : '')
  // Al editar se respeta una fecha vacía (anotación vieja sin fecha).
  const [fecha, setFecha] = useState(inicial ? (inicial.fecha ?? '') : hoy())
  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [guardando, setGuardando] = useState(false)

  const montoNumero = Number(monto)
  const fechaOk = fecha === '' ? !fechaRequerida : fechaValida(fecha)
  const valido = montoNumero > 0 && montoNumero <= maximo && fechaOk

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    const ok = await onGuardar({
      monto: montoNumero,
      fecha: fecha === '' ? null : fecha,
      nota: limpiarTexto(nota) === '' ? null : limpiarTexto(nota, MAXIMO_TEXTO),
    })
    setGuardando(false)
    if (ok && !inicial) {
      setMonto('')
      setNota('')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-row">
        <CampoMonto
          id="abono-monto"
          label={etiqueta}
          valor={monto}
          maximo={maximo}
          onChange={setMonto}
        />
        <div className="field">
          <label htmlFor="abono-fecha">Fecha</label>
          <input
            id="abono-fecha"
            type="date"
            min={FECHA_MINIMA}
            max={FECHA_MAXIMA}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required={fechaRequerida}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="abono-nota">Nota (opcional)</label>
        <input
          id="abono-nota"
          value={nota}
          maxLength={MAXIMO_TEXTO}
          placeholder="Ej: Sinpe, efectivo"
          onChange={(e) => setNota(filtrarTexto(e.target.value, MAXIMO_TEXTO))}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={!valido || guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
