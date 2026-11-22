import { useCallback, useEffect, useRef, useState } from 'react'
import { isConfigured } from '../../lib/supabase'
import {
  EN_RECEPCION,
  actualizarUbicacion,
  cargarFoto,
  confirmarCustodia,
  consultarExpediente,
  esEncargado,
  listarObjetos,
  registrarObjeto,
} from './datos'
import EtiquetaObjeto from './EtiquetaObjeto'
import { crearIdentificador, esIdentificadorObjeto } from './enlaceObjeto'
import './objetosPerdidosB.css'

const TIPOS_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_FOTOS = 5
const MAX_BYTES = 5 * 1024 * 1024
const formatoFecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' })
const formatoMomento = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

function fechaHallazgo(valor) {
  return formatoFecha.format(new Date(`${valor}T00:00:00Z`))
}

function useConsulta(consultar) {
  const [resultado, setResultado] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    consultar().then(
      datos => { if (vigente) setResultado({ datos }) },
      error => { if (vigente) setResultado({ error }) },
    )
    return () => { vigente = false }
  }, [consultar, intento])

  function recargar() {
    setResultado({ cargando: true })
    setIntento(anterior => anterior + 1)
  }

  function actualizarDatos(transformar) {
    setResultado(anterior => ({ ...anterior, datos: transformar(anterior.datos) }))
  }

  return { ...resultado, recargar, actualizarDatos }
}

