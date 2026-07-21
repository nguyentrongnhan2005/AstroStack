'use client';

import dynamic from 'next/dynamic';

// Thực hiện dynamic import component LoginClient với tùy chọn ssr: false
// Điều này ngăn Next.js chạy thử thư viện face-api.js ở Server-side lúc build, sửa triệt để lỗi TextEncoder.
const LoginClient = dynamic(() => import('@/components/LoginClient'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-sans">
      <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-400 text-sm tracking-widest animate-pulse font-bold">ĐANG KHỞI ĐỘNG HỆ THỐNG FACE ID...</p>
    </div>
  ),
});

export default function LoginPage() {
  return <LoginClient />;
}
