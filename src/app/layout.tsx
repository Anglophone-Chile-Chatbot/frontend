import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { SiteHeader } from "@/components/archive/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anglophone Chile Archive",
  description:
    "A searchable, citation-traceable archive of 1800s Chilean newspapers, with an AI research assistant.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom — a reader examining a scan needs it.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes writes the class here; without this React warns on hydration.
      suppressHydrationWarning
      className={`${playfairDisplay.variable} ${inter.variable} h-full antialiased`}
    >
      {/* `grain` lays the newsprint texture over the whole viewport.
          `h-dvh` + `overflow-hidden` make the shell own scrolling, so the
          composer stays put when a mobile keyboard opens. */}
      <body className="grain flex h-dvh flex-col overflow-hidden font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <SiteHeader />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
