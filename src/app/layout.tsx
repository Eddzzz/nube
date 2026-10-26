import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from "react";
import { Navbar, ThemeProvider } from "@/shared/ui";
import { currentUser } from "@/lib/authToken";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDict } from "@/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OneDriveList - Repositorio Colaborativo",
  description: "Tus archivos compartidos con sincronización y control de versiones",
};

const themeScript = `(function() {
  try {
    var stored = localStorage.getItem('theme');
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var isDark = stored === 'dark' || (!stored && darkQuery.matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser().catch(() => null);
  const { locale, dict } = await getDict();
  const isAdmin = user?.role === "admin";
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 min-h-screen flex flex-col relative`}
      >
        {/* Ambient liquid light orbs for real glass refraction */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-emerald-500/12 dark:bg-emerald-600/15 blur-[140px] transform-gpu" />
          <div className="absolute top-1/4 -right-40 w-[36rem] h-[36rem] rounded-full bg-teal-500/10 dark:bg-teal-600/14 blur-[160px] transform-gpu" />
          <div className="absolute -bottom-40 left-1/3 w-[34rem] h-[34rem] rounded-full bg-emerald-400/8 dark:bg-emerald-500/8 blur-[150px] transform-gpu" />
          <div className="absolute top-2/3 left-10 w-[24rem] h-[24rem] rounded-full bg-teal-400/6 dark:bg-teal-600/8 blur-[130px] transform-gpu" />
        </div>
        <ThemeProvider>
          <I18nProvider locale={locale} dict={dict}>
            {user && <Navbar role={user.role} name={user.name} />}
            <main className={`flex-1 ${isAdmin ? "md:pl-[96px]" : ""}`}>{children}</main>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
