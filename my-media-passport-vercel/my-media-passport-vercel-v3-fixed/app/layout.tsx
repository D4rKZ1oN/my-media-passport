import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "My Media Passport",
  description: "Tu pasaporte personal de anime, películas y series.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-512.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Media Passport", statusBarStyle: "black-translucent" }
};
export const viewport: Viewport = { themeColor: "#020806", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
