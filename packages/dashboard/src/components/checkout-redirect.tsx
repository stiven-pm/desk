/** Full-page hold while Creem loads — avoids flashing marketing or plan picker. */
export function CheckoutRedirect({ planLabel }: { planLabel?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div
        className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
        aria-hidden
      />
      <h1 className="text-lg font-semibold">Abriendo pago seguro</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Te llevamos a Creem
        {planLabel ? ` para el plan ${planLabel}` : ""}. No cierres esta pestaña.
      </p>
    </div>
  );
}
