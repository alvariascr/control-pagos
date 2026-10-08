import { useState, type FormEvent } from 'react'
import { hoy } from '../lib/formato'
import {
  FECHA_MAXIMA,
  FECHA_MINIMA,
  MAXIMO_CANTIDAD,
  MAXIMO_MONTO,
  MAXIMO_TEXTO,
} from '../lib/limites'
import { digitosDe, fechaValida, filtrarTexto, limpiarTexto, soloDigitos } from '../lib/sanitizar'
import type { CompraInput, ProductoInventario } from '../lib/types'
import CampoMonto from './CampoMonto'

const SIN_PRODUCTO = ''

// Formulario de venta (lo que el cliente se lleva). Se usa para agregar (vacío) y para editar
// (con valores). Si se elige un producto del inventario, la venta baja las existencias.
export default function CompraForm({
  inicial,
  productos,
  textoBoton,
  onGuardar,
}: {
  inicial?: CompraInput
  // Productos que se pueden elegir (con su existencia actual).
  productos: ProductoInventario[]
  textoBoton: string
  // Devuelve true si se guardó, para limpiar el formulario solo en ese caso. yaPago es true si
  // el cliente pagó todo en el momento (solo se ofrece al agregar).
  onGuardar: (datos: CompraInput, yaPago: boolean) => Promise<boolean>
}) {
  const [productoId, setProductoId] = useState(inicial?.producto_id ?? SIN_PRODUCTO)
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [cantidad, setCantidad] = useState(inicial ? String(inicial.cantidad) : '1')
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : '')
  // Mientras no se toque el monto, se calcula con el precio del producto por la cantidad.
  const [montoTocado, setMontoTocado] = useState(inicial !== undefined)
  // Al editar se respeta una fecha vacía (anotación vieja sin fecha).
  const [fecha, setFecha] = useState(inicial ? (inicial.fecha ?? '') : hoy())
  const [yaPago, setYaPago] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const producto = productos.find((p) => p.producto_id === productoId) ?? null
  const cantidadNumero = productoId === SIN_PRODUCTO ? 1 : Number(cantidad)
  const montoNumero = Number(monto)
  const cantidadValida =
    Number.isInteger(cantidadNumero) && cantidadNumero >= 1 && cantidadNumero <= MAXIMO_CANTIDAD
  const fechaOk = fecha === '' || fechaValida(fecha)
  const valido =
    limpiarTexto(descripcion) !== '' &&
    cantidadValida &&
    montoNumero > 0 &&
    montoNumero <= MAXIMO_MONTO &&
    fechaOk

  // Lo que hay disponible: al editar, lo que esta misma venta ya se llevó vuelve a estar libre.
  const disponible =
    producto === null
      ? 0
      : Number(producto.existencia) +
        (inicial && inicial.producto_id === producto.producto_id ? inicial.cantidad : 0)

  function recalcularMonto(p: ProductoInventario | null, cant: string) {
    if (montoTocado || p === null || p.precio_venta === null) return
    const n = Number(cant)
    setMonto(n > 0 ? String(Number(p.precio_venta) * n) : '')
  }

  function cambiarProducto(id: string) {
    const nuevo = productos.find((p) => p.producto_id === id) ?? null
    setProductoId(id)
    if (nuevo) {
      setDescripcion(nuevo.nombre)
      recalcularMonto(nuevo, cantidad)
    }
  }

  function cambiarCantidad(valor: string) {
    setCantidad(valor)
    recalcularMonto(producto, valor)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    const ok = await onGuardar(
      {
        descripcion: limpiarTexto(descripcion, MAXIMO_TEXTO),
        monto: montoNumero,
        fecha: fecha === '' ? null : fecha,
        producto_id: productoId === SIN_PRODUCTO ? null : productoId,
        cantidad: cantidadNumero,
      },
      yaPago,
    )
    setGuardando(false)
    if (ok && !inicial) {
      setProductoId(SIN_PRODUCTO)
      setDescripcion('')
      setCantidad('1')
      setMonto('')
      setMontoTocado(false)
      setYaPago(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {productos.length > 0 && (
        <div className="field">
          <label htmlFor="compra-producto">Producto del inventario</label>
          <select
            id="compra-producto"
            value={productoId}
            onChange={(e) => cambiarProducto(e.target.value)}
          >
            <option value={SIN_PRODUCTO}>Otro (no está en el inventario)</option>
            {productos.map((p) => (
              <option key={p.producto_id} value={p.producto_id}>
                {p.nombre}
                {p.codigo ? ` (${p.codigo})` : ''} · quedan {Number(p.existencia)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="compra-descripcion">Qué se llevó</label>
        <input
          id="compra-descripcion"
          value={descripcion}
          maxLength={MAXIMO_TEXTO}
          placeholder="Ej: Olla de 24 cm"
          onChange={(e) => setDescripcion(filtrarTexto(e.target.value, MAXIMO_TEXTO))}
          required
        />
      </div>
      <div className="field-row">
        {producto !== null ? (
          <div className="field">
            <label htmlFor="compra-cantidad">Cantidad</label>
            <input
              id="compra-cantidad"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={digitosDe(MAXIMO_CANTIDAD)}
              value={cantidad}
              aria-invalid={!cantidadValida}
              onChange={(e) =>
                cambiarCantidad(soloDigitos(e.target.value, digitosDe(MAXIMO_CANTIDAD)))
              }
              required
            />
          </div>
        ) : (
          <CampoMonto
            id="compra-monto"
            label="Precio (₡)"
            valor={monto}
            maximo={MAXIMO_MONTO}
            onChange={(v) => {
              setMontoTocado(true)
              setMonto(v)
            }}
          />
        )}
        <div className="field">
          <label htmlFor="compra-fecha">Fecha</label>
          <input
            id="compra-fecha"
            type="date"
            min={FECHA_MINIMA}
            max={FECHA_MAXIMA}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>
      {producto !== null && (
        <>
          <CampoMonto
            id="compra-monto"
            label="Precio total (₡)"
            valor={monto}
            maximo={MAXIMO_MONTO}
            onChange={(v) => {
              setMontoTocado(true)
              setMonto(v)
            }}
          />
          {cantidadValida && cantidadNumero > disponible && (
            <p className="campo-error nota-form">
              Solo quedan {disponible} en el inventario. Si hay un error de conteo, usa "Contar
              inventario".
            </p>
          )}
        </>
      )}
      {!inicial && (
        <label className="check-row">
          <input type="checkbox" checked={yaPago} onChange={(e) => setYaPago(e.target.checked)} />
          <span>Ya pagó todo (de contado)</span>
        </label>
      )}
      <button className="btn-primary" type="submit" disabled={!valido || guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
