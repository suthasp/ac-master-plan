import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AC Master Plan",
  description: "Air Conditioning Installation Master Plan & Actual Plan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#0d0d1a]">{children}</body>
    </html>
  );
}
