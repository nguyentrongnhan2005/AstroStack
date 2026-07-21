import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CardTKB — Web quản lý thời khóa biểu 3D dạng game bài chiến thuật",
  description: "Xếp lịch học như chơi bài chiến thuật 3D dành cho sinh viên IT. Tự động nhập lịch học từ ảnh chụp OCR hoặc văn bản thô, tối ưu hóa xếp lịch tự động không bị trùng giờ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
