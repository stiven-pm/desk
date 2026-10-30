import { IBM_Plex_Sans } from "next/font/google";

export const fontOps = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ops",
  display: "swap",
});