function Mensaje({ tipo, children }) {
  if (!children) return null
  return <p className={`message ${tipo ?? ''}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</p>
}

function FormularioRegistro({ alGuardar }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enCurso = useRef(false)
  const idPendiente = useRef(null)

  async function guardar(evento) {
    evento.preventDefault()
    if (enCurso.current) return
    const campos = Object.fromEntries(new FormData(evento.currentTarget))
    for (const campo of Object.keys(campos)) campos[campo] = campos[campo].trim()

    if (Object.values(campos).some(valor => !valor)) {
      setError('Completa todos los campos del registro.')
      return
    }

    enCurso.current = true
    setGuardando(true)
    setError('')
    try {
      idPendiente.current ??= crearIdentificador()
      const objeto = await registrarObjeto(idPendiente.current, campos)
      alGuardar(objeto.id)
    } catch (fallo) {
      setError(`No se pudo confirmar el registro. ${fallo.message}`)
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }

  return <section className="panel">
    <h3>Registrar objeto</h3>
    <form onSubmit={guardar}>
      <label>Descripción <textarea name="descripcion" rows={3} maxLength={500} required disabled={guardando} /></label>
      <label>Lugar del hallazgo <input name="lugar_hallazgo" maxLength={160} required disabled={guardando} /></label>
      <label>Fecha del hallazgo <input name="fecha_hallazgo" type="date" required disabled={guardando} /></label>
      <label>Ubicación de custodia <input name="ubicacion_custodia" maxLength={160} required disabled={guardando} /></label>
      <button type="submit" disabled={guardando}>{guardando ? 'Registrando…' : 'Registrar en recepción'}</button>
    </form>
    <Mensaje tipo="error">{error}</Mensaje>
  </section>
}

function ListadoObjetos({ abrir }) {
  const { datos: objetos, error, cargando, recargar } = useConsulta(listarObjetos)

  return <section className="panel">
    <div className="objetos-acciones">
      <h3>Objetos registrados</h3>
      <button className="secondary small" type="button" onClick={recargar} disabled={cargando}>Actualizar listado</button>
    </div>
    {cargando && <Mensaje>Consultando objetos…</Mensaje>}
    {error && <Mensaje tipo="error">No se pudo consultar el listado. {error.message}</Mensaje>}
    {objetos?.length === 0 && <p className="muted">Todavía no hay objetos registrados.</p>}
    {objetos?.length > 0 && <div className="table-wrap"><table>
      <thead><tr><th scope="col">Objeto</th><th scope="col">Estado</th><th scope="col">Ubicación</th><th scope="col">Expediente</th></tr></thead>
      <tbody>{objetos.map(objeto => <tr key={objeto.id}>
        <td>{objeto.descripcion}</td>
        <td><span className="status">{objeto.estado}</span></td>
        <td>{objeto.ubicacion_custodia}</td>
        <td><button className="secondary small" type="button" onClick={() => abrir(objeto.id)}
          aria-label={`Ver expediente de ${objeto.descripcion}`}>Ver expediente</button></td>
      </tr>)}</tbody>
    </table></div>}
  </section>
}

function VistaPrevia({ foto, quitar, bloqueada }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const temporal = URL.createObjectURL(foto.archivo)
    setUrl(temporal)
    return () => URL.revokeObjectURL(temporal)
  }, [foto.archivo])

  return <figure>
    {url && <img src={url} alt={`Vista previa de ${foto.archivo.name}`} />}
    <figcaption>{foto.archivo.name}</figcaption>
    <button className="secondary small" type="button" onClick={quitar} disabled={bloqueada}
      aria-label={`Quitar ${foto.archivo.name}`}>Quitar</button>
  </figure>
}

function FormularioCustodia({ objetoId, usuarioId, guardando, setGuardando, alConfirmar }) {
  const [fotos, setFotos] = useState([])
  const [error, setError] = useState('')
  const enCurso = useRef(false)
  const cargasConfirmadas = useRef(new Set())

  function adjuntar(evento) {
    const archivos = Array.from(evento.target.files)
    evento.target.value = ''
    if (archivos.length === 0) return
    if (fotos.length + archivos.length > MAX_FOTOS) {
      setError('Puedes adjuntar hasta cinco fotografías.')
      return
    }

    const invalido = archivos.find(archivo => !TIPOS_FOTO[archivo.type] || !archivo.size || archivo.size > MAX_BYTES)
    if (invalido) {
      setError(`El archivo ${invalido.name} debe ser JPEG, PNG o WebP y pesar entre 1 byte y 5 MiB.`)
      return
    }

    setError('')
    const nuevas = archivos.map(archivo => ({
      archivo,
      ruta: `${objetoId}/${usuarioId}/${crearIdentificador()}.${TIPOS_FOTO[archivo.type]}`,
    }))
    setFotos(anteriores => [...anteriores, ...nuevas])
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (enCurso.current) return
    const observaciones = new FormData(evento.currentTarget).get('observaciones')
    if (!observaciones.trim() || fotos.length === 0) {
      setError('Escribe las observaciones y adjunta al menos una fotografía.')
      return
    }

    enCurso.current = true
    setGuardando(true)
    setError('')
    try {
      for (const foto of fotos) {
        if (cargasConfirmadas.current.has(foto.ruta)) continue
        await cargarFoto(foto)
        cargasConfirmadas.current.add(foto.ruta)
      }
      await confirmarCustodia(objetoId, observaciones, fotos.map(({ ruta }) => ruta))
      alConfirmar()
    } catch (fallo) {
      setError(`No se pudo confirmar la custodia. ${fallo.message}`)
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }

  return <section className="panel">
    <h3>Confirmar custodia</h3>
    <form onSubmit={guardar}>
      <label>Observaciones del estado físico
        <textarea name="observaciones" rows={4} maxLength={2000} required disabled={guardando} />
      </label>
      <label>Fotografías del objeto
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={adjuntar}
          aria-describedby="objetos-fotos-limites" disabled={guardando} />
      </label>
      <p className="muted" id="objetos-fotos-limites">Adjunta entre 1 y 5 fotos JPEG, PNG o WebP de hasta 5 MiB cada una.</p>
      {fotos.length > 0 && <div className="objetos-fotos">
        {fotos.map(foto => <VistaPrevia key={foto.ruta} foto={foto} bloqueada={guardando}
          quitar={() => setFotos(anteriores => anteriores.filter(item => item.ruta !== foto.ruta))} />)}
      </div>}
      <button type="submit" disabled={guardando}>{guardando ? 'Guardando evidencia…' : 'Confirmar custodia'}</button>
    </form>
    <Mensaje tipo="error">{error}</Mensaje>
  </section>
}

function FotoEnExpediente({ url, numero }) {
  const [fallo, setFallo] = useState(false)
  return <figure>
    {url && !fallo
      ? <img src={url} alt={`Fotografía original ${numero} del objeto`} onError={() => setFallo(true)} />
      : <p className="muted">Fotografía {numero} no disponible. Puedes recargar la evidencia.</p>}
  </figure>
}

function FormularioUbicacion({ objeto, guardando, setGuardando, alGuardar }) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const enCurso = useRef(false)

  async function guardar(evento) {
    evento.preventDefault()
    if (enCurso.current) return
    const ubicacion = new FormData(evento.currentTarget).get('ubicacion').trim()
    if (!ubicacion) {
      setError('Escribe una ubicación para guardar el cambio.')
      return
    }

    enCurso.current = true
    setGuardando(true)
    setError('')
    try {
      const guardada = await actualizarUbicacion(objeto.id, ubicacion)
      alGuardar(guardada)
      setEditando(false)
    } catch (fallo) {
      setError(`No se pudo actualizar la ubicación. ${fallo.message}`)
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }

  if (!editando) return <button className="secondary small" type="button" disabled={guardando}
    onClick={() => { setError(''); setEditando(true) }}>Editar ubicación</button>

  return <form onSubmit={guardar} className="objetos-editar-ubicacion">
    <label>Nueva ubicación de custodia
      <input name="ubicacion" defaultValue={objeto.ubicacion_custodia} maxLength={160} required disabled={guardando} />
    </label>
    <div className="objetos-botones-ubicacion">
      <button type="submit" disabled={guardando}>{enCurso.current ? 'Guardando ubicación…' : 'Guardar ubicación'}</button>
      <button className="secondary" type="button" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</button>
    </div>
    <Mensaje tipo="error">{error}</Mensaje>
  </form>
}

function Expediente({ objetoId, usuarioId, volver, alConfirmar, alActualizarUbicacion }) {
  const consultar = useCallback(() => consultarExpediente(objetoId), [objetoId])
  const { datos, error, cargando, recargar, actualizarDatos } = useConsulta(consultar)
  const [guardando, setGuardando] = useState(false)

  function custodiaGuardada() {
    alConfirmar()
    recargar()
  }

  function ubicacionGuardada(ubicacion) {
    actualizarDatos(anterior => ({ ...anterior, objeto: { ...anterior.objeto, ubicacion_custodia: ubicacion } }))
    alActualizarUbicacion()
  }

  return <>
    <button className="secondary small" type="button" onClick={volver} disabled={guardando}>Volver al listado</button>
    {cargando && <Mensaje>Consultando expediente…</Mensaje>}
    {error && <section className="panel">
      <Mensaje tipo="error">No se pudo consultar el expediente. {error.message}</Mensaje>
      <button className="secondary small" type="button" onClick={recargar}>Reintentar consulta</button>
    </section>}
    {datos && <>
      <section className="panel">
        <div className="objetos-acciones"><h3>{datos.objeto.descripcion}</h3><span className="status">{datos.objeto.estado}</span></div>
        <dl className="objetos-datos">
          <div><dt>Lugar del hallazgo</dt><dd>{datos.objeto.lugar_hallazgo}</dd></div>
          <div><dt>Fecha del hallazgo</dt><dd>{fechaHallazgo(datos.objeto.fecha_hallazgo)}</dd></div>
          <div><dt>Ubicación de custodia</dt><dd>{datos.objeto.ubicacion_custodia}</dd></div>
          <div><dt>Fecha de registro</dt><dd>{formatoMomento.format(new Date(datos.objeto.registrado_en))}</dd></div>
          <div><dt>Responsable del registro</dt><dd>{datos.objeto.registrado_por}</dd></div>
          <div><dt>Identificador</dt><dd>{datos.objeto.id}</dd></div>
        </dl>
        <FormularioUbicacion objeto={datos.objeto} guardando={guardando} setGuardando={setGuardando}
          alGuardar={ubicacionGuardada} />
      </section>
      <EtiquetaObjeto objetoId={datos.objeto.id} guardando={guardando} />
      {datos.objeto.estado === EN_RECEPCION && <FormularioCustodia objetoId={objetoId} usuarioId={usuarioId}
        guardando={guardando} setGuardando={setGuardando} alConfirmar={custodiaGuardada} />}
      {datos.evidencia && <section className="panel">
        <div className="objetos-acciones">
          <h3>Evidencia original</h3>
          <button className="secondary small" type="button" onClick={recargar} disabled={guardando}>Recargar evidencia</button>
        </div>
        <p className="objetos-observaciones">{datos.evidencia.observaciones}</p>
        <dl className="objetos-datos">
          <div><dt>Fecha de custodia</dt><dd>{formatoMomento.format(new Date(datos.evidencia.confirmado_en))}</dd></div>
          <div><dt>Responsable de custodia</dt><dd>{datos.evidencia.confirmado_por}</dd></div>
        </dl>
        <div className="objetos-fotos">{datos.fotos.map((foto, indice) =>
          <FotoEnExpediente key={foto.url || foto.ruta} url={foto.url} numero={indice + 1} />)}</div>
      </section>}
    </>}
  </>
}

function ModuloEncargado({ usuarioId, objetoId, abrirObjeto }) {
  const [exito, setExito] = useState('')

  function abrir(id) {
    setExito('')
    abrirObjeto(id)
  }

  if (objetoId !== null && !esIdentificadorObjeto(objetoId)) return <>
    <Mensaje tipo="error">El enlace QR contiene un identificador inválido.</Mensaje>
    <button className="secondary small" type="button" onClick={() => abrir(null)}>Volver al listado</button>
  </>

  const idNormalizado = objetoId?.toLowerCase()
  return <>
    <Mensaje tipo="success">{exito}</Mensaje>
    {idNormalizado
      ? <Expediente key={idNormalizado} objetoId={idNormalizado} usuarioId={usuarioId} volver={() => abrir(null)}
        alActualizarUbicacion={() => setExito('Ubicación de custodia actualizada.')}
        alConfirmar={() => setExito('Custodia confirmada. Se guardaron las fotos y las observaciones originales.')} />
      : <div className="split">
        <FormularioRegistro alGuardar={id => {
          abrirObjeto(id)
          setExito('Objeto registrado. Ya puedes confirmar su custodia.')
        }} />
        <ListadoObjetos abrir={abrir} />
      </div>}
  </>
}

function AccesoEncargado({ usuarioId, objetoId, abrirObjeto }) {
  const consultar = useCallback(() => esEncargado(usuarioId), [usuarioId])
  const { datos: permitido, cargando, error, recargar } = useConsulta(consultar)

  if (cargando) return <Mensaje>Comprobando acceso al módulo…</Mensaje>
  if (error) return <>
    <Mensaje tipo="error">No se pudo comprobar el acceso. {error.message}</Mensaje>
    <button className="secondary" type="button" onClick={recargar}>Reintentar acceso</button>
  </>
  if (!permitido) return <>
    <Mensaje tipo="error">Esta cuenta necesita la habilitación de encargado para acceder al módulo.</Mensaje>
    <button className="secondary" type="button" onClick={recargar}>Comprobar acceso de nuevo</button>
  </>
  return <ModuloEncargado usuarioId={usuarioId} objetoId={objetoId} abrirObjeto={abrirObjeto} />
}

export default function ObjetosPerdidosB({ session, checking, objetoId, abrirObjeto }) {
  const usuarioId = session?.user?.id
  return <div className="module-page objetos-perdidos">
    <h2>Objetos perdidos</h2>
    <p className="muted">Registra objetos encontrados y consulta la evidencia guardada al recibirlos en custodia.</p>
    {!isConfigured && <Mensaje>Configura la conexión con Supabase para registrar y consultar objetos.</Mensaje>}
    {isConfigured && checking && <Mensaje>Comprobando sesión…</Mensaje>}
    {isConfigured && !checking && !usuarioId && <Mensaje>Inicia sesión con tu cuenta de encargado para continuar.</Mensaje>}
    {isConfigured && !checking && usuarioId && <AccesoEncargado key={usuarioId} usuarioId={usuarioId}
      objetoId={objetoId} abrirObjeto={abrirObjeto} />}
  </div>
}
