import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SF Street Cleaning Reminder",
  description: "Get SMS reminders before street cleaning in San Francisco's Marina district",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
