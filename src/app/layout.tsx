import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lieferblitz 3D",
  description: "Liefere Essen durch die Stadt und kauf dir schnellere Fahrzeuge!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
