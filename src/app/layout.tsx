import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DEPREM-AI — Otonom Kurtarma Lojistiği Platformu",
  description:
    "Deprem sonrası yapısal hasar tespiti ve otonom kurtarma ekibi koordinasyonu. CV → GNN → MARL uçtan uca AI pipeline. SDG 11.5 | Hacettepe AI Club Ideathon 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-gray-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
