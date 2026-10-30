"use client";

import type { IntegrationTileDef } from "@/lib/integration-tiles";
import { integrationCategoryLabel } from "@/lib/integration-tiles";
import { IntegrationLogo } from "@/components/integration-logo";

type Props = {
  tile: IntegrationTileDef;
  connected: boolean;
  onClick: () => void;
  /** Si true, muestra el blurb completo; si false, una línea de estado */
  compactStatus?: string;
};

export function IntegrationMarketplaceCard({
  tile,
  connected,
  onClick,
  compactStatus,
}: Props) {
  const categoryLabel = integrationCategoryLabel(tile.category);
  const description = compactStatus ?? tile.subtitle;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[148px] w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-[var(--primary)] hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="relative shrink-0">
          <IntegrationLogo name={tile.name} brand={tile.brand} size={36} />
          {connected && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)] bg-green-500"
              title="Conectado"
            />
          )}
        </span>
        <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--muted)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          {categoryLabel}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold leading-snug text-[var(--foreground)] group-hover:text-[var(--primary)]">
        {tile.name}
      </h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      {tile.methods.length > 1 && (
        <p className="mt-2 text-[10px] text-[var(--muted)]">
          {tile.methods.length} formas de conectar · clic para elegir
        </p>
      )}
    </button>
  );
}

/** @deprecated Usa IntegrationMarketplaceCard */
export { IntegrationMarketplaceCard as IntegrationChip };
