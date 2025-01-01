import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Navigation } from "./components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Audio Processing App",
  description: "Process and summarize audio files with Google Drive integration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientLayout>
          <div className="min-h-screen flex flex-col">
            <header className="">
              <div className="px-4 mt-2 h-16 ">
                <Navigation />
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ClientLayout>
      </body>
    </html>
  );
}
