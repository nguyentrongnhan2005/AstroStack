'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Edges, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useScheduleStore, CourseCard, Session } from '@/store/useScheduleStore';
import { LayoutGrid, AlertTriangle, Smartphone, Monitor } from 'lucide-react';

// Bản đồ màu sắc neon sang trọng
const COLOR_MAP: { [key: string]: string } = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  gray: '#6b7280',
};

const EMISSIVE_MAP: { [key: string]: string } = {
  blue: '#1d4ed8',
  emerald: '#047857',
  amber: '#b45309',
  rose: '#be123c',
  violet: '#6d28d9',
  indigo: '#4338ca',
  cyan: '#0e7490',
  gray: '#374151',
};

const BG_COLOR_MAP: { [key: string]: string } = {
  blue: 'bg-blue-950/40 border-blue-500/50 text-blue-300 hover:bg-blue-900/40',
  emerald: 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40',
  amber: 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/40',
  rose: 'bg-rose-950/40 border-rose-500/50 text-rose-300 hover:bg-rose-900/40',
  violet: 'bg-violet-950/40 border-violet-500/50 text-violet-300 hover:bg-violet-900/40',
  indigo: 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/40',
  cyan: 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/40',
};

// ----------------------------------------------------
// Hằng số bàn cờ (dùng chung cho cả GridBoard và FarmDecor)
// ----------------------------------------------------
const GRID_WIDTH = 1.3; // Độ rộng 1 cột (Thứ)
const GRID_HEIGHT = 0.65; // Chiều dài 1 dòng (Tiết)
const COLUMNS = 7; // Thứ 2 đến Thứ 8
const ROWS = 12; // Tiết 1 đến 12

// ----------------------------------------------------
// ----------------------------------------------------
// 0. TRANG TRÍ KHÔNG GIAN HỆ MẶT TRỜI — Tự tạo texture & đường quỹ đạo
// ----------------------------------------------------

