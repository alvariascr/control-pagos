import { useState } from 'react'
import { formatoColones } from '../lib/formato'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { ProductoInput, ProductoInventario } from '../lib/types'
import Confirmacion from './Confirmacion'
import Modal from './Modal'
import ProductoForm from './ProductoForm'

// Hoja con el detalle de un producto: cuánto entró, cuánto se vendió y cuánto queda. Llama a
// onCambio después de guardar algo, para que la lista de afuera se recargue.
export default function ProductoDetalle({
  producto,
  onCerrar,
  onCambio,
}: {
  producto: ProductoInventario
  onCerrar: () => void
  onCambio: () => Promise<void>
}) {
  const { show } = useToast()
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const existencia = Number(producto.existencia)
  const ajustes = Number(producto.ajustes)
  const costo = producto.costo_promedio === null ? null : Number(producto.costo_promedio)
  const precio = producto.precio_venta === null ? null : Number(producto.precio_venta)

  async function guardar(datos: ProductoInput) {
    const { error } = await supabase
      .from('pagos_productos')
      .update(datos)
      .eq('id', producto.producto_id)
    if (error) {
      // 23505: ya hay otro producto con ese código.
      show(
        error.code === '23505' ? 'Ya existe un producto con ese código.' : 'No se pudo guardar.',
        'error',
      )
      return false
    }
    show('Cambios guardados.')
    setEditando(false)
    await onCambio()
    return true
  }

  async function eliminar() {
    const { error } = await supabase.from('pagos_productos').delete().eq('id', producto.producto_id)
    if (error) {
      // 23503: tiene pedidos o ventas.
      show(
        error.code === '23503'
          ? 'Este producto tiene pedidos o ventas. No se puede eliminar.'
          : 'No se pudo eliminar el producto.',
        'error',
      )
      return
    }
    show(`${producto.nombre} eliminado.`)
    onCerrar()
    await onCambio()
  }

  return (
    <Modal title={producto.nombre} onClose={onCerrar}>
      {editando ? (
        <>
          <ProductoForm
            inicial={{
              codigo: producto.codigo,
              nombre: producto.nombre,
              precio_venta: precio,
            }}
            textoBoton="Guardar cambios"
            onGuardar={guardar}
          />
          <button className="btn-secondary" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <div className="resumen">
            <div className="resumen-fila">
              <span>Han entrado</span>
              <strong>{Number(producto.recibido)}</strong>
            </div>
            <div className="resumen-fila">
              <span>Se han vendido</span>
              <strong>{Number(producto.vendido)}</strong>
            </div>
            {ajustes !== 0 && (
              <div className="resumen-fila">
                <span>Ajustes de conteo</span>
                <strong>{ajustes > 0 ? `+${ajustes}` : ajustes}</strong>
              </div>
            )}
            <div
              className={`resumen-fila resumen-destacado ${existencia > 0 ? 'positivo' : 'pendiente'}`}
            >
              <span>Quedan</span>
              <strong>{existencia}</strong>
            </div>
          </div>
          {existencia < 0 && (
            <p className="nota">
              Hay más ventas que unidades registradas. Revisa los pedidos o usa "Contar inventario".
            </p>
          )}

          <div className="resumen resumen-separado">
            <div className="resumen-fila">
              <span>Código</span>
              <strong>{producto.codigo ?? 'Sin código'}</strong>
            </div>
            <div className="resumen-fila">
              <span>Costo promedio</span>
              <strong>{costo === null ? 'Sin pedidos' : formatoColones(costo)}</strong>
            </div>
            <div className="resumen-fila">
              <span>Precio de venta</span>
              <strong>{precio === null ? 'Sin precio' : formatoColones(precio)}</strong>
            </div>
            {costo !== null && precio !== null && (
              <div className="resumen-fila">
                <span>Ganancia por unidad</span>
                <strong>{formatoColones(precio - costo)}</strong>
              </div>
            )}
          </div>

          <div className="acciones">
            <button className="btn-secondary" onClick={() => setEditando(true)}>
              Editar producto
            </button>
          </div>
          <button className="btn-danger" onClick={() => setConfirmando(true)}>
            Eliminar producto
          </button>
          {confirmando && (
            <Confirmacion
              pregunta={`¿Eliminar "${producto.nombre}"? No se puede deshacer.`}
              textoConfirmar="Sí, eliminar"
              onConfirmar={eliminar}
              onCancelar={() => setConfirmando(false)}
            />
          )}
        </>
      )}
    </Modal>
  )
}
