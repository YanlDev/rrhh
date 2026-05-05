import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Asistencia ZKBio",
  description: "Sistema de análisis de asistencia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
