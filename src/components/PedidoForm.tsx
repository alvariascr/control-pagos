import { useState, type FormEvent } from 'react'
import { formatoColones, hoy } from '../lib/formato'
import {
  FECHA_MAXIMA,
  FECHA_MINIMA,
  MAXIMO_CANTIDAD,
  MAXIMO_MONTO,
  MAXIMO_NUMERO_PEDIDO,
  MAXIMO_PROVEEDOR,
} from '../lib/limites'
import {
  digitosDe,
  fechaValida,
  filtrarCodigo,
  filtrarTexto,
  limpiarTexto,
  soloDigitos,
} from '../lib/sanitizar'
import type { ItemPedidoInput, PedidoInput, ProductoInventario } from '../lib/types'
import { sumarDias } from '../lib/vencimiento'
import CampoMonto from './CampoMonto'

// Días de crédito que da el proveedor: el vencimiento se propone con esta suma.
const DIAS_CREDITO = 45

interface FilaItem {
  // Solo para que React distinga las filas al quitar una del medio.
  clave: number
  productoId: string
  cantidad: string
  costo: string
}

// Formulario de pedido al proveedor. Para agregar lleva los artículos; para editar (con
// "inicial") solo cambia el número, el proveedor y las fechas.
export default function PedidoForm({
  inicial,
  productos,
  textoBoton,
  onGuardar,
}: {
  inicial?: PedidoInput
  productos: ProductoInventario[]
  textoBoton: string
  // Devuelve true si se guardó, para limpiar el formulario solo en ese caso.
  onGuardar: (pedido: PedidoInput, items: ItemPedidoInput[]) => Promise<boolean>
}) {
  const [numero, setNumero] = useState(inicial?.numero ?? '')
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? 'Kata Wok Stone')
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy())
  const [vencimiento, setVencimiento] = useState(
    inicial ? (inicial.vencimiento ?? '') : sumarDias(hoy(), DIAS_CREDITO),
  )
  // Mientras no se toque el vencimiento, sigue a la fecha del pedido.
  const [vencimientoTocado, setVencimientoTocado] = useState(inicial !== undefined)
  const [filas, setFilas] = useState<FilaItem[]>([
    { clave: 1, productoId: '', cantidad: '1', costo: '' },
  ])
  const [siguienteClave, setSiguienteClave] = useState(2)
  const [guardando, setGuardando] = useState(false)

  const editando = inicial !== undefined

  const filasValidas = filas.every((f) => {
    const cantidad = Number(f.cantidad)
    const costo = Number(f.costo)
    return (
      f.productoId !== '' &&
      Number.isInteger(cantidad) &&
      cantidad >= 1 &&
      cantidad <= MAXIMO_CANTIDAD &&
      f.costo !== '' &&
      costo >= 0 &&
      costo <= MAXIMO_MONTO
    )
  })
  const total = filas.reduce((suma, f) => suma + Number(f.cantidad) * Number(f.costo), 0)
  const fechasValidas =
    fechaValida(fecha) && (vencimiento === '' || (fechaValida(vencimiento) && vencimiento >= fecha))
  const valido =
    filtrarCodigo(numero).trim() !== '' &&
    limpiarTexto(proveedor) !== '' &&
    fechasValidas &&
    (editando || filasValidas)

  function cambiarFecha(nueva: string) {
    setFecha(nueva)
    if (!vencimientoTocado && nueva !== '') setVencimiento(sumarDias(nueva, DIAS_CREDITO))
  }

  function cambiarFila(clave: number, cambios: Partial<FilaItem>) {
    setFilas(filas.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  }

  function elegirProducto(clave: number, productoId: string) {
    const producto = productos.find((p) => p.producto_id === productoId)
    const fila = filas.find((f) => f.clave === clave)
    // Propone el costo de la última vez, si todavía no se escribió uno.
    const costoSugerido =
      producto?.costo_promedio != null && fila?.costo === ''
        ? String(Math.round(Number(producto.costo_promedio)))
        : undefined
    cambiarFila(clave, { productoId, ...(costoSugerido ? { costo: costoSugerido } : {}) })
  }

  function agregarFila() {
    setFilas([...filas, { clave: siguienteClave, productoId: '', cantidad: '1', costo: '' }])
    setSiguienteClave(siguienteClave + 1)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    const ok = await onGuardar(
      {
        numero: filtrarCodigo(numero, MAXIMO_NUMERO_PEDIDO).trim(),
        proveedor: limpiarTexto(proveedor, MAXIMO_PROVEEDOR),
        fecha,
        vencimiento: vencimiento === '' ? null : vencimiento,
      },
      editando
        ? []
        : filas.map((f) => ({
            producto_id: f.productoId,
            cantidad: Number(f.cantidad),
            costo_unitario: Number(f.costo),
          })),
    )
    setGuardando(false)
    if (ok && !editando) {
      setNumero('')
      setFilas([{ clave: siguienteClave, productoId: '', cantidad: '1', costo: '' }])
      setSiguienteClave(siguienteClave + 1)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pedido-numero">Número de nota</label>
          <input
            id="pedido-numero"
            value={numero}
            maxLength={MAXIMO_NUMERO_PEDIDO}
            placeholder="Ej: 1708"
            onChange={(e) => setNumero(filtrarCodigo(e.target.value, MAXIMO_NUMERO_PEDIDO))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pedido-proveedor">Proveedor</label>
          <input
            id="pedido-proveedor"
            value={proveedor}
            maxLength={MAXIMO_PROVEEDOR}
            onChange={(e) => setProveedor(filtrarTexto(e.target.value, MAXIMO_PROVEEDOR))}
            required
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pedido-fecha">Fecha del pedido</label>
          <input
            id="pedido-fecha"
            type="date"
            min={FECHA_MINIMA}
            max={FECHA_MAXIMA}
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pedido-vencimiento">Vence</label>
          <input
            id="pedido-vencimiento"
            type="date"
            min={fecha || FECHA_MINIMA}
            max={FECHA_MAXIMA}
            value={vencimiento}
            onChange={(e) => {
              setVencimientoTocado(true)
              setVencimiento(e.target.value)
            }}
          />
        </div>
      </div>

      {!editando && (
        <>
          <div className="section-title">Artículos del pedido</div>
          {productos.length === 0 ? (
            <p className="nota">Primero agrega los productos en la pestaña Inventario.</p>
          ) : (
            <>
              {filas.map((fila, indice) => (
                <div className="item-fila" key={fila.clave}>
                  <div className="field">
                    <label htmlFor={`item-producto-${fila.clave}`}>Producto {indice + 1}</label>
                    <select
                      id={`item-producto-${fila.clave}`}
                      value={fila.productoId}
                      onChange={(e) => elegirProducto(fila.clave, e.target.value)}
                    >
                      <option value="">Elegir producto</option>
                      {productos.map((p) => (
                        <option key={p.producto_id} value={p.producto_id}>
                          {p.nombre}
                          {p.codigo ? ` (${p.codigo})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="item-fila-numeros">
                    <div className="field">
                      <label htmlFor={`item-cantidad-${fila.clave}`}>Cantidad</label>
                      <input
                        id={`item-cantidad-${fila.clave}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        maxLength={digitosDe(MAXIMO_CANTIDAD)}
                        value={fila.cantidad}
                        onChange={(e) =>
                          cambiarFila(fila.clave, {
                            cantidad: soloDigitos(e.target.value, digitosDe(MAXIMO_CANTIDAD)),
                          })
                        }
                      />
                    </div>
                    <CampoMonto
                      id={`item-costo-${fila.clave}`}
                      label="Costo c/u (₡)"
                      valor={fila.costo}
                      maximo={MAXIMO_MONTO}
                      onChange={(costo) => cambiarFila(fila.clave, { costo })}
                    />
                    {filas.length > 1 && (
                      <button
                        type="button"
                        className="btn-quitar"
                        aria-label={`Quitar artículo ${indice + 1}`}
                        onClick={() => setFilas(filas.filter((f) => f.clave !== fila.clave))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={agregarFila}>
                + Agregar otro artículo
              </button>
              <div className="total-bar total-bar-form">
                <span>Total del pedido</span>
                <strong>{formatoColones(filasValidas ? total : 0)}</strong>
              </div>
            </>
          )}
        </>
      )}

      <button className="btn-primary" type="submit" disabled={!valido || guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
