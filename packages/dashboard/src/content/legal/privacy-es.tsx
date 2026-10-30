import { LEGAL_ENTITY } from "./entity";

export const privacyNavEs = [
  { href: "#recogemos", label: "Datos que tratamos" },
  { href: "#chat-web", label: "Chat web" },
  { href: "#ia", label: "IA" },
  { href: "#compartimos", label: "Con quién compartimos" },
  { href: "#retencion", label: "Tiempo de conservación" },
  { href: "#seguridad", label: "Seguridad" },
  { href: "#derechos", label: "Tus derechos" },
];

export function PrivacyPolicyEs() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          {e.legalName} (&quot;{e.brand}&quot;, &quot;nosotros&quot;) opera {e.productName}, software en la nube
          que permite a empresas clientes (&quot;clientes&quot; o &quot;tenants&quot;) responder con asistencia de IA a
          sus propios clientes (&quot;usuarios finales&quot;) en el chat web y la tienda hosted. Esta Política explica cómo
          recogemos, usamos, divulgamos y conservamos datos personales en{" "}
          <a href={e.siteUrl}>{e.siteUrl}</a>, APIs, chat web, panel y facturación (el
          &quot;Servicio&quot;).
        </p>
        <p className="mt-3">
          <strong>Dos roles.</strong> Para cuenta, facturación y operación de la plataforma somos{" "}
          <strong>responsables del tratamiento</strong>. Para conversaciones, archivos subidos y datos tratados
          según instrucciones del cliente, actuamos como <strong>encargados</strong>. El cliente debe informar a sus
          usuarios finales y obtener el consentimiento exigido (incluido mensajería automatizada e IA).
        </p>
      </section>

      <section id="recogemos">
        <h2>Datos que tratamos</h2>
        <ul>
          <li>
            <strong>Cuenta:</strong> correo, nombre, organización, contraseña (hash), roles del equipo.
          </li>
          <li>
            <strong>Facturación:</strong> plan, historial de pagos vía procesador; no guardamos números completos de
            tarjeta.
          </li>
          <li>
            <strong>Contenido del cliente:</strong> instrucciones del bot, PDFs, imágenes, videos (si los subes),
            integraciones API/MCP, credenciales cifradas.
          </li>
          <li>
            <strong>Usuarios finales:</strong> identificador de sesión, teléfono o correo si lo dejan, mensajes, adjuntos
            y metadatos de conversación (fecha, estado de entrega).
          </li>
          <li>
            <strong>Automático:</strong> cookies en sitio de marketing y panel, logs técnicos y de auditoría (ver{" "}
            <a href="/legal/cookies">aviso de cookies</a>).
          </li>
        </ul>
        <h3 id="etiqueta">Etiqueta resumen de privacidad</h3>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Ejemplos</th>
              <th>¿Vendemos?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identificadores</td>
              <td>Correo, org, ID de visitante</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Contenido</td>
              <td>Chat, PDF, imagen, video</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Técnicos</td>
              <td>IP, logs, cookies</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Inferencias</td>
              <td>Embeddings, respuestas IA (sin entrenar modelos públicos)</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3">
          No vendemos datos. No usamos conversaciones ni documentos para entrenar modelos propios ni de terceros.
        </p>
      </section>

      <section id="uso">
        <h2>Finalidades</h2>
        <p>
          Prestar y asegurar el Servicio, generar respuestas asistidas por IA, facturar, prevenir abuso, cumplir la
          ley y comunicarnos contigo sobre el producto y seguridad.
        </p>
      </section>

      <section id="chat-web">
        <h2>Chat web</h2>
        <p>
          Cuando publicas tu chat o tienda en Desk, procesamos mensajes y datos que tus visitantes envían para
          generar las respuestas que configures. Eres responsable de informar a tus clientes y obtener el
          consentimiento que exija tu sector.
        </p>
      </section>

      <section id="ia">
        <h2>Inteligencia artificial</h2>
        <p>
          Los usuarios finales pueden interactuar con sistemas <strong>automatizados</strong>. Las respuestas pueden
          contener errores. Debes informar cuando corresponda (incluidas expectativas tipo FTC en EE. UU.). Imágenes,
          PDF y video se pueden analizar para extraer texto útil; los archivos se conservan según tu plan.
        </p>
      </section>

      <section id="compartimos">
        <h2>Subencargados y compartición</h2>
        <p>
          No vendemos datos personales. No compartimos datos de la plataforma con terceros para publicidad ni fines
          ajenos al Servicio. Usamos <strong>encargados del tratamiento</strong> bajo contrato, entre ellos Cloudflare,
          Inc. (infraestructura, almacenamiento, procesamiento con IA y webhooks), Creem (pagos), proveedores de geolocalización por IP
          del panel e integraciones que tú configures. Lista actualizada a solicitud en{" "}
          {e.privacyEmail}.
        </p>
        <p className="mt-3" id="authorities">
          <strong>Solicitudes de autoridades.</strong> Si recibimos una solicitud legal de una autoridad pública,
          revisamos su legalidad, limitamos la divulgación al mínimo necesario, documentamos la solicitud y la respuesta,
          y podemos impugnar solicitudes que consideremos ilícitas, salvo prohibición legal de hacerlo.
        </p>
      </section>

      <section id="retencion">
        <h2>Conservación</h2>
        <p>
          Cuenta mientras dure la suscripción y plazo razonable posterior. Conversaciones según días del plan.
          Copias de seguridad pueden persistir un tiempo limitado tras eliminación.
        </p>
      </section>

      <section id="seguridad">
        <h2>Seguridad</h2>
        <ul>
          <li>HTTPS en tránsito; aislamiento multi-tenant por organización.</li>
          <li>Contraseñas con hash; secretos de integración cifrados.</li>
          <li>Monitoreo, límites de tasa y procedimiento de respuesta a incidentes.</li>
        </ul>
        <p className="mt-3">Vulnerabilidades: {e.securityEmail}.</p>
      </section>

      <section id="derechos">
        <h2>Derechos (Colombia, GDPR, EE. UU.)</h2>
        <p>
          Puedes solicitar acceso, rectificación, supresión, portabilidad u oposición escribiendo a{" "}
          <a href={`mailto:${e.privacyEmail}`}>{e.privacyEmail}</a>. En Colombia, Ley 1581 de 2012. Usuarios finales:
          contacta primero al negocio con el que hablaste en el chat. Residentes UE/UK pueden reclamar ante su autoridad de
          control.
        </p>
      </section>

      <section id="transferencias">
        <h2>Transferencias internacionales</h2>
        <p>
          Datos pueden procesarse fuera de Colombia (p. ej. EE. UU.) con salvaguardas contractuales y medidas de
          seguridad de proveedores.
        </p>
      </section>

      <section id="contacto">
        <h2>Contacto</h2>
        <p>
          Responsable: {e.legalName}, {e.country}. Privacidad:{" "}
          <a href={`mailto:${e.privacyEmail}`}>{e.privacyEmail}</a>.
        </p>
      </section>
    </>
  );
}
