// Máximos. La base tiene los mismos límites (supabase/schema.sql); si se cambian, cambiar los dos.

// Una compra o un abono, en colones.
export const MAXIMO_MONTO = 2_000_000

export const MAXIMO_NOMBRE = 80
export const MAXIMO_TELEFONO = 30
export const MAXIMO_TEXTO = 120

// Fechas que acepta la app (y la base): evita años absurdos como 0001 o 9999.
export const FECHA_MINIMA = '2020-01-01'
export const FECHA_MAXIMA = '2100-12-31'

// Productos del inventario.
export const MAXIMO_CODIGO = 40
export const MAXIMO_NOMBRE_PRODUCTO = 80

// Unidades de un artículo en una venta, un pedido o un ajuste.
export const MAXIMO_CANTIDAD = 1000

// Pedido al proveedor: número de nota, proveedor y pago (un pedido puede ser grande).
export const MAXIMO_NUMERO_PEDIDO = 40
export const MAXIMO_PROVEEDOR = 80
export const MAXIMO_PAGO_PEDIDO = 20_000_000
