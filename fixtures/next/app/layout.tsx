import "./globals.css";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-fg">{children}</body>
    </html>
  );
}
