const colones = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
})

export function formatoColones(monto: number) {
  return colones.format(monto)
}

// Fecha de hoy en hora local, en el formato que usan los <input type="date"> (AAAA-MM-DD).
// toISOString() daría la fecha en UTC, que en la noche de Costa Rica ya es "mañana".
export function hoy() {
  return new Date().toLocaleDateString('en-CA')
}

// La base guarda la fecha como AAAA-MM-DD. new Date('AAAA-MM-DD') la interpreta en UTC y
// en Costa Rica mostraría el día anterior, así que se arma en hora local.
export function formatoFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
