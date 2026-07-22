'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useScheduleStore } from '@/store/useScheduleStore';

// ---- Nền 3D: Mặt trời tỏa sáng rực rỡ trong không gian ----
const Sun: React.FC = () => {
  const sunTexture = useMemo(() => {
    if (typeof window === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ea580c';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 120 + 40;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#b91c1c';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 80 + 30;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 50 + 20;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  return (
    <group>
      <mesh position={[0, 0, -2]}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshStandardMaterial
          map={sunTexture}
          emissive="#f97316"
          emissiveIntensity={2.5}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
};

export default function LoginClient() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLoginSuccess = (data: any) => {
    useScheduleStore.getState().clearAllData();
    localStorage.removeItem('cardtkb_has_been_used');
    
    localStorage.setItem('cardtkb_token', data.token);
    localStorage.setItem('cardtkb_user_id', data.user.id);
    localStorage.setItem('cardtkb_email', data.user.email);
    localStorage.setItem('cardtkb_semester_id', data.user.semesterId);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cardtkb_logged_in_this_session', 'true');
      const searchParams = new URLSearchParams(window.location.search);
      const room = searchParams.get('room');
      if (room) {
        router.push(`/?room=${room}`);
        return;
      }
    }
    router.push('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    if (isRegister && password.length < 6) {
      setErrorMessage('Mật khẩu phải chứa tối thiểu 6 ký tự.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login-manual';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        handleLoginSuccess(data);
      } else {
        setErrorMessage(data.error || 'Thao tác thất bại.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Lỗi kết nối server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020617] text-white flex items-center justify-center font-sans">
      
      {/* BACKGROUND 3D VŨ TRỤ */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
          <ambientLight intensity={0.2} />
          <pointLight position={[0, 0, 0]} intensity={3.5} distance={25} color="#ff9900" />
          <pointLight position={[5, 5, 5]} intensity={1.2} color="#f59e0b" />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1.5} />
          <Sun />
        </Canvas>
      </div>

      {/* OVERLAY TỐI TẬP TRUNG */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/80 z-5 pointer-events-none" />

      {/* FORM ĐĂNG NHẬP / ĐĂNG KÝ GLASSMORPHISM */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-[#0b1329]/75 backdrop-blur-xl border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center">
        
        {/* LOGO BIỂU TƯỢNG VŨ TRỤ */}
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-3xl text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
          🛸
        </div>

        <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 tracking-wider mb-1 uppercase">
          {isRegister ? 'TẠO TÀI KHOẢN MỚI' : 'ĐĂNG NHẬP ASTROSTACK'}
        </h2>
        <p className="text-gray-400 text-xs mb-6 text-center font-medium">
          {isRegister ? 'Đăng ký hệ thống thời khóa biểu 3D Không gian' : 'Nhập Email và Mật khẩu để bắt đầu học tập'}
        </p>

        {/* THÔNG BÁO LỖI */}
        {errorMessage && (
          <div className="w-full p-3 mb-4 bg-red-950/70 border border-red-500/40 text-red-300 text-xs rounded-xl text-center font-semibold">
            {errorMessage}
          </div>
        )}

        {/* FORM NHẬP EMAIL VÀ PASSWORD */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">EMAIL TÀI KHOẢN</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhan@astrostack.edu.vn"
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400/80 text-sm transition-all text-white placeholder-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">MẬT KHẨU</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400/80 text-sm transition-all text-white placeholder-slate-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:from-cyan-700 active:to-indigo-700 text-sm font-black tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center text-white cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              isRegister ? '🚀 TẠO TÀI KHOẢN' : '🚀 ĐĂNG NHẬP HỆ THỐNG'
            )}
          </button>
        </form>

        {/* NÚT ĐỔI QUA ĐĂNG KÝ / ĐĂNG NHẬP */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMessage('');
            }}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition-all cursor-pointer"
          >
            {isRegister ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký tại đây'}
          </button>
        </div>

      </div>
    </div>
  );
}
