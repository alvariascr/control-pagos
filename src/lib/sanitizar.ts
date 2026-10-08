import { FECHA_MAXIMA, FECHA_MINIMA, MAXIMO_TELEFONO } from './limites'

// Caracteres que nunca deben entrar en un texto: de control, invisibles (ancho cero, marcas de
// dirección que cambian cómo se lee el texto) y < >, que solo sirven para meter etiquetas.
// La base rechaza lo mismo (pagos_texto_seguro en supabase/schema.sql).
// oxlint-disable-next-line no-control-regex
const PROHIBIDOS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿<>]/g

// Para usar mientras se escribe: quita lo prohibido y junta los espacios repetidos. No recorta
// los extremos, para no impedir que se escriba un espacio entre dos palabras.
export function filtrarTexto(valor: string, maximo?: number) {
  const limpio = valor
    .normalize('NFC')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(PROHIBIDOS, '')
    .replace(/ {2,}/g, ' ')
  return maximo === undefined ? limpio : limpio.slice(0, maximo)
}

// Para usar al guardar: lo mismo, y sin espacios al inicio ni al final.
export function limpiarTexto(valor: string, maximo?: number) {
  return filtrarTexto(valor, maximo).trim()
}

// Solo dígitos, sin ceros a la izquierda y con un máximo de dígitos. Se usa en montos y
// cantidades: no deja escribir letras, signos, puntos ni notación como 1e30.
export function soloDigitos(valor: string, maximoDigitos: number) {
  return valor
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, maximoDigitos)
}

// Cantidad de dígitos que tiene un número máximo (2_000_000 -> 7).
export function digitosDe(maximo: number) {
  return String(maximo).length
}

// Teléfono: dígitos, espacios, guion, paréntesis y +.
export function filtrarTelefono(valor: string) {
  return valor
    .replace(/[^0-9+() -]/g, '')
    .replace(/ {2,}/g, ' ')
    .slice(0, MAXIMO_TELEFONO)
}

// Un teléfono es válido si está vacío o tiene entre 8 y 15 dígitos.
export function telefonoValido(telefono: string) {
  const digitos = telefono.replace(/\D/g, '').length
  return telefono.trim() === '' || (digitos >= 8 && digitos <= 15)
}

// Códigos y números de nota: letras, números y . _ / - (con espacios sueltos).
export function filtrarCodigo(valor: string, maximo?: number) {
  const limpio = valor.replace(/[^A-Za-z0-9._/ -]/g, '').replace(/ {2,}/g, ' ')
  return maximo === undefined ? limpio : limpio.slice(0, maximo)
}

// AAAA-MM-DD dentro del rango que acepta la base.
export function fechaValida(fecha: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= FECHA_MINIMA && fecha <= FECHA_MAXIMA
}
