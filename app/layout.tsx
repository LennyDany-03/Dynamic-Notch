import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/lib/site";
import ParallaxBackground from "@/components/site/ParallaxBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "dynamic notch",
    "dynamic island for windows",
    "windows 11 notch",
    "desktop overlay",
    "clipboard manager",
    "app launcher",
    "quick notes",
    "notification centre",
    "system monitor",
    "multi monitor",
    "Tauri",
    "Crest",
  ],
  authors: [{ name: site.author, url: site.authorUrl }],
  creator: site.author,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ParallaxBackground />
        {children}
      </body>
    </html>
  );
}
