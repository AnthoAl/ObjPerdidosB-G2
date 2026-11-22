import { QRCodeSVG } from 'qrcode.react'
import { crearEnlaceObjeto } from './enlaceObjeto'

export default function EtiquetaObjeto({ objetoId, guardando }) {
  const enlace = crearEnlaceObjeto(objetoId)
  const hostname = new URL(enlace).hostname
  const esLocal = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)

  return <section className="panel objetos-panel-etiqueta">
    <div className="objetos-acciones">
      <h3>Etiqueta QR</h3>
      <button className="secondary small" type="button" onClick={() => window.print()}
        disabled={guardando}>Imprimir etiqueta</button>
    </div>
    <figure className="objetos-etiqueta">
      <figcaption>LABFIS · Objetos perdidos</figcaption>
      <QRCodeSVG value={enlace} size={152} marginSize={4} level="M"
        role="img" title="Código QR del expediente" />
      <code>{objetoId}</code>
    </figure>
    <p className="objetos-enlace"><a href={enlace} target="_blank" rel="noopener noreferrer">Abrir enlace del QR</a></p>
    {esLocal && <p className="muted">Para escanear con otro dispositivo, genera la etiqueta desde una dirección que ese dispositivo pueda abrir.</p>}
  </section>
}
