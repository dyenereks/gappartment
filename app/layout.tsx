import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAppartment — Bill Sharing",
  description: "Apartment bill and expense sharing made easy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="min-h-full bg-cream-100 text-charcoal-500 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
