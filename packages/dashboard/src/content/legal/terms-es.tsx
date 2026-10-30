import { LEGAL_ENTITY } from "./entity";

export const termsNavEs = [
  { href: "#servicio", label: "Servicio" },
  { href: "#uso", label: "Uso aceptable" },
  { href: "#facturacion", label: "Facturación" },
  { href: "#ip", label: "Propiedad intelectual" },
  { href: "#responsabilidad", label: "Responsabilidad" },
  { href: "#arbitraje", label: "Arbitraje" },
];

export function TermsOfServiceEs() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          Estos Términos regulan el uso de {e.productName} operado por {e.legalName} en{" "}
          <a href={e.siteUrl}>{e.siteUrl}</a>. Al registrarte o usar el Servicio aceptas estos Términos. Si actúas
          por una empresa, declaras tener facultad para obligarla.
        </p>
        <p className="mt-3">
          <strong>Quién cobra y responde.</strong> Las suscripciones y recargas de wallet las factura {e.legalName}{" "}
          en USD salvo acuerdo escrito distinto. {e.legalName} es la contraparte del Servicio. Tú eres responsable de
          impuestos, cumplimiento sectorial y relación con tus usuarios finales.
        </p>
      </section>

      <section id="servicio">
        <h2>1. Servicio</h2>
        <p>
          Software SaaS multi-tenant que responde con IA en chat web y tienda hosted, usando tus documentos
          e integraciones. Sin garantía de disponibilidad ininterrumpida.
        </p>
        <p className="mt-3">
          <strong>Respuestas de la IA.</strong> Las respuestas se generan automáticamente a partir de tu
          configuración, documentos e integraciones y pueden contener errores. Eres responsable de mantener
          actualizada esa información (precios, stock, políticas) y de lo que la IA comunique en tu nombre a tus
          clientes. Configura qué temas no debe tratar.
        </p>
      </section>

      <section id="cuentas">
        <h2>2. Cuentas</h2>
        <p>
          Información veraz, credenciales confidenciales, responsabilidad por tu equipo y claves API. Podemos
          suspender por abuso, impago o riesgo legal.
        </p>
      </section>

      <section id="uso">
        <h2>3. Uso aceptable</h2>
        <p>
          Prohibido: ilegalidad, spam, phishing, infracción de derechos, malware, eludir límites técnicos. Podemos retirar contenido o cerrar acceso con aviso razonable o de
          inmediato si hay riesgo grave.
        </p>
      </section>

      <section id="facturacion">
        <h2>4. Planes, facturación y reembolsos</h2>
        <ul>
          <li>
            El Servicio requiere un plan de pago activo desde el registro; no hay periodo de prueba gratuito ni
            uso del panel sin suscripción.
          </li>
          <li>Renovación mensual hasta cancelación en el portal de pagos.</li>
          <li>
            <strong>Política de reembolso:</strong> salvo ley imperativa de consumo,{" "}
            <strong>no hay reembolsos</strong> de cuotas, periodos parciales, cupos no usados ni recargas de wallet.
          </li>
        </ul>
      </section>

      <section id="ip">
        <h2>5. Propiedad intelectual y contenido</h2>
        <p>
          Conservas tus datos y documentos; nos otorgas licencia limitada para operar el Servicio. Desk y marcas
          Rekov son nuestras. Revisa las salidas de IA antes de decisiones comerciales o legales.
        </p>
      </section>

      <section id="dmca">
        <h2>6. Derechos de autor y retiro de contenido</h2>
        <p>
          Notificaciones de copyright según DMCA (cuando aplique) a {e.dmcaEmail}. Otras solicitudes de retiro:
          {e.contactEmail}. Detalle en <a href="/legal/dmca">política DMCA</a>.
        </p>
      </section>

      <section id="privacidad">
        <h2>7. Privacidad</h2>
        <p>
          Ver <a href="/privacidad">Política de privacidad</a>. Para datos de usuarios finales, tú eres responsable
          y nosotros encargados.
        </p>
      </section>

      <section id="responsabilidad">
        <h2>8. Limitación de responsabilidad</h2>
        <p>
          El Servicio se ofrece &quot;tal cual&quot;. En la medida permitida por la ley, no respondemos por daños
          indirectos ni lucro cesante. La responsabilidad total se limita a lo pagado en los 12 meses anteriores al
          hecho o USD $100, lo que sea mayor, salvo normas imperativas.
        </p>
      </section>

      <section id="indemnidad">
        <h2>9. Indemnidad</h2>
        <p>
          Nos indemnizarás por reclamaciones derivadas de tu contenido, tus usuarios finales, tus integraciones o
          incumplimiento de estos Términos, salvo dolo o culpa grave nuestra.
        </p>
      </section>

      <section id="terminacion">
        <h2>10. Suspensión y terminación</h2>
        <p>
          Terminación por incumplimiento material no subsanado en 30 días. Exporta datos antes de cancelar. Sobreviven
          pago adeudado, límites de responsabilidad y arbitraje.
        </p>
      </section>

      <section id="arbitraje">
        <h2>11. Arbitraje y ley aplicable</h2>
        <p>
          Primero intenta resolver en {e.contactEmail}. Salvo reclamos de menor cuantía o medidas cautelares de PI,
          las disputas se someterán a <strong>arbitraje vinculante</strong> ante el Centro de Arbitraje y Conciliación
          de la Cámara de Comercio de Bogotá (u otro acordado), en Bogotá, bajo sus reglas. Renuncia a acciones
          colectivas en la medida permitida. Ley de la {e.governingLaw}, sin perjuicio de derechos imperativos del
          consumidor en tu país.
        </p>
      </section>

      <section id="general">
        <h2>12. General</h2>
        <p>
          Acuerdo íntegro salvo orden enterprise firmada. Contacto:{" "}
          <a href={`mailto:${e.contactEmail}`}>{e.contactEmail}</a>.
        </p>
      </section>
    </>
  );
}
