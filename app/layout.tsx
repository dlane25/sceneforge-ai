import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SceneForge AI",
  description: "AI-native production studio for creating serialized vertical microdramas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-stone-950 text-stone-100">{children}</body>
    </html>
  );
}