// Hàm sinh hoạ tiết (procedural texture) cho từng hành tinh bằng HTML5 Canvas
const generateProceduralTexture = (type: string, baseColor: string) => {
  if (typeof window === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Tô màu nền cơ bản của hành tinh
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 256);

  if (type === 'earth') {
    // Trái Đất: Đại dương xanh lam + Lục địa xanh lá/nâu cát chân thực + Mây xoáy ốc
    ctx.fillStyle = '#0b3c5d';
    ctx.fillRect(0, 0, 512, 256);

    // Vẽ các lục địa răng cưa thô ráp tự nhiên
    ctx.fillStyle = '#1e4620'; // Xanh lá cây lục địa
    ctx.strokeStyle = '#22c55e'; // Bờ biển phát sáng nhẹ
    ctx.lineWidth = 0.5;

    const drawContinent = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let theta = 0; theta < Math.PI * 2; theta += 0.08) {
        // Tăng độ gồ ghề cho bờ biển
        const offset = Math.sin(theta * 7) * (r * 0.28) + Math.cos(theta * 4) * (r * 0.18) + Math.sin(theta * 12) * (r * 0.06);
        const currR = r + offset;
        const px = x + Math.cos(theta) * currR * 2; // Nhân 2 vì chiều rộng canvas 512
        const py = y + Math.sin(theta) * currR;
        if (theta === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Thêm các mảng hoang mạc màu vàng cát ở lõi lục địa
      ctx.fillStyle = '#854d0e';
      ctx.beginPath();
      for (let theta = 0; theta < Math.PI * 2; theta += 0.12) {
        const offset = Math.sin(theta * 5) * (r * 0.15) + Math.cos(theta * 3) * (r * 0.1);
        const currR = (r * 0.4) + offset;
        const px = x + Math.cos(theta) * currR * 2;
        const py = y + Math.sin(theta) * currR;
        if (theta === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e4620'; // Reset màu lục địa
    };

    drawContinent(120, 110, 48); // Mỹ
    drawContinent(290, 95, 55);  // Á-Âu
    drawContinent(320, 160, 40); // Phi
    drawContinent(430, 160, 30); // Úc

    // Vẽ mây trắng mờ cuộn xoáy hình cơn bão
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 18; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 256;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 35 + Math.random() * 35, 6 + Math.random() * 10, Math.random() * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'jupiter') {
    // Sao Mộc: Các dải sọc cuộn xoáy tuyệt đẹp và Đốm Đỏ Lớn
    ctx.fillStyle = '#fed7aa'; // Nền vàng cam sữa sáng
    ctx.fillRect(0, 0, 512, 256);

    const colors = ['#7c2d12', '#c2410c', '#ffedd5', '#9a3412', '#ea580c', '#ca8a04', '#ffedd5', '#ca8a04'];
    for (let y = 16; y < 240; y += 22) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) {
        const wave = Math.sin(x * 0.04 + y) * 7;
        ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(512, y + 18);
      for (let x = 512; x >= 0; x -= 32) {
        const wave = Math.sin(x * 0.04 + y) * 7;
        ctx.lineTo(x, y + 18 + wave);
      }
      ctx.closePath();
      ctx.fill();
    }
    
    // Đốm Đỏ Lớn đặc trưng (Great Red Spot) ở bán cầu Nam
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(340, 150, 32, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Viền trắng cam bao ngoài Đốm Đỏ
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(340, 150, 35, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'saturn') {
    // Sao Thổ: Các dải sọc ngang mịn màng màu cát/kem
    const bands = [
      { y: 30, h: 24, color: '#eab308' },
      { y: 54, h: 20, color: '#ca8a04' },
      { y: 74, h: 12, color: '#fef08a' },
      { y: 86, h: 56, color: '#fef9c3' },
      { y: 142, h: 36, color: '#ca8a04' },
      { y: 178, h: 28, color: '#a16207' },
    ];
    bands.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(0, b.y, 512, b.h);
    });
  } else if (type === 'mars') {
    // Mars: Màu đỏ cam gỉ sắt, mảng tối xám nâu, thung lũng Valles Marineris nứt nẻ
    ctx.fillStyle = '#c2410c'; // Đỏ cam gỉ sắt chính
    ctx.fillRect(0, 0, 512, 256);

    // Vẽ các mảng xám đen basalt tối màu thô ráp ở bán cầu Nam
    ctx.fillStyle = '#450a0a';
    for (let i = 0; i < 15; i++) {
      const cx = Math.random() * 512;
      const cy = 60 + Math.random() * 150;
      const r = 25 + Math.random() * 45;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(47, 8, 8, 0.7)');
      grad.addColorStop(0.6, 'rgba(69, 10, 10, 0.45)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ Thung lũng Valles Marineris nứt nẻ dài ngoằn ngoèo nằm ngang (như ảnh 4)
    ctx.strokeStyle = '#2f0808';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(100, 128);
    // Vẽ ngoằn ngoèo ngang qua xích đạo
    ctx.lineTo(160, 134);
    ctx.lineTo(240, 126);
    ctx.lineTo(320, 138);
    ctx.lineTo(390, 124);
    ctx.stroke();

    // Các nhánh nứt phụ của thung lũng
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(180, 131); ctx.lineTo(200, 148);
    ctx.moveTo(250, 127); ctx.lineTo(275, 110);
    ctx.moveTo(310, 136); ctx.lineTo(340, 155);
    ctx.stroke();

    // Hai chỏm cực trắng tuyết
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 10);
    ctx.fillRect(0, 245, 512, 11);
  } else if (type === 'neptune') {
    // Sao Hải Vương: Vân mây giông mỏng trắng xanh trên nền xanh lam đậm
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, 70, 512, 20);
    ctx.fillRect(0, 150, 512, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(Math.random() * 400, 40 + Math.random() * 170, 60, 3);
    }
  } else if (type === 'mercury') {
    // Mercury: Đá màu xám-xanh có mảng khoáng chất vàng nâu và nhiều hố va chạm phát tia trắng (như ảnh 1)
    ctx.fillStyle = '#2d333f'; // Nền xám xanh đậm
    ctx.fillRect(0, 0, 512, 256);

    // Vẽ các mảng màu vàng cát, xám nhạt và nâu đất lốm đốm bằng bụi hạt ngẫu nhiên
    for (let i = 0; i < 400; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 256;
      const r = 5 + Math.random() * 20;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      let color = 'rgba(181, 164, 137, 0.18)'; // Vàng cát nhạt
      if (Math.random() < 0.4) color = 'rgba(75, 85, 99, 0.25)'; // Xám
      else if (Math.random() < 0.2) color = 'rgba(59, 74, 107, 0.22)'; // Xám xanh dương
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ hố thiên thạch phát tia trắng sáng (Crater Rays) đặc trưng
    for (let i = 0; i < 20; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 256;
      const r = 2 + Math.random() * 4;

      // Vẽ các tia trắng tỏa ra từ hố
      const numRays = 8 + Math.floor(Math.random() * 8);
      for (let j = 0; j < numRays; j++) {
        const angle = (j / numRays) * Math.PI * 2 + Math.random() * 0.2;
        const length = 15 + Math.random() * 50;
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8 + Math.random() * 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
        ctx.stroke();
      }

      // Vẽ lõi hố màu trắng sáng
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Viền hố tối hơn một chút
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (type === 'venus') {
    // Venus: Bầu khí quyển axit vàng cam rực rỡ có các vệt xoáy cuộn mượt mà (như ảnh 2)
    ctx.fillStyle = '#d97706'; // Nền cam ấm
    ctx.fillRect(0, 0, 512, 256);

    // Vẽ các dải sọc uốn lượn mềm mại uốn cong kéo dài bằng nhiều nét vẽ Bezier
    for (let i = 0; i < 40; i++) {
      const startY = Math.random() * 256;
      const endY = startY + (Math.random() - 0.5) * 60;
      const controlY1 = startY + (Math.random() - 0.5) * 80;
      const controlY2 = endY + (Math.random() - 0.5) * 80;

      let color = 'rgba(254, 240, 138, 0.22)'; // Vàng kem sáng
      if (Math.random() < 0.4) color = 'rgba(234, 88, 12, 0.25)'; // Cam gắt
      else if (Math.random() < 0.25) color = 'rgba(253, 186, 116, 0.3)'; // Cam sữa nhạt

      ctx.strokeStyle = color;
      ctx.lineWidth = 10 + Math.random() * 25;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(128, controlY1, 384, controlY2, 512, endY);
      ctx.stroke();
    }
    
    // Thêm các đám mây mờ ảo lốm đốm
    for (let i = 0; i < 15; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 256;
      const r = 30 + Math.random() * 40;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(254, 243, 199, 0.15)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'sun') {
    // Mặt Trời: Plasma lửa cuộn trào bùng cháy
    ctx.fillStyle = '#b91c1c'; // Màu đỏ nền dung nham
    ctx.fillRect(0, 0, 256, 128);
    
    // Vẽ các luồng nhiệt bùng cháy màu cam vàng
    for (let i = 0; i < 30; i++) {
      const cx = Math.random() * 256;
      const cy = Math.random() * 128;
      const r = 25 + Math.random() * 35;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      grad.addColorStop(0, '#fffbeb'); // Trắng vàng cực nóng
      grad.addColorStop(0.2, '#fef08a'); // Vàng rực
      grad.addColorStop(0.5, '#f97316'); // Cam lửa
      grad.addColorStop(0.8, '#dc2626'); // Đỏ lửa
      grad.addColorStop(1, 'rgba(185, 28, 28, 0)'); // Tan biến
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

// Hàm sinh vành đai Sao Thổ (Saturn Ring) sọc đồng tâm Cassini
const generateRingTexture = () => {
  if (typeof window === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Tạo grad sọc từ trong ra ngoài
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.0)');
  grad.addColorStop(0.08, 'rgba(254, 240, 138, 0.45)');
  grad.addColorStop(0.25, 'rgba(202, 138, 4, 0.7)');
  grad.addColorStop(0.38, 'rgba(254, 240, 138, 0.8)');
  grad.addColorStop(0.42, 'rgba(0, 0, 0, 0.15)');
  grad.addColorStop(0.46, 'rgba(254, 240, 138, 0.75)');
  grad.addColorStop(0.72, 'rgba(161, 98, 7, 0.6)');
  grad.addColorStop(0.92, 'rgba(254, 240, 138, 0.3)');
  grad.addColorStop(1.0, 'rgba(254, 240, 138, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 8);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// ---- Hàm sinh tua lửa và cung lửa Mặt Trời (Solar Flare Texture) ----
const generateSolarFlareTexture = () => {
  if (typeof window === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = 256;
  const cy = 256;

  // Vẽ các tia lửa nhọn (spikes) tỏa ra từ tâm
  ctx.clearRect(0, 0, 512, 512);
  
  // Vẽ 180 tia lửa nhọn hoắt có độ dài ngẫu nhiên
  for (let angle = 0; angle < Math.PI * 2; angle += 0.024) {
    const length = 180 + Math.random() * 60; // Tia lửa nhọn dài ngắn ngẫu nhiên
    const grad = ctx.createLinearGradient(
      cx + Math.cos(angle) * 120, cy + Math.sin(angle) * 120,
      cx + Math.cos(angle) * length, cy + Math.sin(angle) * length
    );
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.9)'); // Vàng sáng sát tâm
    grad.addColorStop(0.3, 'rgba(249, 115, 22, 0.7)'); // Cam ở giữa
    grad.addColorStop(0.7, 'rgba(220, 38, 38, 0.3)'); // Đỏ ở rìa
    grad.addColorStop(1, 'rgba(185, 28, 28, 0)'); // Tan biến

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 120, cy + Math.sin(angle) * 120);
    // Vẽ hơi cong nhẹ tạo độ cuộn xoáy
    const controlX = cx + Math.cos(angle + 0.06) * (120 + (length - 120) * 0.5);
    const controlY = cy + Math.sin(angle + 0.06) * (120 + (length - 120) * 0.5);
    const targetX = cx + Math.cos(angle) * length;
    const targetY = cy + Math.sin(angle) * length;
    ctx.quadraticCurveTo(controlX, controlY, targetX, targetY);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};


// ---- Đường quỹ đạo elip bao quanh bàn cờ ----
const OrbitLine: React.FC<{ xRadius: number; zRadius: number; color?: string }> = ({
  xRadius,
  zRadius,
  color = '#334155',
}) => {
  const points = useMemo(() => {
    const pts = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * xRadius, -0.05, Math.sin(theta) * zRadius));
    }
    return pts;
  }, [xRadius, zRadius]);

  return (
    <Line
      points={points as any}
      color={color}
      lineWidth={1.2}
      transparent
      opacity={0.22}
    />
  );
};

// ---- Hệ thống sao lấp lánh (Starfield) ----
const Stars: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 1000;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * 90;
      let y = (Math.random() - 0.5) * 70;
      let z = (Math.random() - 0.5) * 90;

      if (Math.abs(x) < 7 && Math.abs(y) < 3 && Math.abs(z) < 6) {
        x += Math.sign(x || 1) * 7;
        y += Math.sign(y || 1) * 4;
        z += Math.sign(z || 1) * 6;
      }

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const r = 0.75 + Math.random() * 0.25;
      const g = 0.75 + Math.random() * 0.25;
      const b = 0.85 + Math.random() * 0.15;
      cols[i * 3] = r;
      cols[i * 3 + 1] = g;
      cols[i * 3 + 2] = b;
    }
    return [pos, cols];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = t * 0.015;
    pointsRef.current.rotation.z = Math.sin(t * 0.005) * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        sizeAttenuation={true}
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
};

// ---- Hành tinh 3D di chuyển theo quỹ đạo và có vân hoạ tiết ----
// Các đường dẫn texture thực tế chất lượng cao tồn tại 100% trong kho lưu trữ solar-system
const TEXTURE_URLS: { [key: string]: string } = {
  mercury: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/mercurymap.jpg',
  venus: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/venusmap.jpg',
  earth: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/earthmap1k.jpg',
  mars: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/marsmap1k.jpg',
  jupiter: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/jupitermap.jpg',
  saturn: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/saturnmap.jpg',
  uranes: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/uranusmap.jpg',
  neptune: 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/neptunemap.jpg',
};
const MOON_TEXTURE_URL = 'https://raw.githubusercontent.com/KyleGough/solar-system/master/textures/moonmap1k.jpg';
const CLOUDS_TEXTURE_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/earth_clouds_1024.png';

const PLANET_TILTS: { [key: string]: number } = {
  mercury: 0.03, // rad
  venus: 3.09,
  earth: 0.41,   // 23.4 độ
  mars: 0.44,    // 25.2 độ
  jupiter: 0.05,
  saturn: 0.47,  // 26.7 độ
  uranes: 1.70,  // 97.8 độ nghiêng ngang đặc trưng
  neptune: 0.50,
};

interface PlanetProps {
  orbitXRadius: number;
  orbitZRadius: number;
  yCoord: number;
  size: number;
  color: string;
  emissive: string;
  hasRing?: boolean;
  hasVerticalRing?: boolean;
  ringColor?: string;
  speed?: number;
  phaseOffset?: number;
  textureType: 'earth' | 'jupiter' | 'saturn' | 'mars' | 'neptune' | 'mercury' | 'venus' | 'uranes';
}

const Planet: React.FC<PlanetProps> = ({
  orbitXRadius,
  orbitZRadius,
  yCoord,
  size,
  color,
  emissive,
  hasRing = false,
  hasVerticalRing = false,
  ringColor = '#ffffff',
  speed = 0.2,
  phaseOffset = 0,
  textureType,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [moonTexture, setMoonTexture] = useState<THREE.Texture | null>(null);
  const [cloudsTexture, setCloudsTexture] = useState<THREE.Texture | null>(null);

  const tilt = PLANET_TILTS[textureType] || 0;

  // Tải hình ảnh texture từ internet (có cơ chế dự phòng offline/lỗi mạng tự vẽ bằng Canvas)
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const url = TEXTURE_URLS[textureType];
    
    if (url) {
      loader.load(
        url,
        (loadedTexture) => {
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
          setTexture(loadedTexture);
        },
        undefined,
        (err) => {
          console.warn("Failed to load real texture, falling back to procedural:", textureType, err);
          const fallback = generateProceduralTexture(textureType === 'uranes' ? 'neptune' : textureType, color);
          setTexture(fallback);
        }
      );
    } else {
      const fallback = generateProceduralTexture(textureType === 'uranes' ? 'neptune' : textureType, color);
      setTexture(fallback);
    }

    // Tải texture Mặt Trăng & Mây nếu là Trái Đất
    if (textureType === 'earth') {
      loader.load(
        MOON_TEXTURE_URL,
        (loadedMoonTexture) => setMoonTexture(loadedMoonTexture),
        undefined,
        () => console.warn("Failed to load moon texture, using fallback gray color")
      );
      loader.load(
        CLOUDS_TEXTURE_URL,
        (loadedCloudsTexture) => setCloudsTexture(loadedCloudsTexture),
        undefined,
        () => console.warn("Failed to load earth clouds texture")
      );
    }
  }, [textureType, color]);

  // Tạo ring texture cho Sao Thổ
  const ringTexture = useMemo(() => {
    if (hasRing && textureType === 'saturn') {
      return generateRingTexture();
    }
    return null;
  }, [hasRing, textureType]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    // Di chuyển group hành tinh trên quỹ đạo elip
    if (groupRef.current) {
      const angle = t * speed * 0.12 + phaseOffset;
      groupRef.current.position.x = Math.cos(angle) * orbitXRadius;
      groupRef.current.position.z = Math.sin(angle) * orbitZRadius;
      groupRef.current.position.y = yCoord + Math.sin(t * speed * 1.5 + phaseOffset) * 0.15;
    }

    // Chỉ xoay mesh quả cầu hành tinh quanh trục Y nghiêng của nó
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.35;
    }

    // Cho Mặt Trăng quay quanh Trái Đất
    if (moonRef.current) {
      const moonAngle = t * 0.65;
      moonRef.current.position.x = Math.cos(moonAngle) * (size * 1.8);
      moonRef.current.position.z = Math.sin(moonAngle) * (size * 1.8);
      moonRef.current.position.y = Math.sin(t * 1.2) * 0.25;
      moonRef.current.rotation.y = t * 0.1;
    }

    // Cho mây trôi độc lập trên Trái Đất
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = t * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Group nghiêng trục xích đạo (Axial Tilt) - Giúp vành đai và hành tinh nghiêng đồng bộ chuẩn xác */}
      <group rotation={[0, 0, tilt]}>
        
        {/* Thân hành tinh tự quay */}
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[size, 24, 24]} />
          <meshStandardMaterial
            map={texture || undefined}
            color={texture ? undefined : color}
            emissive={emissive}
            emissiveIntensity={0.15}
            roughness={0.65}
            metalness={0.15}
          />
        </mesh>

        {/* Lớp mây trôi 3D của Trái Đất */}
        {textureType === 'earth' && (
          <mesh ref={cloudsRef} scale={[1.015, 1.015, 1.015]} castShadow receiveShadow>
            <sphereGeometry args={[size, 24, 24]} />
            <meshStandardMaterial
              map={cloudsTexture || undefined}
              transparent
              opacity={0.42}
              depthWrite={false}
              roughness={0.9}
            />
          </mesh>
        )}

        {/* Hào quang khí quyển Trái Đất */}
        {textureType === 'earth' && (
          <mesh scale={[1.03, 1.03, 1.03]}>
            <sphereGeometry args={[size, 24, 24]} />
            <meshBasicMaterial
              color="#60a5fa"
              transparent
              opacity={0.15}
              blending={THREE.AdditiveBlending}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Vành đai Sao Thổ (Xoay nằm ngang trên xích đạo nghiêng XZ) */}
        {hasRing && (
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <ringGeometry args={[size * 1.3, size * 2.3, 48]} />
            <meshStandardMaterial
              map={ringTexture || undefined}
              color={ringTexture ? undefined : ringColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.75}
              roughness={0.6}
            />
          </mesh>
        )}

        {/* Vành đai đứng của Sao Thiên Vương (Xoay nằm ngang trên xích đạo nghiêng XZ) */}
        {hasVerticalRing && (
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <ringGeometry args={[size * 1.35, size * 1.9, 32]} />
            <meshStandardMaterial
              color={ringColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.3}
              roughness={0.7}
            />
          </mesh>
        )}
      </group>
    </group>
  );
};

// ---- Mặt Trời (Sun) rực lửa với quầng plasma động và hào quang bùng cháy ----
const Sun: React.FC = () => {
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const flare1Ref = useRef<THREE.Mesh>(null);
  const flare2Ref = useRef<THREE.Mesh>(null);
  const corona1Ref = useRef<THREE.Mesh>(null);
  const corona2Ref = useRef<THREE.Mesh>(null);
  const corona3Ref = useRef<THREE.Mesh>(null);

  const [sunTexture, setSunTexture] = useState<THREE.Texture | null>(null);
  const [flareTexture, setFlareTexture] = useState<THREE.Texture | null>(null);

  // Tải texture dung nham bùng cháy siêu thực tế và tạo texture tua lửa
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/sun.jpg',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.5, 1.5);
        setSunTexture(tex);
      },
      undefined,
      () => {
        console.warn("Failed to load local sun texture, falling back to procedural");
        const fallback = generateProceduralTexture('sun', '#f59e0b');
        setSunTexture(fallback);
      }
    );

    // Sinh texture tia lửa răng cưa
    const fTex = generateSolarFlareTexture();
    setFlareTexture(fTex);
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    // Tự xoay quả cầu Mặt Trời
    if (sunMeshRef.current) {
      sunMeshRef.current.rotation.y = t * 0.025;
      sunMeshRef.current.rotation.x = Math.sin(t * 0.005) * 0.01;
    }

    // Xoay các vành tua lửa để giả lập bão lửa chuyển động không ngừng
    if (flare1Ref.current) {
      flare1Ref.current.rotation.z = t * 0.04;
      flare1Ref.current.scale.setScalar(1.0 + Math.sin(t * 1.5) * 0.015);
    }
    if (flare2Ref.current) {
      flare2Ref.current.rotation.z = -t * 0.03 - 0.5;
      flare2Ref.current.scale.setScalar(1.03 + Math.cos(t * 1.2) * 0.02);
    }

    // Các quầng lửa corona tự co giãn tạo chiều sâu
    if (corona1Ref.current) {
      corona1Ref.current.scale.setScalar(1.08 + Math.sin(t * 1.8) * 0.02);
    }
    if (corona2Ref.current) {
      corona2Ref.current.scale.setScalar(1.24 + Math.cos(t * 1.4) * 0.03);
    }
    if (corona3Ref.current) {
      corona3Ref.current.scale.setScalar(1.42 + Math.sin(t * 0.9) * 0.05);
    }
  });

  return (
    <group position={[-26, 7, -24]}>
      {/* 1. Quả cầu Mặt Trời chính với lớp phát sáng tự thân cực mạnh (chói loà như thật) */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[4.5, 32, 32]} />
        <meshStandardMaterial
          map={sunTexture || undefined}
          color="#ffffff"
          emissive="#f97316" // Đỏ cam rực lửa
          emissiveMap={sunTexture || undefined}
          emissiveIntensity={3.2} // Đèn phát sáng cực mạnh chói lọi giống ảnh mẫu
          roughness={0.2}
        />
      </mesh>

      {/* 2. Vành tua lửa và bão lửa 1 (Quay hướng thẳng về phía camera) */}
      <mesh ref={flare1Ref}>
        <ringGeometry args={[4.2, 8.5, 64]} />
        <meshBasicMaterial
          map={flareTexture || undefined}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Vành tua lửa và bão lửa 2 (Xoay ngược chiều và nghiêng nhẹ tạo chiều sâu 3D) */}
      <mesh ref={flare2Ref} rotation={[0.1, 0.1, 0.5]}>
        <ringGeometry args={[4.2, 9.2, 64]} />
        <meshBasicMaterial
          map={flareTexture || undefined}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Quầng lửa 1: Cam đỏ bùng cháy sát bề mặt */}
      <mesh ref={corona1Ref}>
        <sphereGeometry args={[4.5, 24, 24]} />
        <meshBasicMaterial
          color="#ea580c"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 5. Quầng lửa 2: Vàng chói lọi bùng tỏa vừa */}
      <mesh ref={corona2Ref}>
        <sphereGeometry args={[4.5, 24, 24]} />
        <meshBasicMaterial
          color="#fef08a"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 6. Quầng lửa 3: Trắng vàng hào quang tỏa rộng xa */}
      <mesh ref={corona3Ref}>
        <sphereGeometry args={[4.5, 24, 24]} />
        <meshBasicMaterial
          color="#fffbeb"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ---- Phi thuyền 3D (Spaceship) đại diện cho tiến trình của người dùng ----
