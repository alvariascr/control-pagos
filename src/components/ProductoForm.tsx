import { useState, type FormEvent } from 'react'
import { MAXIMO_CODIGO, MAXIMO_MONTO, MAXIMO_NOMBRE_PRODUCTO } from '../lib/limites'
import { filtrarCodigo, filtrarTexto, limpiarTexto } from '../lib/sanitizar'
import type { ProductoInput } from '../lib/types'
import CampoMonto from './CampoMonto'

// Formulario de producto. Se usa para agregar (vacío) y para editar (con valores).
export default function ProductoForm({
  inicial,
  textoBoton,
  onGuardar,
}: {
  inicial?: ProductoInput
  textoBoton: string
  // Devuelve true si se guardó, para limpiar el formulario solo en ese caso.
  onGuardar: (datos: ProductoInput) => Promise<boolean>
}) {
  const [codigo, setCodigo] = useState(inicial?.codigo ?? '')
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [precio, setPrecio] = useState(
    inicial?.precio_venta != null ? String(inicial.precio_venta) : '',
  )
  const [guardando, setGuardando] = useState(false)

  // Vacío = todavía sin precio de venta.
  const precioNumero = Number(precio)
  const valido = limpiarTexto(nombre) !== '' && precioNumero >= 0 && precioNumero <= MAXIMO_MONTO

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    const codigoLimpio = filtrarCodigo(codigo, MAXIMO_CODIGO).trim()
    const ok = await onGuardar({
      codigo: codigoLimpio === '' ? null : codigoLimpio,
      nombre: limpiarTexto(nombre, MAXIMO_NOMBRE_PRODUCTO),
      precio_venta: precio === '' ? null : precioNumero,
    })
    setGuardando(false)
    if (ok && !inicial) {
      setCodigo('')
      setNombre('')
      setPrecio('')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="producto-nombre">Nombre</label>
        <input
          id="producto-nombre"
          value={nombre}
          maxLength={MAXIMO_NOMBRE_PRODUCTO}
          placeholder="Ej: Olla granito 24 cm"
          onChange={(e) => setNombre(filtrarTexto(e.target.value, MAXIMO_NOMBRE_PRODUCTO))}
          required
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="producto-codigo">Código (opcional)</label>
          <input
            id="producto-codigo"
            value={codigo}
            maxLength={MAXIMO_CODIGO}
            placeholder="Ej: 0321-1"
            onChange={(e) => setCodigo(filtrarCodigo(e.target.value, MAXIMO_CODIGO))}
          />
        </div>
        <CampoMonto
          id="producto-precio"
          label="Precio de venta (₡)"
          valor={precio}
          maximo={MAXIMO_MONTO}
          requerido={false}
          onChange={setPrecio}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={!valido || guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
