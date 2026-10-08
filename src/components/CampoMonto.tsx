import { formatoColones } from '../lib/formato'
import { digitosDe, soloDigitos } from '../lib/sanitizar'

// Campo de monto en colones enteros. Solo deja escribir dígitos (sin letras, signos, puntos ni
// notación como 1e30) y con un máximo de dígitos; avisa si pasa del máximo permitido.
export default function CampoMonto({
  id,
  label,
  valor,
  maximo,
  requerido = true,
  onChange,
}: {
  id: string
  label: string
  valor: string
  maximo: number
  requerido?: boolean
  onChange: (valor: string) => void
}) {
  const maxDigitos = digitosDe(maximo)
  const muyAlto = Number(valor) > maximo

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={maxDigitos}
        value={valor}
        placeholder="0"
        aria-invalid={muyAlto}
        onChange={(e) => onChange(soloDigitos(e.target.value, maxDigitos))}
        required={requerido}
      />
      {muyAlto && <p className="campo-error">Máximo {formatoColones(maximo)}</p>}
    </div>
  )
}
