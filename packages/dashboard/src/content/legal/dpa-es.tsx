import { LEGAL_ENTITY } from "./entity";

export function DataProcessingAddendumEs() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          Este anexo describe el tratamiento de datos personales cuando {e.legalName} (&quot;Procesador&quot;) presta{" "}
          {e.productName} al Cliente (&quot;Responsable&quot;) bajo los Términos de Servicio. Para una versión firmada
          (enterprise), escribe a{" "}
          <a href={`mailto:${e.contactEmail}`} className="underline">
            {e.contactEmail}
          </a>
          .
        </p>
      </section>

      <section>
        <h2>1. Objeto y duración</h2>
        <p>
          El Procesador trata datos personales solo para prestar el Servicio (chat web, panel, bandeja, almacenamiento
          de documentos del Cliente, integraciones configuradas) mientras dure el contrato y según instrucciones
          documentadas del Cliente.
        </p>
      </section>

      <section>
        <h2>2. Naturaleza y finalidad</h2>
        <ul>
          <li>Mensajes de visitantes y usuarios del panel, metadatos de conversación y uso.</li>
          <li>Documentos y configuraciones que el Cliente sube para respuestas con IA.</li>
          <li>Datos de facturación y cuenta gestionados en el procesador de pagos (Creem).</li>
          <li>Logs operativos, seguridad y cumplimiento de límites del plan.</li>
        </ul>
      </section>

      <section>
        <h2>3. Categorías de interesados y datos</h2>
        <p>
          Interesados: visitantes del chat del Cliente, usuarios invitados al panel del Cliente, contactos de
          facturación del Cliente. Datos: identificadores de sesión, contenido de mensajes, archivos subidos, correos
          de cuenta, datos aproximados de red en el borde (p. ej. país) cuando Cloudflare los expone, y registros
          técnicos.
        </p>
      </section>

      <section>
        <h2>4. Subencargados</h2>
        <p>
          El Cliente autoriza subencargados necesarios para el Servicio, incluidos Cloudflare (hosting, IA, almacenamiento)
          y Creem (pagos). Lista actualizada a solicitud en {e.privacyEmail}. El Procesador exige obligaciones de
          confidencialidad y seguridad razonables.
        </p>
      </section>

      <section>
        <h2>5. Seguridad y confidencialidad</h2>
        <p>
          Medidas técnicas y organizativas acordes a un SaaS B2B: cifrado en tránsito, aislamiento por organización,
          control de acceso por rol, hash de contraseñas y monitoreo ante abuso. Personal autorizado solo accede según
          necesidad operativa.
        </p>
      </section>

      <section>
        <h2>6. Derechos de los interesados</h2>
        <p>
          El Cliente es responsable de atender solicitudes de sus usuarios finales. El Procesador asiste con herramientas
          razonables del Servicio y, cuando la ley lo exija, con soporte documentado en {e.privacyEmail}.
        </p>
      </section>

      <section>
        <h2>7. Supresión y devolución</h2>
        <p>
          Al terminar el Servicio, el Cliente puede exportar datos disponibles en el panel. Tras un periodo de retención
          acorde al plan y obligaciones legales, el Procesador suprime o anonimiza datos del tenant salvo conservación
          exigida por ley.
        </p>
      </section>

      <section>
        <h2>8. Transferencias internacionales</h2>
        <p>
          Los datos pueden procesarse fuera de {e.country} (p. ej. Estados Unidos) donde operan subencargados. El
          Procesador aplica salvaguardas contractuales y técnicas razonables descritas en la Política de privacidad.
        </p>
      </section>

      <section>
        <h2>9. Auditorías</h2>
        <p>
          Bajo acuerdo enterprise firmado, el Cliente puede solicitar información de seguridad razonable (cuestionarios,
          resúmenes de controles). No hay auditoría in situ salvo pacto escrito.
        </p>
      </section>

      <section>
        <h2>10. SLA y disponibilidad</h2>
        <p>
          Los planes self-serve no incluyen SLA de uptime; la disponibilidad es best effort y depende principalmente de
          Cloudflare como infraestructura. Compromisos de disponibilidad, tiempos de respuesta de soporte y créditos
          de servicio solo aplican si constan en un orden enterprise firmado aparte. Ver{" "}
          <a href="/legal/disponibilidad" className="underline">
            disponibilidad del servicio
          </a>
          .
        </p>
      </section>
    </>
  );
}
