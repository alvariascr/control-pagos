import { useCallback, useEffect, useState } from 'react'
import Modal from '../components/Modal'
import PedidoDetalle from '../components/PedidoDetalle'
import PedidoForm from '../components/PedidoForm'
import { formatoColones, formatoFecha } from '../lib/formato'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { ItemPedidoInput, PedidoInput, PedidoSaldo, ProductoInventario } from '../lib/types'
import { estadoPedido } from '../lib/vencimiento'

type Filtro = 'pendientes' | 'todos'

// Lista de pedidos al proveedor con lo que se debe de cada uno. Al tocar uno se abre su
// detalle, donde se registran los pagos.
export default function Pedidos() {
  const { show } = useToast()
  const [pedidos, setPedidos] = useState<PedidoSaldo[]>([])
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [agregando, setAgregando] = useState(false)
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('pendientes')

  const cargar = useCallback(async () => {
    const [pedidosRes, productosRes] = await Promise.all([
      // Los más recientes primero.
      supabase
        .from('pagos_v_pedido_saldo')
        .select('*')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false }),
      supabase.from('pagos_v_inventario').select('*').order('nombre'),
    ])
    if (pedidosRes.error || productosRes.error) {
      show('No se pudieron cargar los pedidos.', 'error')
    } else {
      setPedidos(pedidosRes.data)
      setProductos(productosRes.data)
    }
    setCargando(false)
  }, [show])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Crea el pedido y después sus artículos. Si los artículos fallan, borra el pedido para no
  // dejar uno vacío.
  async function agregar(datos: PedidoInput, items: ItemPedidoInput[]) {
    const { data, error } = await supabase.from('pagos_pedidos').insert(datos).select('id').single()
    if (error) {
      // 23505: ya hay un pedido con ese número del mismo proveedor.
      show(
        error.code === '23505'
          ? 'Ya existe un pedido con ese número de ese proveedor.'
          : 'No se pudo guardar el pedido.',
        'error',
      )
      return false
    }
    const { error: errorItems } = await supabase
      .from('pagos_pedido_items')
      .insert(items.map((i) => ({ ...i, pedido_id: data.id })))
    if (errorItems) {
      await supabase.from('pagos_pedidos').delete().eq('id', data.id)
      show('No se pudieron guardar los artículos del pedido.', 'error')
      return false
    }
    show(`Pedido ${datos.numero} guardado.`)
    setAgregando(false)
    await cargar()
    return true
  }

  // Se busca en la lista recargada para que el detalle muestre los números al día.
  const abierto = pedidos.find((p) => p.pedido_id === abiertoId) ?? null

  const pendientes = pedidos.filter((p) => Number(p.saldo) > 0)
  const deuda = pendientes.reduce((suma, p) => suma + Number(p.saldo), 0)
  const visibles = filtro === 'todos' ? pedidos : pendientes

  return (
    <>
      <div className="encabezado">
        <h2>Pedidos</h2>
        <button className="btn-agregar" onClick={() => setAgregando(true)}>
          + Nuevo pedido
        </button>
      </div>

      <div className="total-bar">
        <span>
          Debes al proveedor
          {pendientes.length > 0 &&
            ` (${pendientes.length} ${pendientes.length === 1 ? 'pedido' : 'pedidos'})`}
        </span>
        <strong>{formatoColones(deuda)}</strong>
      </div>

      <div className="filtros">
        <div className="type-toggle">
          <button
            type="button"
            className={filtro === 'pendientes' ? 'active' : ''}
            onClick={() => setFiltro('pendientes')}
          >
            Por pagar
          </button>
          <button
            type="button"
            className={filtro === 'todos' ? 'active' : ''}
            onClick={() => setFiltro('todos')}
          >
            Todos
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="empty-state">Cargando...</div>
      ) : pedidos.length === 0 ? (
        <div className="empty-state">Todavía no hay pedidos. Agrega el primero arriba.</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">No debes nada a los proveedores.</div>
      ) : (
        <ul className="lista">
          {visibles.map((p) => (
            <FilaPedido key={p.pedido_id} pedido={p} onAbrir={setAbiertoId} />
          ))}
        </ul>
      )}

      {agregando && (
        <Modal title="Nuevo pedido" onClose={() => setAgregando(false)}>
          <PedidoForm productos={productos} textoBoton="Guardar pedido" onGuardar={agregar} />
        </Modal>
      )}

      {abierto && (
        <PedidoDetalle
          key={abierto.pedido_id}
          pedido={abierto}
          onCerrar={() => setAbiertoId(null)}
          onCambio={cargar}
        />
      )}
    </>
  )
}

function FilaPedido({
  pedido,
  onAbrir,
}: {
  pedido: PedidoSaldo
  onAbrir: (pedidoId: string) => void
}) {
  const saldo = Number(pedido.saldo)
  const estado = estadoPedido(saldo, pedido.vencimiento)
  return (
    <li>
      <button className="lista-item" onClick={() => onAbrir(pedido.pedido_id)}>
        <span className="lista-texto">
          <span className="lista-descripcion">Nota {pedido.numero}</span>
          <span className="lista-detalle">
            {formatoFecha(pedido.fecha)} · {Number(pedido.unidades)}{' '}
            {Number(pedido.unidades) === 1 ? 'artículo' : 'artículos'}
          </span>
        </span>
        <span className="lista-valor">
          {saldo > 0 ? (
            <>
              <span className="lista-monto">{formatoColones(saldo)}</span>
              <span className={`lista-detalle estado-${estado.nivel}`}>{estado.texto}</span>
            </>
          ) : (
            <>
              <span className="lista-monto positivo">Pagado</span>
              <span className="lista-detalle">{formatoColones(Number(pedido.total))}</span>
            </>
          )}
        </span>
      </button>
    </li>
  )
}
