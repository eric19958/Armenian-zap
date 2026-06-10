import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Inch Ka — Compare prices in Armenia",
  description:
    "Inch Ka (ի՞նչ կա) compares electronics and home appliance prices across Armenian stores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jakarta.className}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
