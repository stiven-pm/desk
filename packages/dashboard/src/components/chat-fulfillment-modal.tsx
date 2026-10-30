"use client";

import { useState } from "react";

export type FulfillmentPayload =
  | { mode: "pickup" }
  | {
      mode: "delivery";
      fullName: string;
      phone: string;
      city: string;
      address: string;
      extra?: string;
    };

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: FulfillmentPayload) => void;
};

export function ChatFulfillmentModal({ open, busy, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<"mode" | "delivery">("mode");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [extra, setExtra] = useState("");

  if (!open) return null;

  function reset() {
    setStep("mode");
    setFullName("");
    setPhone("");
    setCity("");
    setAddress("");
    setExtra("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fulfillment-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 id="fulfillment-title" className="text-base font-semibold text-[#2f3941]">
          ¿Cómo recibes tu pedido?
        </h2>
        <p className="mt-1 text-xs text-[#68737d]">
          Tu pago ya quedó registrado. Elige recogida en tienda o envío a domicilio.
        </p>

        {step === "mode" ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[#d8dcde] px-4 py-3 text-left text-sm hover:bg-[#f8f9f9] disabled:opacity-50"
              onClick={() => onSubmit({ mode: "pickup" })}
            >
              <span className="font-medium">Recoger en tienda</span>
              <span className="mt-0.5 block text-xs text-[#68737d]">
                Te avisamos cuando esté listo.
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[#d8dcde] px-4 py-3 text-left text-sm hover:bg-[#f8f9f9] disabled:opacity-50"
              onClick={() => setStep("delivery")}
            >
              <span className="font-medium">Envío a domicilio</span>
              <span className="mt-0.5 block text-xs text-[#68737d]">
                Necesitamos tu dirección completa.
              </span>
            </button>
          </div>
        ) : (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({
                mode: "delivery",
                fullName: fullName.trim(),
                phone: phone.trim(),
                city: city.trim(),
                address: address.trim(),
                extra: extra.trim() || undefined,
              });
            }}
          >
            <input
              required
              className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
              placeholder="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={busy}
            />
            <input
              required
              className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
              placeholder="Número de teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
            <input
              required
              className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={busy}
            />
            <input
              required
              className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
              placeholder="Dirección exacta"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={busy}
            />
            <textarea
              className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
              placeholder="Información extra (torre, apto, referencias)"
              rows={2}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              disabled={busy}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-[#d8dcde] px-3 py-2 text-xs"
                onClick={() => setStep("mode")}
                disabled={busy}
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-[#2f3941] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Guardando…" : "Confirmar envío"}
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-[#68737d] underline"
          onClick={() => {
            reset();
            onClose();
          }}
          disabled={busy}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
