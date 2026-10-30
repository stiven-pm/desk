import type { Metadata } from "next";
import "./globals.css";
import { fontOps } from "./fonts";

export const metadata: Metadata = {
  title: "Desk Ops",
  description: "Desk platform administration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={fontOps.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
