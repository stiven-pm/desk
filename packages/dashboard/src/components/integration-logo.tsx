"use client";

import {
  integrationBrandInitials,
  integrationSimpleIconCdnUrl,
  type IntegrationBrand,
} from "@chatbot/domain";

type Props = {
  name: string;
  brand?: IntegrationBrand;
  /** @deprecated Usa `brand` desde @chatbot/domain */
  simpleIcon?: string;
  iconColor?: string;
  size?: number;
  className?: string;
};

export function IntegrationLogo({
  name,
  brand,
  simpleIcon,
  iconColor,
  size = 28,
  className = "",
}: Props) {
  const resolved: IntegrationBrand | undefined =
    brand ??
    (simpleIcon || iconColor
      ? { simpleIcon, iconColor: iconColor?.replace(/^#/, "") }
      : undefined);

  const cdnUrl = integrationSimpleIconCdnUrl(resolved);
  const initials = integrationBrandInitials(name);
  const fallbackColor = resolved?.iconColor?.replace(/^#/, "") ?? "64748b";

  if (cdnUrl) {
    return (
      <img
        src={cdnUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-md bg-white object-contain p-0.5 ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `#${fallbackColor}`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
