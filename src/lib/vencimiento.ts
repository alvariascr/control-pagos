import { hoy } from './formato'

const MS_POR_DIA = 24 * 60 * 60 * 1000

// AAAA-MM-DD a una fecha local a medianoche (new Date('AAAA-MM-DD') la interpreta en UTC).
function fechaLocal(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

// Días que faltan para el vencimiento (negativo si ya pasó, 0 si vence hoy).
export function diasParaVencer(vencimiento: string, desde: string = hoy()) {
  return Math.round((fechaLocal(vencimiento).getTime() - fechaLocal(desde).getTime()) / MS_POR_DIA)
}

// Suma días a una fecha AAAA-MM-DD y devuelve AAAA-MM-DD.
export function sumarDias(fecha: string, dias: number) {
  const f = fechaLocal(fecha)
  f.setDate(f.getDate() + dias)
  return f.toLocaleDateString('en-CA')
}

export interface EstadoPedido {
  texto: string
  // vencido: ya pasó la fecha. proximo: vence en 7 días o menos. normal: hay tiempo o está pagado.
  nivel: 'vencido' | 'proximo' | 'normal'
}

// Texto corto para la lista de pedidos: "Pagado", "Vencido hace 12 días", "Vence en 3 días"...
export function estadoPedido(
  saldo: number,
  vencimiento: string | null,
  desde: string = hoy(),
): EstadoPedido {
  if (saldo <= 0) return { texto: 'Pagado', nivel: 'normal' }
  if (!vencimiento) return { texto: 'Sin vencimiento', nivel: 'normal' }
  const dias = diasParaVencer(vencimiento, desde)
  if (dias < 0) {
    return { texto: `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`, nivel: 'vencido' }
  }
  if (dias === 0) return { texto: 'Vence hoy', nivel: 'proximo' }
  return {
    texto: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`,
    nivel: dias <= 7 ? 'proximo' : 'normal',
  }
}
