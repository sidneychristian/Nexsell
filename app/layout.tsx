import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "NexSell — Next Generation Sales",
  description: "CRM, automação e vendas no WhatsApp para empresas que querem crescer.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "NexSell — Next Generation Sales",
    description: "CRM, automação e vendas no WhatsApp para empresas que querem crescer.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ">
      <body className="antialiased">{children}</body>
    </html>
  );
}