const Spaceship: React.FC<{ level: number }> = ({ level }) => {
  const shipRef = useRef<THREE.Group>(null);
  const speed = 0.25 + level * 0.04; // Cấp độ càng cao bay càng nhanh
  const size = 0.24 + level * 0.024; // Cấp độ càng cao tàu càng to

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (shipRef.current) {
      // Bay theo quỹ đạo tròn lệch elip quanh bảng TKB ở khoảng cách vừa phải (bán kính x=7.5, z=6.5)
      const angle = t * speed * 0.25;
      shipRef.current.position.x = Math.cos(angle) * 8.2;
      shipRef.current.position.z = Math.sin(angle) * 7.2;
      shipRef.current.position.y = 1.8 + Math.sin(t * 2.0) * 0.22; // Độ phập phồng nhẹ

      // Xoay đầu phi thuyền hướng về phía trước theo chiều bay
      shipRef.current.rotation.y = -angle + Math.PI / 2;
      shipRef.current.rotation.z = Math.sin(t * 2.2) * 0.08; // Nghiêng lắc nhẹ
    }
  });

  // Chọn màu phi thuyền theo cấp độ
  const shipColor = level >= 5 ? '#f43f5e' : (level >= 3 ? '#a855f7' : '#06b6d4');

  return (
    <group ref={shipRef}>
      {/* Thân phi thuyền chính - Hình chóp nhọn hướng bay */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[size * 0.5, size * 1.8, 4]} />
        <meshStandardMaterial color={shipColor} roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Cánh trái */}
      <mesh position={[-size * 0.48, -size * 0.2, -size * 0.15]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[size * 0.5, size * 0.08, size * 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* Cánh phải */}
      <mesh position={[size * 0.48, -size * 0.2, -size * 0.15]} rotation={[0, -0.25, 0]}>
        <boxGeometry args={[size * 0.5, size * 0.08, size * 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* Đuôi lửa phản lực phát sáng */}
      <mesh position={[0, -size * 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[size * 0.2, size * 0.5, 8]} />
        <meshBasicMaterial color="#ff7700" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

// ---- Phi thuyền 3D Co-Op đại diện cho các bạn cùng phòng ----
const CoopSpaceship: React.FC<{ color: string; index: number; name: string }> = ({ color, index, name }) => {
  const shipRef = useRef<THREE.Group>(null);
  const speed = 0.20 + index * 0.03;
  const radiusX = 8.4 + index * 0.4;
  const radiusZ = 7.4 + index * 0.4;
  const heightOffset = 1.9 + index * 0.2;
  const size = 0.22;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (shipRef.current) {
      const angle = t * speed * 0.25 + index * (Math.PI / 3);
      shipRef.current.position.x = Math.cos(angle) * radiusX;
      shipRef.current.position.z = Math.sin(angle) * radiusZ;
      shipRef.current.position.y = heightOffset + Math.sin(t * 1.5 + index) * 0.15;

      shipRef.current.rotation.y = -angle + Math.PI / 2;
      shipRef.current.rotation.z = Math.sin(t * 2.0 + index) * 0.05;
    }
  });

  return (
    <group ref={shipRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[size * 0.5, size * 1.8, 4]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[-size * 0.48, -size * 0.2, -size * 0.15]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[size * 0.5, size * 0.08, size * 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[size * 0.48, -size * 0.2, -size * 0.15]} rotation={[0, -0.25, 0]}>
        <boxGeometry args={[size * 0.5, size * 0.08, size * 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[0, -size * 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[size * 0.2, size * 0.5, 8]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.15}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </group>
  );
};

// ---- Toàn bộ trang trí Không gian Vũ trụ ----
interface SpaceDecorProps {
  level?: number;
}

const SpaceDecor: React.FC<SpaceDecorProps> = ({ level = 1 }) => {
  const HALF_W = (COLUMNS * GRID_WIDTH) / 2;
  const HALF_H = (ROWS * GRID_HEIGHT) / 2;

  const activeLobbyId = useScheduleStore((state) => state.activeLobbyId);
  const lobbyMembers = useScheduleStore((state) => state.lobbyMembers);
  const coopActive = useScheduleStore((state) => state.coopActive);
  
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('cardtkb_user_id') : null;
  const otherMembers = coopActive ? lobbyMembers.filter(m => m.userId !== currentUserId) : [];

  return (
    <group>
      {/* Không còn mesh phẳng đục chắn bên dưới để bàn cờ lơ lửng trong vũ trụ 3D hoàn toàn */}

      {/* Hiệu ứng hào quang/kính hologram neon ngay bên dưới bàn cờ - cho phép nhìn xuyên qua */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[COLUMNS * GRID_WIDTH + 2.2, ROWS * GRID_HEIGHT + 2.2]} />
        <meshPhysicalMaterial
          color="#060b1e"
          emissive="#0c1a40"
          emissiveIntensity={0.8}
          roughness={0.25}
          metalness={0.9}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Starfield */}
      <Stars />

      {/* Mặt Trời (Sun) rực lửa với quầng plasma động */}
      <Sun />

      {/* Phi thuyền 3D di chuyển theo cấp độ phi hành gia */}
      <Spaceship level={level} />

      {/* Phi thuyền của bạn học cùng phòng Co-Op */}
      {coopActive && otherMembers.map((m, idx) => (
        <CoopSpaceship 
          key={m.id} 
          color={m.color} 
          index={idx} 
          name={m.username} 
        />
      ))}

      {/* Ánh sáng song song chiếu tỏa từ Mặt Trời đi khắp không gian, không bị suy giảm theo khoảng cách */}
      <directionalLight
        position={[-26, 7, -24]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />

      {/* Vẽ đầy đủ 8 đường quỹ đạo elip của 8 hành tinh quanh trung tâm bàn cờ (đã nới rộng để không chạm bàn cờ) */}
      <OrbitLine xRadius={11.0} zRadius={9.0} />
      <OrbitLine xRadius={13.5} zRadius={11.0} />
      <OrbitLine xRadius={16.0} zRadius={13.0} />
      <OrbitLine xRadius={18.5} zRadius={15.0} />
      <OrbitLine xRadius={21.5} zRadius={17.5} />
      <OrbitLine xRadius={25.0} zRadius={20.5} />
      <OrbitLine xRadius={28.5} zRadius={23.5} />
      <OrbitLine xRadius={32.5} zRadius={27.0} />

      {/* ĐẦY ĐỦ 8 HÀNH TINH TRONG HỆ MẶT TRỜI XOAY QUANH BÀN CỜ */}
      {/* 1. Sao Thủy (Mercury): Nhỏ nhất, màu đá xám đen, quỹ đạo trong cùng */}
      <Planet
        orbitXRadius={11.0}
        orbitZRadius={9.0}
        yCoord={-0.05}
        size={0.45}
        color="#6b7280"
        emissive="#374151"
        speed={0.45}
        phaseOffset={0.0}
        textureType="mercury"
      />
      {/* 2. Sao Kim (Venus): Màu vàng kem axit nhạt, sọc ngang mờ */}
      <Planet
        orbitXRadius={13.5}
        orbitZRadius={11.0}
        yCoord={-0.05}
        size={0.85}
        color="#fbbf24"
        emissive="#b45309"
        speed={0.36}
        phaseOffset={1.5}
        textureType="venus"
      />
      {/* 3. Trái Đất (Earth): Đại dương lam đậm + Lục địa bờ biển răng cưa + Mây trắng */}
      <Planet
        orbitXRadius={16.0}
        orbitZRadius={13.0}
        yCoord={-0.05}
        size={1.0}
        color="#1d4ed8"
        emissive="#1e40af"
        speed={0.28}
        phaseOffset={2.8}
        textureType="earth"
      />
      {/* 4. Sao Hỏa (Mars): Đỏ cam gỉ sắt, nhỏ nhắn lấp ló */}
      <Planet
        orbitXRadius={18.5}
        orbitZRadius={15.0}
        yCoord={-0.05}
        size={0.65}
        color="#dc2626"
        emissive="#7f1d1d"
        speed={0.22}
        phaseOffset={4.0}
        textureType="mars"
      />
      {/* 5. Sao Mộc (Jupiter): Lớn nhất, các dải sọc uốn lượn uốn lượn có Đốm Đỏ lớn */}
      <Planet
        orbitXRadius={21.5}
        orbitZRadius={17.5}
        yCoord={-0.05}
        size={1.9}
        color="#d97706"
        emissive="#78350f"
        speed={0.15}
        phaseOffset={0.8}
        textureType="jupiter"
      />
      {/* 6. Sao Thổ (Saturn): Có vành đai lớn sọc Cassini đặc trưng, màu cát */}
      <Planet
        orbitXRadius={25.0}
        orbitZRadius={20.5}
        yCoord={-0.05}
        size={1.3}
        color="#fbbf24"
        emissive="#b45309"
        hasRing={true}
        ringColor="#fef08a"
        speed={0.1}
        phaseOffset={2.2}
        textureType="saturn"
      />
      {/* 7. Sao Thiên Vương (Uranus): Màu xanh lam ngọc nhạt có vành đai đứng mỏng dọc */}
      <Planet
        orbitXRadius={28.5}
        orbitZRadius={23.5}
        yCoord={-0.05}
        size={1.1}
        color="#a5f3fc"
        emissive="#0891b2"
        hasVerticalRing={true}
        ringColor="#22d3ee"
        speed={0.07}
        phaseOffset={3.5}
        textureType="uranes"
      />
      {/* 8. Sao Hải Vương (Neptune): Xanh dương sọc mây trắng, nằm cực sâu phía xa */}
      <Planet
        orbitXRadius={32.5}
        orbitZRadius={27.0}
        yCoord={-0.05}
        size={1.05}
        color="#1e3b8a"
        emissive="#172554"
        speed={0.04}
        phaseOffset={5.0}
        textureType="neptune"
      />
    </group>
  );
};

// ----------------------------------------------------
// 1. GridBoard: Vẽ lưới 3D bàn cờ thời khóa biểu
// ----------------------------------------------------

const GridBoard: React.FC = () => {
  const gridLines = useMemo(() => {
    const lines = [];
    const totalWidth = COLUMNS * GRID_WIDTH;
    const totalHeight = ROWS * GRID_HEIGHT;

    // Đường dọc phân chia các thứ
    for (let i = 0; i <= COLUMNS; i++) {
      const x = -totalWidth / 2 + i * GRID_WIDTH;
      lines.push(
        <Line
          key={`v-${i}`}
          points={[[x, 0.001, -totalHeight / 2], [x, 0.001, totalHeight / 2]]}
          color="#334155"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      );
    }

    // Đường ngang phân chia các tiết
    for (let i = 0; i <= ROWS; i++) {
      const z = -totalHeight / 2 + i * GRID_HEIGHT;
      lines.push(
        <Line
          key={`h-${i}`}
          points={[[-totalWidth / 2, 0.001, z], [totalWidth / 2, 0.001, z]]}
          color="#334155"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      );
    }

    return lines;
  }, []);

  return (
    <group>
      {/* Mặt bàn cờ gỗ/kính tối mờ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[COLUMNS * GRID_WIDTH + 0.4, ROWS * GRID_HEIGHT + 0.4]} />
        <meshPhysicalMaterial
          color="#0f172a"
          roughness={0.4}
          metalness={0.8}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* Lưới phân chia */}
      {gridLines}

      {/* Tên các Thứ (Headers) */}
      {Array.from({ length: COLUMNS }).map((_, i) => {
        const x = -(COLUMNS * GRID_WIDTH) / 2 + (i + 0.5) * GRID_WIDTH;
        const dayLabel = i === 6 ? 'Chủ Nhật' : `Thứ ${i + 2}`;
        return (
          <Text
            key={`header-${i}`}
            position={[x, 0.02, -(ROWS * GRID_HEIGHT) / 2 - 0.3]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.13}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            {dayLabel}
          </Text>
        );
      })}

      {/* Số Tiết học bên trái (Row Headers) */}
      {Array.from({ length: ROWS }).map((_, i) => {
        const z = -(ROWS * GRID_HEIGHT) / 2 + (i + 0.5) * GRID_HEIGHT;
        return (
          <Text
            key={`row-header-${i}`}
            position={[-(COLUMNS * GRID_WIDTH) / 2 - 0.4, 0.02, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.12}
            color="#64748b"
            anchorX="right"
            anchorY="middle"
          >
            {`Tiết ${i + 1}`}
          </Text>
        );
      })}
    </group>
  );
};

// ----------------------------------------------------
// 2. Card3D: Đối tượng Thẻ bài 3D trên bàn cờ
// ----------------------------------------------------
interface Card3DProps {
  card: CourseCard;
  session: Session;
  isPlaced: boolean;
  isDragging: boolean;
  onDragStart: (e: any) => void;
  onSelect: () => void;
}

const Card3D: React.FC<Card3DProps> = ({
  card,
  session,
  isPlaced,
  isDragging,
  onDragStart,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const getConflicts = useScheduleStore((state) => state.getConflicts);
  
  // Kiểm tra xem thẻ này có bị xung đột trong phiên bản hiện tại
  const conflicts = getConflicts(card.id, true);
  const hasConflict = isPlaced && conflicts.length > 0;
  const isLocked = useScheduleStore((state) => 
    state.placedCards.find((p) => p.courseCardId === card.id)?.locked || false
  );

  // Tính toán tọa độ đích dựa trên Thứ và Tiết học
  const targetPos = useMemo(() => {
    const colIndex = session.dayOfWeek - 2; // 2 -> 0, 8 -> 6
    const totalWidth = COLUMNS * GRID_WIDTH;
    const totalHeight = ROWS * GRID_HEIGHT;

    // Tọa độ X (cột)
    const x = -totalWidth / 2 + (colIndex + 0.5) * GRID_WIDTH;

    // Tọa độ Z (dòng)
    const duration = session.endPeriod - session.startPeriod + 1;
    const zStart = -totalHeight / 2 + (session.startPeriod - 1) * GRID_HEIGHT;
    const zEnd = zStart + duration * GRID_HEIGHT;
    const z = (zStart + zEnd) / 2;

    // Tọa độ Y (độ cao): Nếu đang drag thì nhấc cao lên, nếu đặt rồi thì sát mặt lưới, trong kho thì nằm ngoài
    const y = isPlaced ? 0.05 : -0.5;

    // Chiều dài thẻ (dọc theo trục Z)
    const cardLength = duration * GRID_HEIGHT - 0.08;

    return { x, y, z, length: cardLength };
  }, [session, isPlaced]);

  // Cập nhật vị trí mượt mà (Lerp) & Hiệu ứng Rung lắc (Hearthstone shake) khi xung đột
  useFrame((state) => {
    if (!meshRef.current) return;

    if (isDragging) return;

    // Lerp vị trí
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetPos.x, 0.15);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetPos.z, 0.15);
    
    let targetY = targetPos.y;
    if (hovered && !isDragging) {
      targetY += 0.15; // Nhấc nhẹ lên khi hover
    }
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.15);

    // Lerp góc xoay (Tilt effect khi hover)
    let targetRotX = 0;
    let targetRotY = 0;
    let targetRotZ = 0;

    if (hovered && !isDragging) {
      const pointer = state.pointer;
      targetRotZ = -pointer.x * 0.1;
      targetRotX = pointer.y * 0.1;
    }

    // Hiệu ứng rung lắc (Shake) nếu bị trùng lịch
    if (hasConflict) {
      const shakeAmt = 0.012;
      const freq = 35;
      meshRef.current.position.x += Math.sin(state.clock.elapsedTime * freq) * shakeAmt;
      meshRef.current.position.z += Math.cos(state.clock.elapsedTime * freq) * shakeAmt;
      targetRotY = Math.sin(state.clock.elapsedTime * freq * 0.5) * 0.04;
    }

    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.1);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotZ, 0.1);
  });

  const cardColor = hasConflict ? '#ef4444' : COLOR_MAP[card.colorRamp] || COLOR_MAP.blue;
  const emissiveColor = hasConflict ? '#7f1d1d' : EMISSIVE_MAP[card.colorRamp] || EMISSIVE_MAP.blue;

  return (
    <group
      ref={meshRef}
      position={[targetPos.x, -1, targetPos.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (isLocked) return;
        onDragStart(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[GRID_WIDTH - 0.1, 0.06, targetPos.length]} />
        <meshPhysicalMaterial
          color={cardColor}
          emissive={hovered ? emissiveColor : '#000000'}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.5}
          transmission={0.4}
          thickness={0.1}
          transparent
          opacity={isDragging ? 0.6 : 0.95}
        />
        <Edges
          threshold={15}
          color={hasConflict ? '#f87171' : hovered ? '#ffffff' : cardColor}
          lineWidth={hovered || hasConflict ? 2.5 : 1}
        />
      </mesh>

      <group position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text
          position={[0, targetPos.length / 2 - 0.12, 0]}
          fontSize={0.075}
          color="#ffffff"
          maxWidth={GRID_WIDTH - 0.2}
          textAlign="center"
          anchorX="center"
          anchorY="top"
        >
          {card.subjectName.length > 20 ? `${card.subjectName.substring(0, 18)}...` : card.subjectName}
        </Text>

        <Text
          position={[0, -targetPos.length / 2 + 0.12, 0]}
          fontSize={0.065}
          color="#cbd5e1"
          anchorX="center"
          anchorY="bottom"
        >
          {`${card.classCode} | ${session.room || 'TBA'}`}
        </Text>

        <Text
          position={[GRID_WIDTH / 2 - 0.15, targetPos.length / 2 - 0.08, 0]}
          fontSize={0.045}
          color={session.sessionType === 'lab' ? '#fda4af' : '#93c5fd'}
          anchorX="right"
          anchorY="top"
        >
          {session.sessionType === 'lab' ? 'TH' : 'LT'}
        </Text>

        {isLocked && (
          <Text
            position={[-(GRID_WIDTH / 2 - 0.12), targetPos.length / 2 - 0.08, 0]}
            fontSize={0.06}
            color="#e2e8f0"
            anchorX="left"
            anchorY="top"
          >
            🔒
          </Text>
        )}
      </group>
    </group>
  );
};

// ----------------------------------------------------
// 3. Scene: Nơi raycast điều khiển kéo thả thẻ bài
// ----------------------------------------------------
const FreeSlotGlow: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (matRef.current) {
      matRef.current.opacity = 0.12 + Math.sin(t * 3.5) * 0.08;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, z]}>
      <planeGeometry args={[GRID_WIDTH - 0.05, GRID_HEIGHT - 0.05]} />
      <meshBasicMaterial
        ref={matRef}
        color="#10b981"
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
      <Edges color="#34d399" threshold={15} />
    </mesh>
  );
};

