"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useNativeInventory } from "@/lib/use-native-inventory";

const PAGE_SIZE = 25;

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  promo_label: string | null;
  currency: string;
  image_url: string | null;
  stock_qty: number | null;
  status: string;
  allows_additions: number;
  category: string | null;
  featured: number;
};

function pesosToInput(cents: number): string {
  return String(Math.round(cents / 100));
}

function inputToCents(raw: string): number | null {
  const n = Math.round(Number(raw.replace(",", ".")) * 100);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatCop(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString("es-CO")} ${currency}`;
}

export default function ProductsPage() {
  const { refresh: refreshInventory } = useNativeInventory();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [allowsAdditions, setAllowsAdditions] = useState(false);
  const [category, setCategory] = useState("");
  const [featured, setFeatured] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, listSearch]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    const d = await api<{
      products: Product[];
      total: number;
      page: number;
    }>(`/v1/admin/products?page=${page}&limit=${PAGE_SIZE}`);
    setProducts(d.products);
    setTotal(d.total);
  }, [page]);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Error al cargar"),
    );
  }, [load]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setCompareAt("");
    setPromoLabel("");
    setImageUrl("");
    setImagePreview(null);
    setStockQty("");
    setAllowsAdditions(false);
    setCategory("");
    setFeatured(false);
    setEditingId(null);
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await api<{ imageUrl: string }>("/v1/admin/products/upload-image", {
        method: "POST",
        body: fd,
      });
      setImageUrl(res.imageUrl);
      setImagePreview(res.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setPrice(pesosToInput(p.price_cents));
    setCompareAt(
      p.compare_at_price_cents != null ? pesosToInput(p.compare_at_price_cents) : "",
    );
    setPromoLabel(p.promo_label ?? "");
    setImageUrl(p.image_url ?? "");
    setImagePreview(p.image_url);
    setStockQty(p.stock_qty != null ? String(p.stock_qty) : "");
    setAllowsAdditions(Number(p.allows_additions) === 1);
    setCategory(p.category ?? "");
    setFeatured(Number(p.featured) === 1);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = inputToCents(price);
    if (!name.trim() || priceCents == null) return;
    const compareAtCents = compareAt.trim() ? inputToCents(compareAt) : null;
    if (compareAt.trim() && compareAtCents == null) return;
    const stock =
      stockQty.trim() === "" ? null : Math.max(0, Math.floor(Number(stockQty)));

    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      priceCents,
      compareAtPriceCents: compareAtCents,
      promoLabel: promoLabel.trim() || null,
      imageUrl: imageUrl.trim() || "",
      stockQty: stock,
      allowsAdditions,
      category: category.trim() || null,
      featured,
      currency: "COP",
      status: "published" as const,
    };
    try {
      if (editingId) {
        await api(`/v1/admin/products/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/v1/admin/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      resetForm();
      await load();
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(p: Product) {
    setBusy(true);
    try {
      await api(`/v1/admin/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: p.status === "published" ? "draft" : "published",
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center gap-3">
        <h1 className="shrink-0 text-xl font-semibold">Catálogo</h1>
        <p className="hidden shrink-0 text-xs text-[var(--muted)] sm:block">
          {total} producto{total === 1 ? "" : "s"}
          {total > PAGE_SIZE ? ` · ${page}/${pageCount}` : ""}
        </p>
        <div className="relative ml-auto w-full min-w-0 max-w-[280px] sm:max-w-xs md:max-w-sm">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Buscar productos"
            aria-label="Buscar productos"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--foreground)]/30"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] md:items-start md:gap-6 lg:gap-8">
        <aside className="lg:sticky lg:top-4">
          <form
            onSubmit={(e) => void saveProduct(e)}
            className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
          >
            <p className="text-sm font-medium">
              {editingId ? "Editar producto" : "Nuevo producto"}
            </p>
            <input
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="min-h-[72px] w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                placeholder="Precio venta (ej. 49900)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <input
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                placeholder="Precio antes (opcional)"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
              />
            </div>
            <input
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Etiqueta promo (ej. -20%)"
              value={promoLabel}
              onChange={(e) => setPromoLabel(e.target.value)}
            />
            <div className="space-y-2">
              <label className="block text-xs text-[var(--muted)]">Imagen</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={busy}
                className="block w-full text-sm"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
              {(imagePreview || imageUrl) && (
                <img
                  src={imagePreview || imageUrl}
                  alt=""
                  className="h-20 w-20 rounded object-cover border border-[var(--border)]"
                />
              )}
            </div>
            <input
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Stock (vacío = sin límite)"
              inputMode="numeric"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Categoría (opcional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              <span className="font-medium">Destacado en chat</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowsAdditions}
                onChange={(e) => setAllowsAdditions(e.target.checked)}
              />
              <span className="font-medium">Personalizable (adiciones)</span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editingId ? "Guardar" : "Publicar"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetForm}
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
          {error ? (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </aside>

        <section className="min-w-0">
          {filteredProducts.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              {listSearch.trim()
                ? "Ningún producto coincide."
                : "Aún no hay productos."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className={[
                    "flex flex-col overflow-hidden rounded-md border bg-[var(--card)] text-[13px] shadow-sm transition",
                    editingId === p.id
                      ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full bg-[var(--muted-bg)]" />
                  )}
                  <div className="flex flex-1 flex-col p-2">
                    <div className="flex items-start justify-between gap-1">
                      <p className="line-clamp-2 text-xs font-medium leading-snug">
                        {p.name}
                      </p>
                      <span
                        className={[
                          "shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase",
                          p.status === "published"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-[var(--muted-bg)] text-[var(--muted)]",
                        ].join(" ")}
                      >
                        {p.status === "published" ? "Pub." : "Oculto"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold tabular-nums">
                      {formatCop(p.price_cents, p.currency)}
                    </p>
                    {p.stock_qty != null ? (
                      <p className="text-[10px] text-[var(--muted)]">
                        Stock {p.stock_qty}
                      </p>
                    ) : null}
                    {p.category || Number(p.featured) === 1 ? (
                      <p className="text-[10px] text-[var(--muted)]">
                        {[p.category, Number(p.featured) === 1 ? "Destacado" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-auto flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(p)}
                        className="text-[11px] font-medium text-[var(--primary)]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void togglePublish(p)}
                        className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        {p.status === "published" ? "Ocultar" : "Publicar"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={busy || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-[var(--border)] px-3 py-1 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--muted)]">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                disabled={busy || page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-[var(--border)] px-3 py-1 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
