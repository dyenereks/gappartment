import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "gAPPartment — Bill Sharing",
  description: "Apartment bill and expense sharing made easy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inline blocking script — sets the data-theme attribute BEFORE first paint
  // so users don't see a flash of the wrong theme on hard refresh. Reads
  // localStorage first, falls back to OS preference.
  const themeInitScript = `
    try {
      var stored = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = stored === 'dark' || (!stored && prefersDark);
      // Dark theme only on logged-in pages; auth / pre-auth pages are always light
      var isAuthPage = /^\/(sign-in|sign-up|setup-profile)/.test(window.location.pathname);
      document.documentElement.setAttribute('data-theme', (isDark && !isAuthPage) ? 'dark' : 'light');
    } catch (_) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  `;

  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <html lang="en" suppressHydrationWarning>
          <head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
              rel="stylesheet"
            />
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          </head>
          <body>{children}</body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
