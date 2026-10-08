import type { Abono, Compra, Movimiento } from './types'

// Junta compras y abonos en una sola lista, de lo más nuevo a lo más viejo. Lo que no tiene
// fecha (anotaciones viejas del cuaderno) va al final, y el empate se resuelve con el momento
// en que se registró.
export function ordenarMovimientos(compras: Compra[], abonos: Abono[]): Movimiento[] {
  const todos: Movimiento[] = [
    ...compras.map((datos) => ({ tipo: 'compra' as const, datos })),
    ...abonos.map((datos) => ({ tipo: 'abono' as const, datos })),
  ]
  return todos.sort((a, b) => {
    const fa = a.datos.fecha ?? ''
    const fb = b.datos.fecha ?? ''
    if (fa !== fb) return fa < fb ? 1 : -1
    return a.datos.creado_en < b.datos.creado_en ? 1 : -1
  })
}
