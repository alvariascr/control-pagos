import { useCallback, useEffect, useState } from 'react'
import ConteoInventario from '../components/ConteoInventario'
import Modal from '../components/Modal'
import ProductoDetalle from '../components/ProductoDetalle'
import ProductoForm from '../components/ProductoForm'
import { formatoColones } from '../lib/formato'
import { MAXIMO_NOMBRE_PRODUCTO } from '../lib/limites'
import { filtrarTexto } from '../lib/sanitizar'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { ProductoInput, ProductoInventario } from '../lib/types'

type Filtro = 'con-stock' | 'todos'

// Quita tildes y mayúsculas para que "sarten" encuentre "Sartén".
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Lista de productos con lo que queda de cada uno. Al tocar uno se abre su detalle.
export default function Inventario() {
  const { show } = useToast()
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [agregando, setAgregando] = useState(false)
  const [contando, setContando] = useState(false)
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('con-stock')
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('pagos_v_inventario').select('*').order('nombre')
    if (error) {
      show('No se pudo cargar el inventario.', 'error')
    } else {
      setProductos(data)
    }
    setCargando(false)
  }, [show])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function agregar(datos: ProductoInput) {
    const { error } = await supabase.from('pagos_productos').insert(datos)
    if (error) {
      // 23505: ya hay otro producto con ese código.
      show(
        error.code === '23505' ? 'Ya existe un producto con ese código.' : 'No se pudo guardar.',
        'error',
      )
      return false
    }
    show(`${datos.nombre} agregado.`)
    setAgregando(false)
    await cargar()
    return true
  }

  // Se busca en la lista recargada para que el detalle muestre los números al día.
  const abierto = productos.find((p) => p.producto_id === abiertoId) ?? null

  const unidades = productos.reduce((suma, p) => suma + Math.max(Number(p.existencia), 0), 0)
  const valor = productos.reduce(
    (suma, p) =>
      p.costo_promedio === null
        ? suma
        : suma + Math.max(Number(p.existencia), 0) * Number(p.costo_promedio),
    0,
  )

  const texto = normalizar(busqueda.trim())
  const visibles = productos.filter(
    (p) =>
      (filtro === 'todos' || Number(p.existencia) !== 0) &&
      (texto === '' || normalizar(`${p.nombre} ${p.codigo ?? ''}`).includes(texto)),
  )

  return (
    <>
      <div className="encabezado">
        <h2>Inventario</h2>
        <button className="btn-agregar" onClick={() => setAgregando(true)}>
          + Producto
        </button>
      </div>

      <div className="total-bar">
        <span>{unidades} unidades en stock</span>
        <strong>{formatoColones(valor)}</strong>
      </div>
      <p className="nota nota-arriba">Valor a costo de lo que hay en stock.</p>

      <div className="filtros">
        <div className="type-toggle">
          <button
            type="button"
            className={filtro === 'con-stock' ? 'active' : ''}
            onClick={() => setFiltro('con-stock')}
          >
            Con stock
          </button>
          <button
            type="button"
            className={filtro === 'todos' ? 'active' : ''}
            onClick={() => setFiltro('todos')}
          >
            Todos
          </button>
        </div>
        <div className="field">
          <input
            type="search"
            value={busqueda}
            placeholder="Buscar producto o código"
            aria-label="Buscar producto"
            maxLength={MAXIMO_NOMBRE_PRODUCTO}
            onChange={(e) => setBusqueda(filtrarTexto(e.target.value, MAXIMO_NOMBRE_PRODUCTO))}
          />
        </div>
      </div>

      {productos.length > 0 && (
        <button className="btn-secondary btn-contar" onClick={() => setContando(true)}>
          Contar inventario
        </button>
      )}

      {cargando ? (
        <div className="empty-state">Cargando...</div>
      ) : productos.length === 0 ? (
        <div className="empty-state">Todavía no hay productos. Agrega el primero arriba.</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">
          {texto !== '' ? 'No hay productos con ese nombre.' : 'No hay productos en stock.'}
        </div>
      ) : (
        <ul className="lista">
          {visibles.map((p) => (
            <FilaProducto key={p.producto_id} producto={p} onAbrir={setAbiertoId} />
          ))}
        </ul>
      )}

      {agregando && (
        <Modal title="Nuevo producto" onClose={() => setAgregando(false)}>
          <ProductoForm textoBoton="Agregar producto" onGuardar={agregar} />
        </Modal>
      )}

      {contando && (
        <ConteoInventario
          productos={productos}
          onCerrar={() => setContando(false)}
          onGuardado={cargar}
        />
      )}

      {abierto && (
        <ProductoDetalle
          key={abierto.producto_id}
          producto={abierto}
          onCerrar={() => setAbiertoId(null)}
          onCambio={cargar}
        />
      )}
    </>
  )
}

function FilaProducto({
  producto,
  onAbrir,
}: {
  producto: ProductoInventario
  onAbrir: (productoId: string) => void
}) {
  const existencia = Number(producto.existencia)
  return (
    <li>
      <button className="lista-item" onClick={() => onAbrir(producto.producto_id)}>
        <span className="lista-texto">
          <span className="lista-descripcion">{producto.nombre}</span>
          <span className="lista-detalle">
            {producto.codigo ?? 'Sin código'}
            {producto.precio_venta !== null &&
              ` · Venta ${formatoColones(Number(producto.precio_venta))}`}
          </span>
        </span>
        <span className="lista-valor">
          <span className={`lista-monto ${existencia > 0 ? '' : 'negativo'}`}>{existencia}</span>
          <span className="lista-detalle">
            {existencia > 0 ? 'en stock' : existencia === 0 ? 'agotado' : 'revisar'}
          </span>
        </span>
      </button>
    </li>
  )
}
