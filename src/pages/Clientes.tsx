import { useCallback, useEffect, useState } from 'react'
import ClienteDetalle from '../components/ClienteDetalle'
import ClienteForm from '../components/ClienteForm'
import Modal from '../components/Modal'
import { formatoColones, formatoFecha } from '../lib/formato'
import { MAXIMO_NOMBRE } from '../lib/limites'
import { filtrarTexto } from '../lib/sanitizar'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { ClienteInput, Resumen, SaldoCliente } from '../lib/types'

type Filtro = 'pendientes' | 'todos'

// Quita tildes y mayúsculas para que "maria" encuentre "María".
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Lista de clientes con lo que deben. Al tocar uno se abre su detalle, donde se registran
// abonos y artículos.
export default function Clientes() {
  const { show } = useToast()
  const [clientes, setClientes] = useState<SaldoCliente[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [agregando, setAgregando] = useState(false)
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    const [clientesRes, resumenRes] = await Promise.all([
      // Los que más deben primero.
      supabase.from('pagos_v_saldo_cliente').select('*').order('saldo', { ascending: false }),
      supabase.from('pagos_v_resumen').select('*').single(),
    ])
    if (clientesRes.error || resumenRes.error) {
      show('No se pudieron cargar los clientes.', 'error')
    } else {
      setClientes(clientesRes.data)
      setResumen(resumenRes.data)
    }
    setCargando(false)
  }, [show])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function agregar(datos: ClienteInput) {
    const { error } = await supabase.from('pagos_clientes').insert(datos)
    if (error) {
      show('No se pudo guardar el cliente.', 'error')
      return false
    }
    show(`${datos.nombre} agregado.`)
    setAgregando(false)
    await cargar()
    return true
  }

  // Se busca en la lista recargada para que el detalle muestre los números al día.
  const abierto = clientes.find((c) => c.cliente_id === abiertoId) ?? null

  const texto = normalizar(busqueda.trim())
  const visibles = clientes.filter(
    (c) =>
      (filtro === 'todos' || Number(c.saldo) > 0) &&
      (texto === '' || normalizar(c.nombre).includes(texto)),
  )

  return (
    <>
      <div className="encabezado">
        <h2>Clientes</h2>
        <button className="btn-agregar" onClick={() => setAgregando(true)}>
          + Nuevo cliente
        </button>
      </div>

      {resumen && (
        <div className="total-bar">
          <span>
            Por cobrar
            {resumen.clientes_con_saldo > 0 && ` (${resumen.clientes_con_saldo} clientes)`}
          </span>
          <strong>{formatoColones(Number(resumen.por_cobrar))}</strong>
        </div>
      )}

      <div className="filtros">
        <div className="type-toggle">
          <button
            type="button"
            className={filtro === 'pendientes' ? 'active' : ''}
            onClick={() => setFiltro('pendientes')}
          >
            Con saldo
          </button>
          <button
            type="button"
            className={filtro === 'todos' ? 'active' : ''}
            onClick={() => setFiltro('todos')}
          >
            Todos
          </button>
        </div>
        <div className="field">
          <input
            type="search"
            value={busqueda}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            maxLength={MAXIMO_NOMBRE}
            onChange={(e) => setBusqueda(filtrarTexto(e.target.value, MAXIMO_NOMBRE))}
          />
        </div>
      </div>

      {cargando ? (
        <div className="empty-state">Cargando...</div>
      ) : clientes.length === 0 ? (
        <div className="empty-state">Todavía no hay clientes. Agrega el primero arriba.</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">
          {texto !== '' ? 'No hay clientes con ese nombre.' : 'Nadie tiene saldo pendiente.'}
        </div>
      ) : (
        <ul className="lista">
          {visibles.map((c) => (
            <FilaCliente key={c.cliente_id} cliente={c} onAbrir={setAbiertoId} />
          ))}
        </ul>
      )}

      {agregando && (
        <Modal title="Nuevo cliente" onClose={() => setAgregando(false)}>
          <ClienteForm textoBoton="Agregar cliente" onGuardar={agregar} />
        </Modal>
      )}

      {abierto && (
        <ClienteDetalle
          key={abierto.cliente_id}
          cliente={abierto}
          onCerrar={() => setAbiertoId(null)}
          onCambio={cargar}
        />
      )}
    </>
  )
}

function FilaCliente({
  cliente,
  onAbrir,
}: {
  cliente: SaldoCliente
  onAbrir: (clienteId: string) => void
}) {
  const saldo = Number(cliente.saldo)
  return (
    <li>
      <button className="lista-item" onClick={() => onAbrir(cliente.cliente_id)}>
        <span className="lista-texto">
          <span className="lista-descripcion">{cliente.nombre}</span>
          <span className="lista-detalle">
            {cliente.ultimo_abono
              ? `Último abono ${formatoFecha(cliente.ultimo_abono)}`
              : 'Sin abonos todavía'}
          </span>
        </span>
        <span className="lista-valor">
          {saldo > 0 ? (
            <>
              <span className="lista-monto">{formatoColones(saldo)}</span>
              <span className="lista-detalle">debe</span>
            </>
          ) : saldo < 0 ? (
            <>
              <span className="lista-monto positivo">{formatoColones(-saldo)}</span>
              <span className="lista-detalle">a favor</span>
            </>
          ) : (
            <span className="lista-monto positivo">Al día</span>
          )}
        </span>
      </button>
    </li>
  )
}
