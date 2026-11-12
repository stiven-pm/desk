import type { MetadataRoute } from "next";

const BASE = "https://desk.rekov.co";

const paths = [
  "",
  "/pricing",
  "/plataforma",
  "/preguntas",
  "/legal",
  "/legal/disponibilidad",
  "/legal/dpa",
  "/legal/cookies",
  "/legal/dmca",
  "/privacidad",
  "/privacy",
  "/terminos",
  "/terms",
  "/register",
  "/login",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: path.startsWith("/legal") || path.includes("privacidad") || path.includes("terminos") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path === "/preguntas" ? 0.9 : 0.7,
  }));
}
