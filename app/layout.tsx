import type { Metadata } from "next";
import { Mona_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/*
  One variable Mona Sans file carries every weight AND width the product
  uses: body/UI text at its normal width, headings and big numbers
  semi-expanded (see --font-stretch-display in globals.css). Only the latin
  subset is preloaded.

  (Archivo was trialled first for the same width axis and rejected: its
  stylised ampersand reads as a "6", and trade business names are full of
  them — "K & J Carpentry", "Plumbing & Gas".)
*/
const sans = Mona_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mona",
  display: "swap",
});

/* Reference data only — ABNs, dates in tables, file names. Two weights. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Subbies",
    template: "%s · Subbies",
  },
  description:
    "Collect, review, and track contractor compliance documents without chasing paperwork.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
