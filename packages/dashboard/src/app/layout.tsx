import type { Metadata } from "next";
import "./globals.css";
import { fontDisplay, fontSans } from "./fonts";

const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
const appUrl =
  appUrlRaw && appUrlRaw.length > 0 ? appUrlRaw : "https://desk.rekov.co";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Desk",
  description: "Asistente conversacional con tus documentos y tus datos conectados",
  icons: {
    icon: [{ url: "/brand/desk-mark-white.jpg", type: "image/jpeg" }],
    apple: [{ url: "/brand/desk-icon-app.jpg", type: "image/jpeg" }],
  },
  openGraph: {
    title: "Desk — atención al cliente con IA",
    description:
      "Atiende clientes con tus documentos y sistemas conectados. Tu equipo entra cuando hace falta.",
    images: [{ url: "/brand/desk-logo-dark.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