// ---- Khối hộp 3D biểu diễn ca bận của bạn cùng phòng Co-Op ----
interface CoopSessionBoxProps {
  card: CourseCard & { coopMemberColor?: string; coopMemberUsername?: string };
  session: Session;
}

const CoopSessionBox: React.FC<CoopSessionBoxProps> = ({ card, session }) => {
  const meshRef = useRef<THREE.Group>(null);
  const color = card.coopMemberColor || '#10b981';
  const name = card.coopMemberUsername || 'Bạn học';

  const targetPos = useMemo(() => {
    const colIndex = session.dayOfWeek - 2;
    const totalWidth = COLUMNS * GRID_WIDTH;
    const totalHeight = ROWS * GRID_HEIGHT;

    const x = -totalWidth / 2 + (colIndex + 0.5) * GRID_WIDTH;
    const duration = session.endPeriod - session.startPeriod + 1;
    const zStart = -totalHeight / 2 + (session.startPeriod - 1) * GRID_HEIGHT;
    const zEnd = zStart + duration * GRID_HEIGHT;
    const z = (zStart + zEnd) / 2;
    const length = duration * GRID_HEIGHT - 0.06;

    return { x, z, length };
  }, [session]);

  return (
    <group position={[targetPos.x, 0.02, targetPos.z]} ref={meshRef}>
      <mesh>
        <boxGeometry args={[GRID_WIDTH - 0.06, 0.06, targetPos.length]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.8}
          metalness={0.1}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      <Edges scale={1.0} threshold={15}>
        <lineBasicMaterial color={color} toneMapped={false} linewidth={1.5} />
      </Edges>

      <Text
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.095}
        color="#ffffff"
        maxWidth={GRID_WIDTH - 0.15}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {`${card.subjectCode}\n(${name})`}
      </Text>
    </group>
  );
};

