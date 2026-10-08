import { useCallback, useEffect, useState } from 'react'
import { formatoColones, formatoFecha } from '../lib/formato'
import { MAXIMO_PAGO_PEDIDO } from '../lib/limites'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { AbonoInput, ItemPedido, PagoPedido, PedidoInput, PedidoSaldo } from '../lib/types'
import { estadoPedido } from '../lib/vencimiento'
import AbonoForm from './AbonoForm'
import Confirmacion from './Confirmacion'
import Modal from './Modal'
import PedidoForm from './PedidoForm'

// Hoja con el detalle de un pedido: lo que trae, lo pagado y lo que se debe. Llama a onCambio
// después de guardar algo, para que la lista de afuera se recargue.
export default function PedidoDetalle({
  pedido,
  onCerrar,
  onCambio,
}: {
  pedido: PedidoSaldo
  onCerrar: () => void
  onCambio: () => Promise<void>
}) {
  const { show } = useToast()
  const [items, setItems] = useState<ItemPedido[] | null>(null)
  const [pagos, setPagos] = useState<PagoPedido[] | null>(null)
  const [pagando, setPagando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editandoPago, setEditandoPago] = useState<PagoPedido | null>(null)
  const [confirmando, setConfirmando] = useState<'pedido' | 'pago' | null>(null)

  const saldo = Number(pedido.saldo)
  const estado = estadoPedido(saldo, pedido.vencimiento)

  const cargarDetalle = useCallback(async () => {
    const [itemsRes, pagosRes] = await Promise.all([
      supabase
        .from('pagos_pedido_items')
        .select('id, cantidad, costo_unitario, producto:pagos_productos(codigo, nombre)')
        .eq('pedido_id', pedido.pedido_id)
        .order('creado_en'),
      supabase
        .from('pagos_pedido_pagos')
        .select('id, fecha, monto, nota')
        .eq('pedido_id', pedido.pedido_id)
        .order('fecha', { ascending: false }),
    ])
    if (itemsRes.error || pagosRes.error) {
      show('No se pudo cargar el pedido.', 'error')
      return
    }
    // Cada artículo trae un solo producto, aunque el cliente sin tipos lo vea como lista.
    setItems(itemsRes.data as unknown as ItemPedido[])
    setPagos(pagosRes.data)
  }, [pedido.pedido_id, show])

  useEffect(() => {
    cargarDetalle()
  }, [cargarDetalle])

  async function agregarPago(datos: AbonoInput) {
    const { error } = await supabase.from('pagos_pedido_pagos').insert({
      fecha: datos.fecha ?? undefined,
      monto: datos.monto,
      nota: datos.nota,
      pedido_id: pedido.pedido_id,
    })
    if (error) {
      show('No se pudo guardar el pago.', 'error')
      return false
    }
    show('Pago guardado.')
    setPagando(false)
    await cargarDetalle()
    await onCambio()
    return true
  }

  async function actualizarPago(datos: AbonoInput) {
    if (!editandoPago) return false
    const { error } = await supabase
      .from('pagos_pedido_pagos')
      .update({ fecha: datos.fecha ?? undefined, monto: datos.monto, nota: datos.nota })
      .eq('id', editandoPago.id)
    if (error) {
      show('No se pudieron guardar los cambios.', 'error')
      return false
    }
    show('Cambios guardados.')
    cerrarPago()
    await cargarDetalle()
    await onCambio()
    return true
  }

  async function eliminarPago() {
    if (!editandoPago) return
    const { error } = await supabase.from('pagos_pedido_pagos').delete().eq('id', editandoPago.id)
    if (error) {
      show('No se pudo eliminar el pago.', 'error')
      return
    }
    show('Pago eliminado.')
    cerrarPago()
    await cargarDetalle()
    await onCambio()
  }

  function cerrarPago() {
    setEditandoPago(null)
    setConfirmando(null)
  }

  async function guardarEncabezado(datos: PedidoInput) {
    const { error } = await supabase.from('pagos_pedidos').update(datos).eq('id', pedido.pedido_id)
    if (error) {
      // 23505: ya hay otro pedido con ese número del mismo proveedor.
      show(
        error.code === '23505'
          ? 'Ya existe un pedido con ese número de ese proveedor.'
          : 'No se pudieron guardar los cambios.',
        'error',
      )
      return false
    }
    show('Cambios guardados.')
    setEditando(false)
    await onCambio()
    return true
  }

  async function eliminarPedido() {
    const { error } = await supabase.from('pagos_pedidos').delete().eq('id', pedido.pedido_id)
    if (error) {
      show('No se pudo eliminar el pedido.', 'error')
      return
    }
    show(`Pedido ${pedido.numero} eliminado.`)
    onCerrar()
    await onCambio()
  }

  return (
    <>
      <Modal title={`Pedido ${pedido.numero}`} onClose={onCerrar}>
        {editando ? (
          <>
            <PedidoForm
              inicial={{
                numero: pedido.numero,
                proveedor: pedido.proveedor,
                fecha: pedido.fecha,
                vencimiento: pedido.vencimiento,
              }}
              productos={[]}
              textoBoton="Guardar cambios"
              onGuardar={guardarEncabezado}
            />
            <button className="btn-secondary" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <p className="nota nota-arriba">
              {pedido.proveedor} · {formatoFecha(pedido.fecha)}
              {pedido.vencimiento && ` · vence ${formatoFecha(pedido.vencimiento)}`}
            </p>
            <div className="resumen">
              <div className="resumen-fila">
                <span>Total ({Number(pedido.unidades)} unidades)</span>
                <strong>{formatoColones(Number(pedido.total))}</strong>
              </div>
              <div className="resumen-fila">
                <span>Pagado</span>
                <strong>{formatoColones(Number(pedido.pagado))}</strong>
              </div>
              <div
                className={`resumen-fila resumen-destacado ${saldo <= 0 ? 'positivo' : 'pendiente'}`}
              >
                <span>{saldo < 0 ? 'Pagado de más' : saldo === 0 ? 'Pagado' : 'Debes'}</span>
                <strong>{formatoColones(Math.abs(saldo))}</strong>
              </div>
            </div>
            {saldo > 0 && <p className={`nota estado-${estado.nivel}`}>{estado.texto}</p>}

            <div className="acciones">
              <button className="btn-primary" onClick={() => setPagando(!pagando)}>
                + Pago
              </button>
            </div>
            {pagando && (
              <div className="card card-form">
                <AbonoForm
                  etiqueta="Pago (₡)"
                  maximo={MAXIMO_PAGO_PEDIDO}
                  fechaRequerida
                  textoBoton="Guardar pago"
                  onGuardar={agregarPago}
                />
              </div>
            )}

            <div className="section-title">Artículos</div>
            {items === null ? (
              <div className="empty-state">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="empty-state">Este pedido no tiene artículos.</div>
            ) : (
              <ul className="lista">
                {items.map((i) => (
                  <li key={i.id} className="lista-item lista-item-fija">
                    <span className="lista-texto">
                      <span className="lista-descripcion">
                        {i.cantidad} × {i.producto?.nombre ?? 'Producto eliminado'}
                      </span>
                      <span className="lista-detalle">
                        {i.producto?.codigo ?? 'Sin código'} ·{' '}
                        {formatoColones(Number(i.costo_unitario))} c/u
                      </span>
                    </span>
                    <span className="lista-monto">
                      {formatoColones(i.cantidad * Number(i.costo_unitario))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="section-title">Pagos</div>
            {pagos === null ? (
              <div className="empty-state">Cargando...</div>
            ) : pagos.length === 0 ? (
              <div className="empty-state">Todavía no hay pagos.</div>
            ) : (
              <ul className="lista">
                {pagos.map((p) => (
                  <li key={p.id}>
                    <button className="lista-item" onClick={() => setEditandoPago(p)}>
                      <span className="lista-texto">
                        <span className="lista-descripcion">{p.nota ?? 'Pago'}</span>
                        <span className="lista-detalle">{formatoFecha(p.fecha)}</span>
                      </span>
                      <span className="lista-monto positivo">
                        {formatoColones(Number(p.monto))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="nota">
              Para corregir los artículos, elimina el pedido y créalo de nuevo. Los productos y el
              inventario se ajustan solos.
            </p>
            <div className="acciones">
              <button className="btn-secondary" onClick={() => setEditando(true)}>
                Editar nota y fechas
              </button>
            </div>
            <button className="btn-danger" onClick={() => setConfirmando('pedido')}>
              Eliminar pedido
            </button>
            {confirmando === 'pedido' && (
              <Confirmacion
                pregunta={`¿Eliminar el pedido ${pedido.numero} con sus artículos y pagos? Baja el inventario y no se puede deshacer.`}
                textoConfirmar="Sí, eliminar"
                onConfirmar={eliminarPedido}
                onCancelar={() => setConfirmando(null)}
              />
            )}
          </>
        )}
      </Modal>

      {editandoPago && (
        <Modal title="Editar pago" onClose={cerrarPago}>
          <AbonoForm
            etiqueta="Pago (₡)"
            maximo={MAXIMO_PAGO_PEDIDO}
            fechaRequerida
            inicial={{
              monto: Number(editandoPago.monto),
              fecha: editandoPago.fecha,
              nota: editandoPago.nota,
            }}
            textoBoton="Guardar cambios"
            onGuardar={actualizarPago}
          />
          {confirmando === 'pago' ? (
            <Confirmacion
              pregunta="¿Eliminar este pago? No se puede deshacer."
              textoConfirmar="Sí, eliminar"
              onConfirmar={eliminarPago}
              onCancelar={() => setConfirmando(null)}
            />
          ) : (
            <button className="btn-danger" onClick={() => setConfirmando('pago')}>
              Eliminar
            </button>
          )}
        </Modal>
      )}
    </>
  )
}
