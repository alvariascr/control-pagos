import { useCallback, useEffect, useState } from 'react'
import { formatoColones, formatoFecha } from '../lib/formato'
import { ordenarMovimientos } from '../lib/movimientos'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type {
  Abono,
  AbonoInput,
  ClienteInput,
  Compra,
  CompraInput,
  Movimiento,
  ProductoInventario,
  SaldoCliente,
} from '../lib/types'
import { enlaceRecordatorio } from '../lib/whatsapp'
import AbonoForm from './AbonoForm'
import ClienteForm from './ClienteForm'
import CompraForm from './CompraForm'
import Confirmacion from './Confirmacion'
import Modal from './Modal'

type Formulario = 'abono' | 'compra' | null

// Hoja con el detalle de un cliente: cuánto se ha llevado, cuánto ha abonado, cuánto debe y
// el historial. Llama a onCambio después de guardar algo, para que la lista de afuera se
// recargue con los saldos al día.
export default function ClienteDetalle({
  cliente,
  onCerrar,
  onCambio,
}: {
  cliente: SaldoCliente
  onCerrar: () => void
  onCambio: () => Promise<void>
}) {
  const { show } = useToast()
  const [compras, setCompras] = useState<Compra[] | null>(null)
  const [abonos, setAbonos] = useState<Abono[] | null>(null)
  // Inventario actual, para elegir el producto de una venta y avisar si no alcanza.
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [formulario, setFormulario] = useState<Formulario>(null)
  const [editandoCliente, setEditandoCliente] = useState(false)
  const [editandoMovimiento, setEditandoMovimiento] = useState<Movimiento | null>(null)
  const [confirmando, setConfirmando] = useState<'cliente' | 'movimiento' | null>(null)

  const saldo = Number(cliente.saldo)
  const alDia = saldo === 0
  const aFavor = saldo < 0

  const cargarMovimientos = useCallback(async () => {
    const [comprasRes, abonosRes, productosRes] = await Promise.all([
      supabase
        .from('pagos_compras')
        .select('id, fecha, descripcion, monto, producto_id, cantidad, creado_en')
        .eq('cliente_id', cliente.cliente_id),
      supabase
        .from('pagos_abonos')
        .select('id, fecha, monto, nota, creado_en')
        .eq('cliente_id', cliente.cliente_id),
      supabase.from('pagos_v_inventario').select('*').order('nombre'),
    ])
    if (comprasRes.error || abonosRes.error || productosRes.error) {
      show('No se pudo cargar el historial.', 'error')
      return
    }
    setCompras(comprasRes.data)
    setAbonos(abonosRes.data)
    setProductos(productosRes.data)
  }, [cliente.cliente_id, show])

  useEffect(() => {
    cargarMovimientos()
  }, [cargarMovimientos])

  async function agregarAbono(datos: AbonoInput) {
    const { error } = await supabase
      .from('pagos_abonos')
      .insert({ ...datos, cliente_id: cliente.cliente_id })
    if (error) {
      show('No se pudo guardar el abono.', 'error')
      return false
    }
    show('Abono guardado.')
    setFormulario(null)
    await cargarMovimientos()
    await onCambio()
    return true
  }

  async function agregarCompra(datos: CompraInput, yaPago: boolean) {
    const { error } = await supabase
      .from('pagos_compras')
      .insert({ ...datos, cliente_id: cliente.cliente_id })
    if (error) {
      show('No se pudo guardar el artículo.', 'error')
      return false
    }
    if (yaPago) {
      // De contado: se anota un abono por el mismo monto para que no quede saldo.
      const { error: errorAbono } = await supabase.from('pagos_abonos').insert({
        cliente_id: cliente.cliente_id,
        fecha: datos.fecha,
        monto: datos.monto,
        nota: 'De contado',
      })
      if (errorAbono) {
        show('Se guardó el artículo, pero no el pago. Anota el abono a mano.', 'error')
        setFormulario(null)
        await cargarMovimientos()
        await onCambio()
        return true
      }
    }
    show(yaPago ? 'Artículo y pago guardados.' : 'Artículo guardado.')
    setFormulario(null)
    await cargarMovimientos()
    await onCambio()
    return true
  }

  async function actualizarMovimiento(movimiento: Movimiento, datos: AbonoInput | CompraInput) {
    const tabla = movimiento.tipo === 'abono' ? 'pagos_abonos' : 'pagos_compras'
    const { error } = await supabase.from(tabla).update(datos).eq('id', movimiento.datos.id)
    if (error) {
      show('No se pudieron guardar los cambios.', 'error')
      return false
    }
    show('Cambios guardados.')
    cerrarMovimiento()
    await cargarMovimientos()
    await onCambio()
    return true
  }

  async function eliminarMovimiento() {
    if (!editandoMovimiento) return
    const tabla = editandoMovimiento.tipo === 'abono' ? 'pagos_abonos' : 'pagos_compras'
    const { error } = await supabase.from(tabla).delete().eq('id', editandoMovimiento.datos.id)
    if (error) {
      show('No se pudo eliminar.', 'error')
      return
    }
    show(editandoMovimiento.tipo === 'abono' ? 'Abono eliminado.' : 'Artículo eliminado.')
    cerrarMovimiento()
    await cargarMovimientos()
    await onCambio()
  }

  function cerrarMovimiento() {
    setEditandoMovimiento(null)
    setConfirmando(null)
  }

  async function guardarCliente(datos: ClienteInput) {
    const { error } = await supabase
      .from('pagos_clientes')
      .update(datos)
      .eq('id', cliente.cliente_id)
    if (error) {
      show('No se pudieron guardar los cambios.', 'error')
      return false
    }
    show('Cambios guardados.')
    setEditandoCliente(false)
    await onCambio()
    return true
  }

  async function eliminarCliente() {
    const { error } = await supabase.from('pagos_clientes').delete().eq('id', cliente.cliente_id)
    if (error) {
      show('No se pudo eliminar el cliente.', 'error')
      return
    }
    show(`${cliente.nombre} eliminado.`)
    onCerrar()
    await onCambio()
  }

  function alternar(cual: Exclude<Formulario, null>) {
    setFormulario(formulario === cual ? null : cual)
  }

  const movimientos = compras && abonos ? ordenarMovimientos(compras, abonos) : null
  const recordatorio =
    saldo > 0 ? enlaceRecordatorio(cliente.nombre, cliente.telefono, saldo) : null

  return (
    <>
      <Modal title={cliente.nombre} onClose={onCerrar}>
        {editandoCliente ? (
          <>
            <ClienteForm
              inicial={{ nombre: cliente.nombre, telefono: cliente.telefono }}
              textoBoton="Guardar cambios"
              onGuardar={guardarCliente}
            />
            <button className="btn-secondary" onClick={() => setEditandoCliente(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="resumen">
              <div className="resumen-fila">
                <span>Se ha llevado</span>
                <strong>{formatoColones(Number(cliente.total_compras))}</strong>
              </div>
              <div className="resumen-fila">
                <span>Ha abonado</span>
                <strong>{formatoColones(Number(cliente.total_abonos))}</strong>
              </div>
              <div
                className={`resumen-fila resumen-destacado ${alDia || aFavor ? 'positivo' : 'pendiente'}`}
              >
                <span>{aFavor ? 'A favor' : alDia ? 'Al día' : 'Debe'}</span>
                <strong>{formatoColones(Math.abs(saldo))}</strong>
              </div>
            </div>

            <div className="acciones">
              <button className="btn-primary" onClick={() => alternar('abono')}>
                + Abono
              </button>
              <button className="btn-secondary" onClick={() => alternar('compra')}>
                + Artículo
              </button>
            </div>

            {formulario === 'abono' && (
              <div className="card card-form">
                <AbonoForm textoBoton="Guardar abono" onGuardar={agregarAbono} />
              </div>
            )}
            {formulario === 'compra' && (
              <div className="card card-form">
                <CompraForm
                  productos={productos}
                  textoBoton="Guardar artículo"
                  onGuardar={agregarCompra}
                />
              </div>
            )}

            {recordatorio && (
              <a className="btn-whatsapp" href={recordatorio} target="_blank" rel="noreferrer">
                Recordar el saldo por WhatsApp
              </a>
            )}

            <div className="section-title">Historial</div>
            {movimientos === null ? (
              <div className="empty-state">Cargando...</div>
            ) : movimientos.length === 0 ? (
              <div className="empty-state">Todavía no hay movimientos.</div>
            ) : (
              <ul className="lista">
                {movimientos.map((m) => (
                  <li key={`${m.tipo}-${m.datos.id}`}>
                    <button className="lista-item" onClick={() => setEditandoMovimiento(m)}>
                      <span className="lista-texto">
                        <span className="lista-descripcion">
                          {m.tipo === 'compra'
                            ? `${m.datos.cantidad > 1 ? `${m.datos.cantidad} × ` : ''}${m.datos.descripcion}`
                            : (m.datos.nota ?? 'Abono')}
                        </span>
                        <span className="lista-detalle">
                          {m.datos.fecha ? formatoFecha(m.datos.fecha) : 'Sin fecha'} ·{' '}
                          {m.tipo === 'compra' ? 'Artículo' : 'Abono'}
                        </span>
                      </span>
                      <span className={`lista-monto ${m.tipo === 'abono' ? 'positivo' : ''}`}>
                        {m.tipo === 'abono' ? '+ ' : ''}
                        {formatoColones(Number(m.datos.monto))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="acciones">
              <button className="btn-secondary" onClick={() => setEditandoCliente(true)}>
                Editar cliente
              </button>
            </div>
            <button className="btn-danger" onClick={() => setConfirmando('cliente')}>
              Eliminar cliente
            </button>
            {confirmando === 'cliente' && (
              <Confirmacion
                pregunta={`¿Eliminar a ${cliente.nombre} con todo su historial? No se puede deshacer.`}
                textoConfirmar="Sí, eliminar"
                onConfirmar={eliminarCliente}
                onCancelar={() => setConfirmando(null)}
              />
            )}
          </>
        )}
      </Modal>

      {editandoMovimiento && (
        <Modal
          title={editandoMovimiento.tipo === 'abono' ? 'Editar abono' : 'Editar artículo'}
          onClose={cerrarMovimiento}
        >
          {editandoMovimiento.tipo === 'abono' ? (
            <AbonoForm
              inicial={{
                monto: Number(editandoMovimiento.datos.monto),
                fecha: editandoMovimiento.datos.fecha,
                nota: editandoMovimiento.datos.nota,
              }}
              textoBoton="Guardar cambios"
              onGuardar={(datos) => actualizarMovimiento(editandoMovimiento, datos)}
            />
          ) : (
            <CompraForm
              inicial={{
                descripcion: editandoMovimiento.datos.descripcion,
                monto: Number(editandoMovimiento.datos.monto),
                fecha: editandoMovimiento.datos.fecha,
                producto_id: editandoMovimiento.datos.producto_id,
                cantidad: editandoMovimiento.datos.cantidad,
              }}
              productos={productos}
              textoBoton="Guardar cambios"
              onGuardar={(datos) => actualizarMovimiento(editandoMovimiento, datos)}
            />
          )}
          {confirmando === 'movimiento' ? (
            <Confirmacion
              pregunta="¿Eliminar este movimiento? No se puede deshacer."
              textoConfirmar="Sí, eliminar"
              onConfirmar={eliminarMovimiento}
              onCancelar={() => setConfirmando(null)}
            />
          ) : (
            <button className="btn-danger" onClick={() => setConfirmando('movimiento')}>
              Eliminar
            </button>
          )}
        </Modal>
      )}
    </>
  )
}
