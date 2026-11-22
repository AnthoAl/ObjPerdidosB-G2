import { supabase } from '../../lib/supabase'

const TABLA_OBJETOS = 'objetos_perdidos_b'
const TABLA_ENCARGADOS = 'objetos_perdidos_b_encargados'
const TABLA_EVIDENCIAS = 'objetos_perdidos_b_evidencias'
const TABLA_FOTOS = 'objetos_perdidos_b_fotos'
const BUCKET = 'objetos-perdidos-b-evidencias'
const CAMPOS_OBJETO = 'id,descripcion,lugar_hallazgo,fecha_hallazgo,ubicacion_custodia,estado,registrado_por,registrado_en'

export const EN_RECEPCION = 'En recepción'

export async function esEncargado(usuarioId) {
  const { data } = await supabase.from(TABLA_ENCARGADOS)
    .select('usuario_id').eq('usuario_id', usuarioId).maybeSingle().throwOnError()
  return Boolean(data)
}

export async function listarObjetos() {
  const { data } = await supabase.from(TABLA_OBJETOS).select(CAMPOS_OBJETO)
    .order('registrado_en', { ascending: false }).throwOnError()
  return data
}

export async function registrarObjeto(id, campos) {
  const { data, error } = await supabase.from(TABLA_OBJETOS)
    .insert({ ...campos, id }).select(CAMPOS_OBJETO).single()
  if (!error) return data

  // La inserción puede haberse confirmado aunque el navegador no haya recibido respuesta.
  const { data: existente } = await supabase.from(TABLA_OBJETOS)
    .select(CAMPOS_OBJETO).eq('id', id).maybeSingle()
  if (existente) return existente
  throw error
}

export async function consultarExpediente(objetoId) {
  const { data: objeto } = await supabase.from(TABLA_OBJETOS).select(CAMPOS_OBJETO)
    .eq('id', objetoId).maybeSingle().throwOnError()
  if (!objeto) throw new Error('El objeto no existe o no está disponible para esta cuenta.')
  if (objeto.estado === EN_RECEPCION) return { objeto, evidencia: null, fotos: [] }

  const [{ data: evidencia }, { data: referencias }] = await Promise.all([
    supabase.from(TABLA_EVIDENCIAS).select('observaciones,confirmado_por,confirmado_en')
      .eq('objeto_id', objetoId).single().throwOnError(),
    supabase.from(TABLA_FOTOS).select('ruta').eq('objeto_id', objetoId)
      .order('ruta').throwOnError(),
  ])

  if (referencias.length === 0) return { objeto, evidencia, fotos: [] }
  const rutas = referencias.map(({ ruta }) => ruta)
  const { data: enlaces } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 300)
  const urlsPorRuta = new Map((enlaces ?? []).map(({ path, signedUrl }) => [path, signedUrl]))
  const fotos = rutas.map(ruta => ({ ruta, url: urlsPorRuta.get(ruta) }))
  return { objeto, evidencia, fotos }
}

export async function actualizarUbicacion(objetoId, ubicacion) {
  const { data } = await supabase.from(TABLA_OBJETOS).update({ ubicacion_custodia: ubicacion })
    .eq('id', objetoId).select('ubicacion_custodia').maybeSingle().throwOnError()
  if (!data) throw new Error('El objeto no está disponible para actualizar.')
  return data.ubicacion_custodia
}

export async function cargarFoto({ archivo, ruta }) {
  const bucket = supabase.storage.from(BUCKET)
  const { error } = await bucket.upload(ruta, archivo, { contentType: archivo.type, upsert: false })
  if (!error) return

  // La ruta se asigna una sola vez por foto. Si el archivo ya llegó, se reutiliza.
  const { data: existente } = await bucket.info(ruta)
  if (!existente) throw new Error(`No se pudo cargar ${archivo.name}. ${error.message}`)
}

export async function confirmarCustodia(objetoId, observaciones, rutas) {
  await supabase.rpc('confirmar_custodia_objeto_perdido_b', {
    p_objeto_id: objetoId,
    p_observaciones: observaciones,
    p_rutas: rutas,
  }).throwOnError()
}
