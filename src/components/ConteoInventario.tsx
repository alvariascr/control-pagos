import { useState } from 'react'
import { MAXIMO_CANTIDAD } from '../lib/limites'
import { digitosDe, soloDigitos } from '../lib/sanitizar'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { ProductoInventario } from '../lib/types'
import Modal from './Modal'

// Conteo físico: se escribe cuánto hay realmente de cada producto y la app guarda la diferencia
// como ajuste. Lo que se deja vacío no cambia.
export default function ConteoInventario({
  productos,
  onCerrar,
  onGuardado,
}: {
  productos: ProductoInventario[]
  onCerrar: () => void
  onGuardado: () => Promise<void>
}) {
  const { show } = useToast()
  const [conteos, setConteos] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  // Productos con un número escrito que cambia la existencia que tiene la app.
  const cambios = productos.flatMap((p) => {
    const texto = conteos[p.producto_id] ?? ''
    if (texto === '') return []
    const diferencia = Number(texto) - Number(p.existencia)
    return diferencia === 0 ? [] : [{ producto_id: p.producto_id, diferencia }]
  })

  const invalidos = productos.some((p) => {
    const texto = conteos[p.producto_id] ?? ''
    if (texto === '') return false
    const n = Number(texto)
    return !Number.isInteger(n) || n < 0 || Math.abs(n - Number(p.existencia)) > MAXIMO_CANTIDAD
  })

  async function guardar() {
    if (cambios.length === 0 || invalidos) return
    setGuardando(true)
    const { error } = await supabase.from('pagos_ajustes').insert(
      cambios.map((c) => ({
        producto_id: c.producto_id,
        cantidad: c.diferencia,
        motivo: 'Conteo',
      })),
    )
    setGuardando(false)
    if (error) {
      show('No se pudo guardar el conteo.', 'error')
      return
    }
    show(`Conteo guardado (${cambios.length} ${cambios.length === 1 ? 'cambio' : 'cambios'}).`)
    onCerrar()
    await onGuardado()
  }

  return (
    <Modal title="Contar inventario" onClose={onCerrar}>
      <p className="nota nota-arriba">
        Escribe cuántas unidades hay de verdad en cada producto. Lo que dejes vacío no cambia.
      </p>
      <ul className="lista">
        {productos.map((p) => (
          <li key={p.producto_id} className="lista-item lista-item-fija">
            <span className="lista-texto">
              <span className="lista-descripcion">{p.nombre}</span>
              <span className="lista-detalle">La app dice {Number(p.existencia)}</span>
            </span>
            <input
              className="conteo-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={digitosDe(MAXIMO_CANTIDAD)}
              placeholder="—"
              aria-label={`Cantidad real de ${p.nombre}`}
              value={conteos[p.producto_id] ?? ''}
              onChange={(e) =>
                setConteos({
                  ...conteos,
                  [p.producto_id]: soloDigitos(e.target.value, digitosDe(MAXIMO_CANTIDAD)),
                })
              }
            />
          </li>
        ))}
      </ul>
      <button
        className="btn-primary conteo-guardar"
        onClick={guardar}
        disabled={cambios.length === 0 || invalidos || guardando}
      >
        {guardando
          ? 'Guardando...'
          : cambios.length === 0
            ? 'Guardar conteo'
            : `Guardar conteo (${cambios.length})`}
      </button>
    </Modal>
  )
}
