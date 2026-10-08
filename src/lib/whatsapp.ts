import { formatoColones } from './formato'

// Deja solo los dígitos. Un número de 8 dígitos se toma como de Costa Rica y se le pone 506.
// Devuelve null si no parece un número válido.
export function numeroWhatsApp(telefono: string | null): string | null {
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 8) return `506${digitos}`
  if (digitos.length >= 10 && digitos.length <= 15) return digitos
  return null
}

// Enlace de WhatsApp con un recordatorio amable de lo que queda pendiente.
export function enlaceRecordatorio(nombre: string, telefono: string | null, saldo: number) {
  const numero = numeroWhatsApp(telefono)
  if (!numero) return null
  const texto =
    `Hola ${nombre}, espero que estés muy bien. Te escribo para recordarte que tu saldo ` +
    `pendiente es de ${formatoColones(saldo)}. Cualquier abono se agradece mucho. ¡Gracias!`
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
