import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Vàng Bạc Ngọc Trâm - Quản lý cửa hàng",
  description:
    "Hệ thống quản lý bán hàng, kho và thuế GTGT cho cửa hàng vàng bạc đá quý",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen bg-background`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