// ---- Hiệu ứng Cổng Không Gian (Wormholes/Space Gates) rảnh chung của nhóm ----
const WormholeSlotGlow: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      const scale = 1.0 + Math.sin(t * 3.5) * 0.05;
      meshRef.current.scale.set(scale, scale, 1);
      meshRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <group position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef}>
        <ringGeometry args={[GRID_HEIGHT * 0.22, GRID_HEIGHT * 0.28, 32]} />
        <meshBasicMaterial 
          color="#10b981" 
          transparent 
          opacity={0.7} 
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh>
        <circleGeometry args={[GRID_HEIGHT * 0.2, 32]} />
        <meshBasicMaterial 
          color="#10b981" 
          transparent 
          opacity={0.2} 
          blending={THREE.AdditiveBlending} 
          side={THREE.DoubleSide}
        />
      </mesh>

      <Text
        position={[0, 0, 0.01]}
        rotation={[0, 0, 0]}
        fontSize={0.13}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        🌀
      </Text>
    </group>
  );
};

interface SceneProps {
  onSelectCard: (card: CourseCard) => void;
  compareCourseCards?: CourseCard[];
  level?: number;
}

const Scene: React.FC<SceneProps> = ({ onSelectCard, compareCourseCards, level = 1 }) => {
  const { camera, raycaster, pointer } = useThree();
  const courseCards = useScheduleStore((state) => state.courseCards);
  const placedCards = useScheduleStore((state) => state.placedCards);
  const placeCard = useScheduleStore((state) => state.placeCard);
  const removePlacedCard = useScheduleStore((state) => state.removePlacedCard);

  // Co-Op Store states
  const coopCourseCards = useScheduleStore((state) => state.coopCourseCards);
  const lobbyMembers = useScheduleStore((state) => state.lobbyMembers);
  const coopActive = useScheduleStore((state) => state.coopActive);

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<THREE.Vector3>(new THREE.Vector3());
  const dragPlaneRef = useRef<THREE.Mesh>(null);

  // Tính toán cổng không gian rảnh chung cho nhóm Co-Op
  const coopFreeSlots = useMemo(() => {
    if (!coopActive || lobbyMembers.length <= 1) return [];

    const grid: boolean[][] = Array.from({ length: 9 }, () => Array(13).fill(true));

    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((s) => {
          for (let p = s.startPeriod; p <= s.endPeriod; p++) {
            grid[s.dayOfWeek][p] = false;
          }
        });
      }
    });

    coopCourseCards.forEach((card) => {
      card.sessions.forEach((s) => {
        for (let p = s.startPeriod; p <= s.endPeriod; p++) {
          if (s.dayOfWeek >= 2 && s.dayOfWeek <= 8 && p >= 1 && p <= 12) {
            grid[s.dayOfWeek][p] = false;
          }
        }
      });
    });

    const freeSlots: { dayOfWeek: number; period: number }[] = [];
    for (let d = 2; d <= 8; d++) {
      for (let p = 1; p <= 12; p++) {
        if (grid[d][p]) {
          freeSlots.push({ dayOfWeek: d, period: p });
        }
      }
    }
    return freeSlots;
  }, [placedCards, courseCards, coopCourseCards, coopActive, lobbyMembers]);

  const mutualFreePeriods = useMemo(() => {
    if (!compareCourseCards || compareCourseCards.length === 0) return [];
    
    const grid: boolean[][] = Array.from({ length: 9 }, () => Array(13).fill(true));

    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((s) => {
          for (let p = s.startPeriod; p <= s.endPeriod; p++) {
            grid[s.dayOfWeek][p] = false;
          }
        });
      }
    });

    compareCourseCards.forEach((card) => {
      card.sessions.forEach((s) => {
        for (let p = s.startPeriod; p <= s.endPeriod; p++) {
          grid[s.dayOfWeek][p] = false;
        }
      });
    });

    const freeSlots: { dayOfWeek: number; period: number }[] = [];
    for (let d = 2; d <= 8; d++) {
      for (let p = 1; p <= 12; p++) {
        if (grid[d][p]) {
          freeSlots.push({ dayOfWeek: d, period: p });
        }
      }
    }
    return freeSlots;
  }, [placedCards, courseCards, compareCourseCards]);

  const boardSessions = useMemo(() => {
    const list: { card: CourseCard; session: Session; isPlaced: boolean }[] = [];
    
    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((sess) => {
          list.push({ card, session: sess, isPlaced: true });
        });
      }
    });

    if (draggedCardId) {
      const isAlreadyOnBoard = placedCards.some((p) => p.courseCardId === draggedCardId);
      if (!isAlreadyOnBoard) {
        const card = courseCards.find((c) => c.id === draggedCardId);
        if (card) {
          card.sessions.forEach((sess) => {
            list.push({ card, session: sess, isPlaced: false });
          });
        }
      }
    }

    return list;
  }, [placedCards, courseCards, draggedCardId]);

  const handleDragStart = (e: any, cardId: string) => {
    e.stopPropagation();
    (document.body.style as any).cursor = 'grabbing';
    setDraggedCardId(cardId);

    if (e.point) {
      const targetGroup = e.currentTarget as THREE.Group;
      const offset = new THREE.Vector3().copy(targetGroup.position).sub(e.point);
      offset.y = 0.3;
      setDragOffset(offset);
    }
  };

  const handlePointerUp = () => {
    if (!draggedCardId) return;
    (document.body.style as any).cursor = 'auto';

    raycaster.setFromCamera(pointer, camera);
    if (dragPlaneRef.current) {
      const intersects = raycaster.intersectObject(dragPlaneRef.current);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        
        const totalWidth = COLUMNS * GRID_WIDTH;
        const totalHeight = ROWS * GRID_HEIGHT;
        
        const inBoundX = pt.x >= -totalWidth / 2 - 0.5 && pt.x <= totalWidth / 2 + 0.5;
        const inBoundZ = pt.z >= -totalHeight / 2 - 0.5 && pt.z <= totalHeight / 2 + 0.5;

        if (inBoundX && inBoundZ) {
          placeCard(draggedCardId);
        } else {
          removePlacedCard(draggedCardId);
        }
      }
    }

    setDraggedCardId(null);
  };

  return (
    <group onPointerUp={handlePointerUp}>
      <mesh
        ref={dragPlaneRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        visible={false}
      >
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial color="red" />
      </mesh>

      <SpaceDecor level={level} />

      <GridBoard />

      {/* Hiển thị các ô trống phát sáng khi so sánh lịch 3D */}
      {mutualFreePeriods.map(({ dayOfWeek, period }) => {
        const cIdx = dayOfWeek - 2;
        const rIdx = period - 1;
        const totalWidth = COLUMNS * GRID_WIDTH;
        const totalHeight = ROWS * GRID_HEIGHT;
        const x = -totalWidth / 2 + (cIdx + 0.5) * GRID_WIDTH;
        const z = -totalHeight / 2 + (rIdx + 0.5) * GRID_HEIGHT;

        return (
          <FreeSlotGlow 
            key={`free-${dayOfWeek}-${period}`} 
            x={x} 
            z={z} 
          />
        );
      })}

      {/* Hiển thị ca bận của bạn học Co-Op */}
      {coopActive && coopCourseCards.map((card) => 
        card.sessions.map((session) => (
          <CoopSessionBox 
            key={`${card.id}-${session.id}`} 
            card={card} 
            session={session} 
          />
        ))
      )}

      {/* Hiển thị Cổng Không Gian rảnh chung cho nhóm Co-Op */}
      {coopActive && coopFreeSlots.map(({ dayOfWeek, period }) => {
        const cIdx = dayOfWeek - 2;
        const rIdx = period - 1;
        const totalWidth = COLUMNS * GRID_WIDTH;
        const totalHeight = ROWS * GRID_HEIGHT;
        const x = -totalWidth / 2 + (cIdx + 0.5) * GRID_WIDTH;
        const z = -totalHeight / 2 + (rIdx + 0.5) * GRID_HEIGHT;

        return (
          <WormholeSlotGlow 
            key={`coop-free-${dayOfWeek}-${period}`} 
            x={x} 
            z={z} 
          />
        );
      })}

      {boardSessions.map(({ card, session, isPlaced }) => (
        <Card3D
          key={`${session.id}-${isPlaced ? 'placed' : 'preview'}`}
          card={card}
          session={session}
          isPlaced={isPlaced}
          isDragging={draggedCardId === card.id}
          onDragStart={(e) => handleDragStart(e, card.id)}
          onSelect={() => onSelectCard(card)}
        />
      ))}
    </group>
  );
};

