/** Ejemplo ilustrativo — mismos tokens que el chat web hosted (`hosted-public-chat`). */

const CHOICE_BTN =
  "inline-block rounded-full border border-[#d8dcde] px-3 py-1 text-xs text-[#2f3941]";

const USER_BUBBLE =
  "ml-auto max-w-[90%] w-fit rounded-lg bg-[#edf0f2] px-3 py-2 text-sm text-[#2f3941]";

const ASSISTANT_BUBBLE =
  "mr-auto max-w-[95%] w-fit rounded-lg border border-[#d8dcde] bg-white px-3 py-2 text-sm text-[#2f3941]";

export function ChatPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="pointer-events-none mx-auto flex w-full max-w-sm select-none flex-col overflow-hidden rounded-2xl border border-[#d8dcde] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
      aria-label="Ejemplo ilustrativo de chat web"
    >
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[#d8dcde] bg-white px-4 py-3">
        <h2 className="min-w-0 text-base font-semibold text-[#2f3941]">Snack Bar Norte</h2>
        <span className="shrink-0 rounded-md border border-[#d8dcde] px-2.5 py-1 text-xs text-[#68737d]">
          Empezar de nuevo
        </span>
      </header>

      <div
        className={`min-h-0 flex-1 space-y-3 overflow-hidden p-4 ${compact ? "max-h-[19rem]" : "max-h-[26rem]"}`}
      >
        <div className={ASSISTANT_BUBBLE}>
          <p className="whitespace-pre-wrap">
            {`¡Hola! Bienvenido a Snack Bar Norte 🙌\n¿Te muestro el menú o buscas algo en particular?`}
          </p>
        </div>
        <div className={USER_BUBBLE}>¿Qué venden?</div>
        <div className={ASSISTANT_BUBBLE}>
          <p className="whitespace-pre-wrap">
            {`🍗 Costillas — 6 costillas con ensalada ($30.000)\n🍟 Snacks — 16 piezas con papitas ($20.000)`}
          </p>
          <p className="mt-2">¿Te llevo alguno al carrito?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={CHOICE_BTN}>Ver productos</span>
          </div>
        </div>
        {!compact && (
          <>
            <div className={USER_BUBBLE}>Las costillas, por favor</div>
            <div className={ASSISTANT_BUBBLE}>
              <div className="space-y-1.5">
                <div className="flex w-full items-baseline justify-between gap-2 rounded-md border border-[#d8dcde] px-3 py-2 text-left">
                  <span className="min-w-0 font-medium">Costillas BBB</span>
                  <span className="shrink-0 text-xs text-[#68737d]">$30.000</span>
                </div>
                <div className="flex w-full items-baseline justify-between gap-2 rounded-md border border-[#d8dcde] px-3 py-2 text-left">
                  <span className="min-w-0 font-medium">Snacks de pollo</span>
                  <span className="shrink-0 text-xs text-[#68737d]">$20.000</span>
                </div>
              </div>
            </div>
            <div className={ASSISTANT_BUBBLE}>
              Listo. Te envío el enlace para pagar cuando confirmes.
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-[#d8dcde] bg-white">
        <div className="flex gap-2 p-3 pt-2">
          <div className="min-w-0 flex-1 rounded-md border border-[#d8dcde] px-3 py-2 text-sm text-[#68737d]">
            Escribe un mensaje…
          </div>
          <span className="rounded-md bg-[#2f3941] px-4 py-2 text-sm font-medium text-white">
            Enviar
          </span>
        </div>
      </div>
    </div>
  );
}
