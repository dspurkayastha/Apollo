import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Source_Serif_4, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { PWAProvider } from "@/components/providers/pwa-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apollo — AI-Powered Thesis Generation",
  description:
    "Generate publication-ready medical postgraduate theses with AI assistance, structured workflows, and university-compliant formatting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en-GB" suppressHydrationWarning>
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#2F2F2F" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
        </head>
        <body
          className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} font-sans antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <PostHogProvider>
              <PWAProvider>
                {children}
              </PWAProvider>
            </PostHogProvider>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