// ----------------------------------------------------
// 4. Main Component: CardBoard3D (Hỗ trợ Fallback 2D)
// ----------------------------------------------------
const CameraController: React.FC<{ target: [number, number, number] | null }> = ({ target }) => {
  const { camera, controls } = useThree();
  useFrame(() => {
    if (target && controls) {
      const [tx, ty, tz] = target;
      const ctrl = controls as any;
      
      // Lerp OrbitControls target
      ctrl.target.x = THREE.MathUtils.lerp(ctrl.target.x, tx, 0.08);
      ctrl.target.y = THREE.MathUtils.lerp(ctrl.target.y, ty, 0.08);
      ctrl.target.z = THREE.MathUtils.lerp(ctrl.target.z, tz, 0.08);

      // Lerp camera position
      const destX = tx;
      const destY = ty + 3.6;
      const destZ = tz + 3.6;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, destX, 0.08);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, destY, 0.08);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, destZ, 0.08);
      
      ctrl.update();
    }
  });
  return null;
};

interface CardBoard3DProps {
  onSelectCard: (card: CourseCard) => void;
  compareCourseCards?: CourseCard[];
  level?: number;
  cameraTarget?: [number, number, number] | null;
}

export const CardBoard3D: React.FC<CardBoard3DProps> = ({ onSelectCard, compareCourseCards, level = 1, cameraTarget = null }) => {
  const [renderMode, setRenderMode] = useState<'3D' | '2D'>('3D');
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  
  const courseCards = useScheduleStore((state) => state.courseCards);
  const placedCards = useScheduleStore((state) => state.placedCards);
  const placeCard = useScheduleStore((state) => state.placeCard);
  const removePlacedCard = useScheduleStore((state) => state.removePlacedCard);
  const getConflicts = useScheduleStore((state) => state.getConflicts);

  const mutualFreePeriods2D = useMemo(() => {
    if (!compareCourseCards || compareCourseCards.length === 0) return [];
    
    const grid: boolean[][] = Array.from({ length: 9 }, () => Array(13).fill(true));

    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((s) => {
          for (let p = s.startPeriod; p <= s.endPeriod; p++) {
            grid[s.dayOfWeek][p] = false;
          }
        });
      }
    });

    compareCourseCards.forEach((card) => {
      card.sessions.forEach((s) => {
        for (let p = s.startPeriod; p <= s.endPeriod; p++) {
          grid[s.dayOfWeek][p] = false;
        }
      });
    });

    const freeSlots: { dayOfWeek: number; period: number }[] = [];
    for (let d = 2; d <= 8; d++) {
      for (let p = 1; p <= 12; p++) {
        if (grid[d][p]) {
          freeSlots.push({ dayOfWeek: d, period: p });
        }
      }
    }
    return freeSlots;
  }, [placedCards, courseCards, compareCourseCards]);

  // 1. Kiểm tra WebGL & Kích thước màn hình (Responsive)
  useEffect(() => {
    // Check WebGL
    let available = true;
    try {
      const canvas = document.createElement('canvas');
      const isAvailable = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
      available = isAvailable;
    } catch (e) {
      available = false;
    }
    
    setWebGLAvailable(available);

    // Mặc định chuyển sang 2D nếu là mobile hoặc không hỗ trợ WebGL
    const isMobile = window.innerWidth < 768;
    if (isMobile || !available) {
      setRenderMode('2D');
    }
  }, []);

  // 2. Thu thập danh sách ca học đã xếp trên bàn cờ phục vụ render 2D
  const placedSessions2D = useMemo(() => {
    const list: { card: CourseCard; session: Session; hasConflict: boolean; isLocked: boolean }[] = [];
    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        const conflicts = getConflicts(card.id, true);
        const hasConflict = conflicts.length > 0;
        card.sessions.forEach((sess) => {
          list.push({ 
            card, 
            session: sess, 
            hasConflict,
            isLocked: placed.locked 
          });
        });
      }
    });
    return list;
  }, [placedCards, courseCards]);

  return (
    <div className="w-full h-full relative bg-[#090d16] rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      
      {/* THANH ĐIỀU KHIỂN CHUYỂN CHẾ ĐỘ RENDER (2D vs 3D) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/80">
        <button
          onClick={() => {
            if (!webGLAvailable) {
              alert('Thiết bị của bạn không hỗ trợ hoặc đã tắt WebGL. Không thể chạy chế độ 3D.');
              return;
            }
            setRenderMode('3D');
          }}
          className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
            renderMode === '3D'
              ? 'bg-cyan-600 text-slate-900 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Monitor className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          3D BOARD
        </button>
        <button
          onClick={() => setRenderMode('2D')}
          className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
            renderMode === '2D'
              ? 'bg-cyan-600 text-slate-900 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <LayoutGrid className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          2D GRID
        </button>
      </div>

      {/* Hướng dẫn thao tác nhanh */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700 pointer-events-none text-xs text-slate-300 max-w-[240px] opacity-90 hidden md:block">
        <p className="font-semibold text-cyan-400 mb-1">🎮 GAME CONTROLS:</p>
        <ul className="list-disc list-inside space-y-0.5 opacity-90 text-[10px]">
          {renderMode === '3D' ? (
            <>
              <li>Kéo thẻ bài thả vào bàn cờ để kích hoạt</li>
              <li>Kéo ra ngoài biên để thu hồi thẻ</li>
              <li>Chuột phải + Kéo để xoay bàn cờ</li>
              <li>Cuộn chuột để zoom</li>
            </>
          ) : (
            <>
              <li>Các môn được tự động xếp vào lưới</li>
              <li>Click thẻ để xem chi tiết / Thu hồi</li>
              <li>Tự động tối ưu và co giãn theo tiết</li>
            </>
          )}
        </ul>
      </div>

      {/* ====================================================
          RENDER MODE 3D: WebGL Canvas
          ==================================================== */}
      {renderMode === '3D' && webGLAvailable ? (
        <div className="w-full h-full flex-1">
          <Canvas
            shadows
            gl={{ preserveDrawingBuffer: true }}
            camera={{ position: [0, 8, 8], fov: 42 } as any}
            className="w-full h-full"
            onCreated={({ gl }) => {
              gl.setClearColor('#030712');
            }}
          >
            <ambientLight intensity={0.04} />
            <directionalLight
              position={[0, 15, 0]}
              intensity={0.12}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0001}
            />
            <pointLight position={[-5, -2, -5]} intensity={0.05} color="#06b6d4" />

            <Scene onSelectCard={onSelectCard} compareCourseCards={compareCourseCards} level={level} />

            <CameraController target={cameraTarget} />

            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              maxPolarAngle={Math.PI / 2.2}
              minDistance={4}
              maxDistance={15}
              enablePan={true}
            />
          </Canvas>
        </div>
      ) : (
        /* ====================================================
            RENDER MODE 2D: Grid HTML/CSS (Dự phòng cho mobile/lỗi WebGL)
            ==================================================== */
        <div className="w-full h-full flex-1 p-2 sm:p-4 md:p-6 pt-14 md:pt-16 flex flex-col overflow-y-auto overflow-x-auto">
          {!webGLAvailable && (
            <div className="mb-4 p-2 bg-amber-950/40 border border-amber-900/50 rounded-lg flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Thiết bị của bạn không hỗ trợ WebGL hoặc trình duyệt đã tắt Tăng tốc phần cứng. Hệ thống tự động chuyển sang chế độ 2D Grid mượt mà.</span>
            </div>
          )}

          {/* Lưới Thời khóa biểu 2D */}
          <div className="flex-1 min-w-[700px] border border-slate-800 bg-[#090d16] rounded-xl flex flex-col overflow-hidden">
            {/* Header: Thứ */}
            <div className="grid grid-cols-8 border-b border-slate-800 bg-[#0c1221] text-xs font-bold text-slate-400 text-center py-2 shrink-0">
              <div className="border-r border-slate-800 py-1">Ca học</div>
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((day, idx) => (
                <div key={idx} className="py-1">{day}</div>
              ))}
            </div>

            {/* Body: 12 tiết học */}
            <div className="flex-1 grid grid-cols-8 grid-rows-12 relative text-slate-300">
              
              {/* Cột tiêu đề tiết dọc bên trái */}
              {Array.from({ length: 12 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className="border-r border-b border-slate-850 bg-[#0c1221]/50 text-[10px] text-slate-500 font-bold flex flex-col items-center justify-center py-1"
                  style={{ gridColumn: 1, gridRow: idx + 1 }}
                >
                  <div>Tiết {idx + 1}</div>
                  <div className="text-[8px] opacity-75 mt-0.5">
                    {idx === 0 ? '7:00' : idx === 4 ? '10:40' : idx === 5 ? '13:00' : ''}
                  </div>
                </div>
              ))}

              {/* Lưới ô trống phía sau */}
              {Array.from({ length: 12 }).map((_, rIdx) => {
                const period = rIdx + 1;
                return Array.from({ length: 7 }).map((_, cIdx) => {
                  const dayOfWeek = cIdx + 2;
                  const isFreeCommon = compareCourseCards && compareCourseCards.length > 0 && 
                    mutualFreePeriods2D.some(s => s.dayOfWeek === dayOfWeek && s.period === period);

                  return (
                    <div 
                      key={`${rIdx}-${cIdx}`}
                      className={`border-r border-b border-slate-850/30 transition-colors duration-500 flex items-center justify-center ${
                        isFreeCommon ? 'bg-emerald-500/10 border-emerald-500/20' : ''
                      }`}
                      style={{ gridColumn: cIdx + 2, gridRow: rIdx + 1 }}
                    >
                      {isFreeCommon && (
                        <span className="text-[7px] text-emerald-500/50 font-black select-none">
                          TRỐNG CHUNG
                        </span>
                      )}
                    </div>
                  );
                });
              })}

              {/* Render các thẻ môn học đặt đè lên Grid */}
              {placedSessions2D.map(({ card, session, hasConflict, isLocked }) => {
                const startRow = session.startPeriod;
                const endRow = session.endPeriod + 1; // grid-row kết thúc là độc quyền
                const colIdx = session.dayOfWeek - 2 + 2; // Cột 1 là RowHeader, cột 2 là Thứ 2
                
                const bgStyles = BG_COLOR_MAP[card.colorRamp] || BG_COLOR_MAP.blue;

                return (
                  <div
                    key={`${session.id}-2d`}
                    onClick={() => onSelectCard(card)}
                    style={{ 
                      gridColumn: colIdx, 
                      gridRow: `${startRow} / ${endRow}` 
                    }}
                    className={`m-1 p-2 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between overflow-hidden shadow-lg select-none ${bgStyles} ${
                      hasConflict ? 'border-red-500/80 bg-red-950/40 text-red-300 shake-effect' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-black text-[9px] uppercase tracking-wider bg-slate-950/80 px-1 rounded">
                          {card.subjectCode}
                        </span>
                        {isLocked && <span className="text-[10px]">🔒</span>}
                      </div>
                      <h4 className="font-bold text-[10px] mt-1 leading-tight line-clamp-2">
                        {card.subjectName}
                      </h4>
                    </div>
                    
                    <div className="mt-1 flex justify-between items-center text-[9px] opacity-90">
                      <span className="truncate">🏢 {session.room || 'TBA'}</span>
                      <span className="font-black shrink-0 px-1 bg-slate-950/40 rounded">
                        {session.sessionType === 'lab' ? 'TH' : 'LT'}
                      </span>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CardBoard3D;
