import { LEGAL_ENTITY } from "./entity";
import { TRIAL_DURATION_DAYS } from "@chatbot/domain";

export const termsNavEs = [
  { href: "#servicio", label: "Servicio" },
  { href: "#cuentas", label: "Cuentas" },
  { href: "#uso", label: "Uso aceptable" },
  { href: "#facturacion", label: "Facturación" },
  { href: "#ip", label: "Propiedad intelectual" },
  { href: "#dmca", label: "Derechos de autor" },
  { href: "#responsabilidad", label: "Responsabilidad" },
  { href: "#arbitraje", label: "Disputas" },
];

export function TermsOfServiceEs() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          Estos Términos de Servicio (&quot;Términos&quot;) son un acuerdo vinculante entre tú y {e.legalName}{" "}
          (&quot;{e.brand}&quot;, &quot;nosotros&quot;) sobre el acceso a {e.productName} en{" "}
          <a href={e.siteUrl}>{e.siteUrl}</a> y APIs relacionadas (el &quot;Servicio&quot;). Al registrarte, iniciar
          sesión marcando la aceptación, hacer clic en aceptar o usar el Servicio, aceptas estos Términos y nuestra{" "}
          <a href="/privacidad">Política de privacidad</a>. Si usas el Servicio en nombre de una empresa, declaras
          tener facultad para obligarla.
        </p>
        <p className="mt-3">
          <strong>Quién cobra y responde.</strong> Suscripciones y cargos de wallet los factura {e.legalName} a través
          de nuestro procesador de pagos en dólares estadounidenses, salvo acuerdo escrito distinto. {e.legalName} es
          la contraparte contractual del Servicio. Tú eres responsable de impuestos, declaraciones y cumplimiento
          aplicable a tu negocio y a tus usuarios finales.
        </p>
      </section>

      <section id="servicio">
        <h2>1. El Servicio</h2>
        <p>
          {e.productName} es software multi-tenant que responde con IA en chat web y tienda hosted, usando tus
          documentos e integraciones. Podemos modificar funcionalidades con aviso razonable. El Servicio se presta con
          esfuerzos comercialmente razonables; no garantizamos disponibilidad ininterrumpida.
        </p>
        <p className="mt-3">
          <strong>Respuestas de la IA.</strong> Las respuestas se generan automáticamente a partir de tu
          configuración, documentos e integraciones y pueden contener errores. Eres responsable de mantener
          actualizada esa información (precios, stock, políticas) y de lo que la IA comunique en tu nombre a tus
          clientes.
        </p>
      </section>

      <section id="cuentas">
        <h2>2. Cuentas y seguridad</h2>
        <ul>
          <li>Debes proporcionar datos de registro veraces y mantener confidenciales tus credenciales.</li>
          <li>Gestionas roles del equipo (owner, admin, agent) dentro de tu organización.</li>
          <li>Eres responsable de la actividad bajo tu cuenta y de proteger claves API e integraciones.</li>
          <li>Podemos suspender cuentas por abuso sospechado, impago o riesgo legal.</li>
        </ul>
      </section>

      <section id="uso">
        <h2>3. Uso aceptable</h2>
        <p>Tú y tus usuarios finales no podéis:</p>
        <ul>
          <li>Violar la ley, infringir propiedad intelectual o acosar a terceros.</li>
          <li>Enviar spam, phishing o mensajes automatizados ilícitos.</li>
          <li>Subir malware, contenido ilegal o material sin derechos de uso.</li>
          <li>Explorar o eludir límites técnicos, seguridad o medición del Servicio.</li>
          <li>Usar el Servicio para decisiones reguladas de alto riesgo sin supervisión humana adecuada.</li>
        </ul>
        <p className="mt-3">
          Podemos retirar contenido, limitar tráfico o terminar el acceso con aviso cuando sea práctico, o de
          inmediato ante riesgo grave.
        </p>
      </section>

      <section id="facturacion">
        <h2>4. Planes, facturación y reembolsos</h2>
        <ul>
          <li>
            Al registrarte puedes usar el Servicio durante {TRIAL_DURATION_DAYS} días de prueba con cupos reducidos
            (sin tarjeta). Tras ese periodo, o si activas un plan de pago antes, rigen los límites del plan vigente.
            Sin plan de pago activo al vencer la prueba, el chat de visitantes y las APIs operativas quedan suspendidos
            hasta que elijas un plan.
          </li>
          <li>
            Los planes de pago se renuevan mensualmente hasta cancelación en el portal de facturación o aviso escrito
            cuando el portal no esté disponible.
          </li>
          <li>
            <strong>Política de reembolso:</strong> salvo ley imperativa de consumo,{" "}
            <strong>todas las cuotas son no reembolsables</strong>, incluidos periodos parciales, cupos de mensajes o
            créditos no usados y recargas de wallet. Contracargos sin contactarnos antes pueden implicar suspensión.
          </li>
          <li>Los cambios de precio aplican en la renovación siguiente tras aviso a contactos de facturación.</li>
          <li>Un acuerdo enterprise firmado por escrito puede sustituir esta sección.</li>
        </ul>
      </section>

      <section id="ip">
        <h2>5. Propiedad intelectual y tu contenido</h2>
        <p>
          Conservas la titularidad de tus datos, documentos y configuraciones. Otorgas a {e.legalName} una licencia
          mundial, no exclusiva, para alojar, procesar, transmitir y mostrar tu contenido únicamente para operar el
          Servicio. {e.productName}, nuestras marcas y documentación siguen siendo nuestra propiedad.
        </p>
        <p className="mt-3">
          Las salidas generadas por IA pueden no ser únicas; otras personas pueden recibir salidas similares. Revisa
          las salidas antes de confiar en ellas comercial o legalmente.
        </p>
      </section>

      <section id="dmca">
        <h2>6. Reclamaciones de derechos de autor (DMCA)</h2>
        <p>
          Si crees que contenido en el Servicio infringe tu copyright, envía aviso a nuestro agente designado en{" "}
          <a href={`mailto:${e.dmcaEmail}`}>{e.dmcaEmail}</a> con: (1) identificación de la obra; (2) identificación
          del material y su ubicación; (3) tus datos de contacto; (4) declaración de buena fe de uso no autorizado;
          (5) declaración bajo pena de perjurio de exactitud y autorización para actuar; (6) firma física o
          electrónica. Podemos retirar o deshabilitar acceso y notificar al autor. Los contraavisos siguen el DMCA
          estadounidense cuando aplique. Ver también <a href="/legal/dmca">política DMCA</a>.
        </p>
        <p className="mt-3">
          Para retiros no relacionados con copyright (difamación, privacidad, marca), escribe a {e.contactEmail} con
          detalle suficiente para evaluar la solicitud.
        </p>
      </section>

      <section id="privacidad">
        <h2>7. Privacidad</h2>
        <p>
          Nuestra <a href="/privacidad">Política de privacidad</a> describe el tratamiento de datos. Cuando procesas
          datos personales de usuarios finales, tú eres responsable del tratamiento y nosotros encargados, según allí
          se indica y en cualquier DPA que firmes con nosotros.
        </p>
      </section>

      <section id="terceros">
        <h2>8. Servicios de terceros</h2>
        <p>
          Integraciones, procesadores de pago y APIs que configures son servicios de terceros. No respondemos por su
          disponibilidad, términos ni actos. Los usas bajo tu propio riesgo.
        </p>
      </section>

      <section id="responsabilidad">
        <h2>9. Exclusiones y limitación de responsabilidad</h2>
        <p>
          EL SERVICIO SE OFRECE &quot;TAL CUAL&quot; Y &quot;SEGÚN DISPONIBILIDAD&quot;. EN LA MÁXIMA MEDIDA PERMITIDA
          POR LA LEY, RECHAZAMOS TODAS LAS GARANTÍAS, EXPRESAS O IMPLÍCITAS, INCLUIDAS COMERCIABILIDAD, IDONEIDAD PARA
          UN FIN DETERMINADO Y NO INFRACCIÓN.
        </p>
        <p className="mt-3">
          NO SEREMOS RESPONSABLES DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENCIALES O PUNITIVOS, NI DE
          LUCRO CESANTE O PÉRDIDA DE DATOS. NUESTRA RESPONSABILIDAD TOTAL POR CUALQUIER RECLAMACIÓN DERIVADA DE ESTOS
          TÉRMINOS O DEL SERVICIO SE LIMITA AL MAYOR DE (A) LO PAGADO EN LOS DOCE (12) MESES ANTERIORES AL HECHO QUE
          ORIGINE LA RECLAMACIÓN O (B) CIEN DÓLARES ESTADOUNIDENSES (USD $100).
        </p>
        <p className="mt-3">
          Algunas jurisdicciones no permiten ciertas limitaciones; en esos casos nuestra responsabilidad se limita al
          máximo permitido.
        </p>
      </section>

      <section id="indemnidad">
        <h2>10. Indemnidad</h2>
        <p>
          Defenderás e indemnizarás a {e.legalName} y sus directores, empleados y filiales frente a reclamaciones
          derivadas de tu contenido, tu uso del Servicio, tus usuarios finales, tus integraciones o tu incumplimiento
          de estos Términos o la ley aplicable, salvo en la medida causada por nuestra culpa grave o dolo.
        </p>
      </section>

      <section id="terminacion">
        <h2>11. Suspensión y terminación</h2>
        <p>
          Cualquiera de las partes puede terminar por incumplimiento material no subsanado en 30 días desde aviso.
          Podemos suspender de inmediato por impago, abuso o obligación legal. Al terminar, cesa tu derecho de acceso;
          exporta datos antes de cancelar cuando sea posible. Sobreviven las secciones que por naturaleza deban
          hacerlo (pago adeudado, límites de responsabilidad, arbitraje, PI).
        </p>
      </section>

      <section id="arbitraje">
        <h2>12. Resolución de disputas y arbitraje</h2>
        <p>
          <strong>Resolución informal.</strong> Contacta primero a {e.contactEmail}; intentaremos resolver en 30 días.
        </p>
        <p className="mt-3">
          <strong>Arbitraje vinculante.</strong> Salvo reclamos de menor cuantía o medidas cautelares por PI o acceso
          no autorizado, cualquier disputa derivada de estos Términos o del Servicio se resolverá mediante arbitraje
          vinculante administrado por el Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá (u otro
          foro acordado), en Bogotá, {e.country}, en español o inglés según acuerden las partes. El árbitro puede
          conceder los mismos daños que un tribunal, sujeto a los límites de responsabilidad de estos Términos.
        </p>
        <p className="mt-3">
          <strong>Renuncia a acciones colectivas.</strong> En la medida permitida, las disputas deben plantearse solo a
          título individual, no como acción colectiva o representativa.
        </p>
        <p className="mt-3">
          <strong>Ley aplicable.</strong> Estos Términos se rigen por las leyes de {e.governingLaw}, sin perjuicio de
          normas imperativas de conflicto, salvo que en tu país de residencia apliquen protecciones obligatorias al
          consumidor.
        </p>
      </section>

      <section id="general">
        <h2>13. Disposiciones generales</h2>
        <ul>
          <li>Estos Términos son el acuerdo íntegro salvo orden enterprise firmada.</li>
          <li>No puedes ceder sin nuestro consentimiento; podemos ceder en una transferencia de negocio.</li>
          <li>La falta de exigencia de un incumplimiento no implica renuncia.</li>
          <li>Los avisos pueden enviarse al correo de tu cuenta o contacto de facturación.</li>
        </ul>
        <p className="mt-3">
          Preguntas: <a href={`mailto:${e.contactEmail}`}>{e.contactEmail}</a>.
        </p>
      </section>
    </>
  );
}
