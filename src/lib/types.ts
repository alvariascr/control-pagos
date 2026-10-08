export interface ClienteInput {
  nombre: string
  telefono: string | null
}

// Fila de la vista pagos_v_saldo_cliente: el cliente con lo que ha comprado, abonado y debe.
export interface SaldoCliente {
  cliente_id: string
  nombre: string
  telefono: string | null
  creado_en: string
  total_compras: number
  total_abonos: number
  // Negativo = el cliente pagó de más.
  saldo: number
  ultimo_abono: string | null
}

// Fila de la vista pagos_v_resumen.
export interface Resumen {
  por_cobrar: number
  clientes_con_saldo: number
  clientes_total: number
}

export interface Compra {
  id: string
  // null = anotación vieja sin fecha.
  fecha: string | null
  descripcion: string
  // Total de la línea (precio por cantidad).
  monto: number
  // null = venta de texto libre, que no baja el inventario.
  producto_id: string | null
  cantidad: number
  creado_en: string
}

export interface CompraInput {
  fecha: string | null
  descripcion: string
  monto: number
  producto_id: string | null
  cantidad: number
}

export interface Abono {
  id: string
  fecha: string | null
  monto: number
  nota: string | null
  creado_en: string
}

export interface AbonoInput {
  fecha: string | null
  monto: number
  nota: string | null
}

// Compras y abonos de un cliente puestos en una sola línea de tiempo.
export type Movimiento = { tipo: 'compra'; datos: Compra } | { tipo: 'abono'; datos: Abono }

export interface ProductoInput {
  codigo: string | null
  nombre: string
  precio_venta: number | null
}

// Fila de la vista pagos_v_inventario: el producto con lo que entró, se vendió y queda.
export interface ProductoInventario {
  producto_id: string
  codigo: string | null
  nombre: string
  precio_venta: number | null
  recibido: number
  vendido: number
  ajustes: number
  existencia: number
  costo_promedio: number | null
}

// Fila de la vista pagos_v_pedido_saldo.
export interface PedidoSaldo {
  pedido_id: string
  numero: string
  proveedor: string
  fecha: string
  vencimiento: string | null
  creado_en: string
  unidades: number
  total: number
  pagado: number
  saldo: number
}

export interface PedidoInput {
  numero: string
  proveedor: string
  fecha: string
  vencimiento: string | null
}

export interface ItemPedidoInput {
  producto_id: string
  cantidad: number
  costo_unitario: number
}

// Artículo de un pedido, con el producto ya unido.
export interface ItemPedido {
  id: string
  cantidad: number
  costo_unitario: number
  producto: { codigo: string | null; nombre: string } | null
}

export interface PagoPedido {
  id: string
  fecha: string
  monto: number
  nota: string | null
}
