import { Figtree, Newsreader } from "next/font/google";

export const fontSans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const fontDisplay = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
