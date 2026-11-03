import { Baloo_2, Doto } from "next/font/google";

// Doto: dot-matrix LED face for the platform indicator board.
export const ledFont = Doto({ subsets: ["latin"], weight: ["800", "900"], variable: "--font-doto" });

// Baloo 2: chunky display face with Devanagari, for station boards, captions and the phone UI.
export const displayFont = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});
