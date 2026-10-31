import { ORG_TIMEZONE_OPTIONS } from "@chatbot/domain";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function OrgTimezoneSelect({
  value,
  onChange,
  disabled,
  id,
  className = "mt-1 w-full rounded-md border px-3 py-2 text-sm",
}: Props) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {ORG_TIMEZONE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function detectBrowserOrgTimezone(fallback = "America/Bogota"): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ORG_TIMEZONE_OPTIONS.some((o) => o.value === detected)) {
      return detected;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
