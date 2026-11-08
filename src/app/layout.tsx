import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "Workpaper · Okafor-Lindqvist 2025", description: "A tax workpaper as a traceable graph of claims." };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme','dark');}catch(e){}` }} />
      </head>
      <body className="min-h-full">{children}<Toaster position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-geist-sans)", fontSize: 13 } }} /></body>
    </html>
  );
}
