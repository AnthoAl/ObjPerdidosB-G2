const PARAMETRO_OBJETO = 'objeto'
const PATRON_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function esIdentificadorObjeto(valor) {
  return PATRON_UUID.test(valor)
}

export function leerObjetoEnlace() {
  return new URLSearchParams(window.location.search).get(PARAMETRO_OBJETO)
}

export function escribirObjetoEnlace(id) {
  const url = new URL(window.location.href)
  if (id === null) url.searchParams.delete(PARAMETRO_OBJETO)
  else url.searchParams.set(PARAMETRO_OBJETO, id)
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
}

export function crearEnlaceObjeto(id) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PARAMETRO_OBJETO, id)
  return url.href
}

export function crearIdentificador() {
  if (crypto.randomUUID) return crypto.randomUUID()

  // getRandomValues también está disponible cuando Vite se abre por HTTP en la red local.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}
