import type { Metadata } from "next";
import { Bangers, Comic_Neue } from "next/font/google";
import "./globals.css";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const comicNeue = Comic_Neue({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://celeb.chinesepowered.com"),
  title: "Celeb Fighter — Celebrity Brawl",
  description:
    "A street-fighter style parody brawl. Pick your celeb, unleash their signature special move, and create + share custom fighters.",
  openGraph: {
    title: "Celeb Fighter — Celebrity Brawl",
    description:
      "A street-fighter style parody brawl. Pick your celeb, unleash their signature special move, and create + share custom fighters.",
    type: "website",
    siteName: "Celeb Fighter",
  },
  twitter: {
    card: "summary_large_image",
    title: "Celeb Fighter — Celebrity Brawl",
    description:
      "A street-fighter style parody brawl. Pick your celeb, unleash their signature special move, and create + share custom fighters.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bangers.variable} ${comicNeue.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
