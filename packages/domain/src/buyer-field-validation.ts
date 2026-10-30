function capitalizeWord(word: string): string {
  const w = word.trim();
  if (!w) return w;
  return w.charAt(0).toLocaleUpperCase("es-CO") + w.slice(1).toLocaleLowerCase("es-CO");
}

export function validateCommerceBuyerField(
  field: string,
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  switch (field) {
    case "name": {
      const parts = t.split(/\s+/).filter(Boolean);
      if (parts.length < 2 || t.length < 5) {
        return {
          ok: false,
          message: "Escribe tu nombre y apellido (mínimo dos palabras).",
        };
      }
      if (!/^[\p{L}\s'.-]+$/u.test(t)) {
        return { ok: false, message: "Usa solo letras en el nombre." };
      }
      return { ok: true, value: parts.map(capitalizeWord).join(" ") };
    }
    case "documentId": {
      const digits = t.replace(/\D/g, "");
      if (digits.length < 6 || digits.length > 12) {
        return {
          ok: false,
          message: "El documento debe ser solo números (6 a 12 dígitos).",
        };
      }
      return { ok: true, value: digits };
    }
    case "phone": {
      const digits = t.replace(/\D/g, "");
      if (!/^3\d{9}$/.test(digits)) {
        return {
          ok: false,
          message: "Indica un celular colombiano de 10 dígitos (empieza en 3).",
        };
      }
      return { ok: true, value: digits };
    }
    case "city": {
      if (t.length < 3 || !/[\p{L}]/u.test(t)) {
        return {
          ok: false,
          message: "Indica la ciudad con letras (mínimo 3 caracteres).",
        };
      }
      return {
        ok: true,
        value: t
          .split(/\s+/)
          .filter(Boolean)
          .map(capitalizeWord)
          .join(" "),
      };
    }
    case "address": {
      if (t.length < 8) {
        return {
          ok: false,
          message: "La dirección es muy corta. Incluye calle/carrera y número.",
        };
      }
      if (!/\d/.test(t) || !/[\p{L}]/u.test(t)) {
        return {
          ok: false,
          message: "Incluye calle y número (ej. Carrera 28 #88-90).",
        };
      }
      return { ok: true, value: t };
    }
    default:
      if (!t) return { ok: false, message: "Escribe un valor válido." };
      return { ok: true, value: t };
  }
}
