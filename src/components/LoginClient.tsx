'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { loadFaceApiModels, faceapi } from '@/lib/faceapi';
import { useScheduleStore } from '@/store/useScheduleStore';

// ---- Nền 3D: Mặt trời tỏa sáng rực rỡ trong không gian ----
const Sun: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const raysRef = useRef<THREE.Mesh>(null);

  // Tạo texture một lần duy nhất tránh re-render sinh lại texture
  const sunTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Nền màu vàng tươi
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vẽ các mảng magma loang lổ lớn màu cam sẫm
    ctx.fillStyle = '#ea580c';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 120 + 40;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ các mảng magma loang lổ màu đỏ sẫm để tăng tương phản giống ảnh
    ctx.fillStyle = '#b91c1c';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 80 + 30;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ các điểm nhấn màu vàng nhạt và trắng rực rỡ tạo các vùng lóa nhiệt
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

  const raysTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    const cx = 256;
    const cy = 256;

    ctx.clearRect(0, 0, 512, 512);

    // Vẽ 450 tia sáng từ tâm phóng ra ngoài
    for (let angle = 0; angle < 360; angle += 0.8) {
      const rad = (angle * Math.PI) / 180;
      
      // Phân chia tia dài phóng xa và tia ngắn dày hơn
      const isLongRay = Math.random() > 0.85;
      const length = isLongRay ? (Math.random() * 180 + 120) : (Math.random() * 90 + 40);
      const opacity = isLongRay ? (Math.random() * 0.45 + 0.2) : (Math.random() * 0.75 + 0.25);

      let color = '#f97316'; // cam mặc định
      const rand = Math.random();
      if (isLongRay) {
        color = rand > 0.5 ? '#dc2626' : '#ea580c'; // tia dài màu đỏ hoặc cam đậm
      } else {
        color = rand > 0.6 ? '#ffffff' : (rand > 0.2 ? '#facc15' : '#ea580c'); // tia ngắn màu trắng, vàng, cam
      }

      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = isLongRay ? (Math.random() * 1.5 + 0.5) : (Math.random() * 3.2 + 1.2);

      ctx.beginPath();
      const startX = cx + Math.cos(rad) * 85;
      const startY = cy + Math.sin(rad) * 85;
      const endX = cx + Math.cos(rad) * (85 + length);
      const endY = cy + Math.sin(rad) * (85 + length);

      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;

    // Quầng sáng mượt ở trung tâm
    const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 130);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(254, 240, 138, 0.9)'); // vàng
    grad.addColorStop(0.6, 'rgba(249, 115, 22, 0.5)'); // cam
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.04;
      meshRef.current.rotation.x = Math.sin(t * 0.02) * 0.01;
    }
    if (raysRef.current) {
      raysRef.current.rotation.z = -t * 0.04;
      // Nhấp nháy nhẹ kích thước tia sáng tạo cảm giác lửa cuộn trào
      const s = 1 + Math.sin(t * 2.5) * 0.015;
      raysRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Tia sáng hướng tâm (Rays Backdrop) */}
      <Billboard>
        <mesh ref={raysRef}>
          <planeGeometry args={[7.2, 7.2]} />
          <meshBasicMaterial
            map={raysTexture}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>

      {/* 2. Quả cầu Mặt trời chính (Sun Sphere) */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshBasicMaterial
          map={sunTexture}
        />
      </mesh>

      {/* 3. Vòng tròn mờ đục 1 (Inner Ring Glow) - y hệt ảnh người dùng */}
      <Billboard>
        <mesh>
          <ringGeometry args={[2.22, 2.7, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>

      {/* 4. Vòng tròn mờ đục 2 (Outer Ring Glow) - y hệt ảnh người dùng */}
      <Billboard>
        <mesh>
          <ringGeometry args={[2.22, 3.2, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
};

export default function LoginClient() {
  const router = useRouter();
  const [isFaceMode, setIsFaceMode] = useState<boolean>(true);
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [registerFaceStep, setRegisterFaceStep] = useState<'scan' | 'password'>('scan');
  const [tempFaceDescriptor, setTempFaceDescriptor] = useState<number[] | null>(null);
  
  // Các trường form thủ công
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // Trạng thái AI & Web-camera
  const [isAiLoaded, setIsAiLoaded] = useState<boolean>(false);
  const [aiLoadError, setAiLoadError] = useState<string>('');
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // 1. Tải các model AI của Face-API khi vào trang
  useEffect(() => {
    setStatusMessage('Đang khởi động hệ thống AI nhận diện khuôn mặt...');
    loadFaceApiModels()
      .then((success) => {
        if (success) {
          setIsAiLoaded(true);
          setStatusMessage('');
        } else {
          setAiLoadError('Không thể tải các mô hình AI. Vui lòng tải lại trang.');
        }
      })
      .catch((err) => {
        console.error(err);
        setAiLoadError('Đã xảy ra lỗi khi tải mô hình AI.');
      });

    return () => {
      stopWebcam();
    };
  }, []);

  // 2. Quản lý việc bật/tắt Webcam dựa trên chế độ Đăng nhập khuôn mặt
  useEffect(() => {
    if (isAiLoaded && isFaceMode && (!isRegister || registerFaceStep === 'scan')) {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [isAiLoaded, isFaceMode, isRegister, registerFaceStep]);

  const startWebcam = async () => {
    stopWebcam();
    setErrorMessage('');
    setStatusMessage('Đang kết nối Camera...');

    // Kiểm tra môi trường bảo mật (Secure Context) do trình duyệt khóa camera trên HTTP không phải localhost
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const port = typeof window !== 'undefined' ? window.location.port : '3001';
      setErrorMessage(`Trình duyệt khóa Camera trên kết nối HTTP không bảo mật. Vui lòng truy cập đúng địa chỉ http://localhost:${port} (hoặc HTTPS) để cấp quyền camera hoặc dùng Đăng nhập thủ công.`);
      setWebcamActive(false);
      setStatusMessage('');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamActive(true);
        setStatusMessage('Đang phân tích cấu trúc khuôn mặt...');
        
        // Khởi động vòng lặp phát hiện khuôn mặt thời gian thực
        startFaceDetection();
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setErrorMessage('Không thể truy cập camera. Vui lòng cấp quyền hoặc sử dụng đăng nhập thủ công.');
      setWebcamActive(false);
      setStatusMessage('');
    }
  };

  const stopWebcam = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  // 3. Vòng lặp quét khuôn mặt thời gian thực và vẽ 68 điểm landmarks (Khóa async tránh lag di động)
  const startFaceDetection = () => {
    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);

    detectIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !isAiLoaded || isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Đảm bảo video đã sẵn sàng
      if (video.paused || video.ended || video.readyState < 2) return;

      // Thiết lập kích thước canvas khớp video
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
      }

      isScanningRef.current = true;

      try {
        // Phát hiện khuôn mặt kèm landmarks và descriptor với minConfidence tối ưu
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const landmarks = detection.landmarks;
            const points = landmarks.positions;

            // Vẽ 68 điểm mốc màu xanh neon
            ctx.fillStyle = '#06b6d4';
            for (const pt of points) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
              ctx.fill();
            }

            // Vẽ đường nối mắt, chân mày, cằm
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i <= 16; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();

            // Lưu trữ descriptor tạm thời vào cửa sổ window để gọi khi bấm nút quét
            (window as any).currentFaceDescriptor = Array.from(detection.descriptor);
          } else {
            (window as any).currentFaceDescriptor = null;
          }
        }
      } catch (err) {
        console.error('Face detection loop error:', err);
      } finally {
        isScanningRef.current = false;
      }
    }, 450);
  };

  // 4. Xử lý quét nhận diện để ĐĂNG NHẬP bằng khuôn mặt
  const handleFaceLogin = async () => {
    let descriptor = (window as any).currentFaceDescriptor;
    
    // Nếu chưa có sẵn từ loop, thử chụp 1-shot detection ngay tức thì
    if (!descriptor && videoRef.current && isAiLoaded) {
      try {
        setStatusMessage('Đang quét khuôn mặt...');
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection) {
          descriptor = Array.from(detection.descriptor);
        }
      } catch (e) {
        console.error('Instant face detection failed:', e);
      }
    }

    if (!descriptor) {
      setErrorMessage('Vui lòng nhìn thẳng vào camera để AI phát hiện khuôn mặt.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/login-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceDescriptor: descriptor })
      });

      const data = await res.json();
      if (res.ok) {
        handleLoginSuccess(data);
      } else {
        setErrorMessage(data.error || 'Nhận diện khuôn mặt thất bại.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Lỗi kết nối máy chủ khi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

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

  // 5. Xử lý quét nhận diện để ĐĂNG KÝ bằng khuôn mặt (Bước 1: Quét mặt)
  const handleFaceRegisterNext = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const descriptor = (window as any).currentFaceDescriptor;
    
    if (!email) {
      setErrorMessage('Vui lòng điền Email trước khi quét khuôn mặt.');
      return;
    }
    if (!descriptor) {
      setErrorMessage('Vui lòng đứng thẳng trước camera để AI quét các điểm cấu trúc khuôn mặt.');
      return;
    }

    // Kiểm tra khuôn mặt đã được đăng ký trong DB chưa
    setLoading(true);
    setStatusMessage('Đang xác thực sinh trắc học...');
    setErrorMessage('');
    try {
      const checkRes = await fetch('/api/auth/check-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceDescriptor: descriptor })
      });
      const checkData = await checkRes.json();

      if (checkData.isDuplicate) {
        setErrorMessage(`Khuôn mặt này đã được đăng ký cho tài khoản ${checkData.maskedEmail}. Vui lòng đăng nhập thay vì đăng ký mới.`);
        setStatusMessage('');
        setLoading(false);
        return;
      }
    } catch (err) {
      // Nếu không kiểm tra được thì vẫn cho tiếp tục (fail open)
      console.warn('check-face API failed, proceeding anyway:', err);
    }

    setLoading(false);
    setStatusMessage('');
    setTempFaceDescriptor(descriptor);
    stopWebcam();
    setRegisterFaceStep('password');
    setErrorMessage('');
    setStatusMessage('Khuôn mặt hợp lệ! Vui lòng thiết lập mật khẩu dự phòng.');
  };

  // Bước 2: Hoàn tất đăng ký với Mật khẩu dự phòng
  const handleFaceRegisterComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập Email và thiết lập Mật khẩu dự phòng.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu dự phòng phải chứa tối thiểu 6 ký tự.');
      return;
    }
    if (!tempFaceDescriptor) {
      setErrorMessage('Dữ liệu khuôn mặt bị mất. Vui lòng quét lại khuôn mặt.');
      setRegisterFaceStep('scan');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setStatusMessage('Đang xử lý tạo tài khoản bảo mật...');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          faceDescriptor: tempFaceDescriptor
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRegisterFaceStep('scan');
        setTempFaceDescriptor(null);
        handleLoginSuccess(data);
      } else {
        setErrorMessage(data.error || 'Đăng ký khuôn mặt thất bại.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Lỗi kết nối máy chủ khi đăng ký.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  // 6. Xử lý ĐĂNG NHẬP / ĐĂNG KÝ THỦ CÔNG bằng Email/Password
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
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
      
      {/* BACKGROUND 3D VŨ TRỤ ĐỒNG NHẤT */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
          <ambientLight intensity={0.2} />
          {/* Ánh sáng phát ra từ mặt trời ở trung tâm */}
          <pointLight position={[0, 0, 0]} intensity={3.5} distance={25} color="#ff9900" />
          <pointLight position={[5, 5, 5]} intensity={1.2} color="#f59e0b" />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1.5} />
          <Sun />
        </Canvas>
      </div>

      {/* OVERLAY TỐI TẬP TRUNG */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/80 z-5 pointer-events-none" />

      {/* FORM ĐĂNG NHẬP / ĐĂNG KÝ GLASSMORPHISM */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-[#0b1329]/65 backdrop-blur-xl border border-cyan-500/25 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center">
        
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 tracking-wider mb-2">
          {isRegister ? 'ĐĂNG KÝ FACE ID' : 'ĐĂNG NHẬP FACE ID'}
        </h2>
        <p className="text-gray-400 text-sm mb-6 text-center">
          {isRegister ? 'Đăng ký hệ thống thời khóa biểu vũ trụ 3D' : 'Nhận diện sinh trắc học để bước vào không gian 3D'}
        </p>

        {/* THÔNG BÁO LỖI / TRẠNG THÁI */}
        {errorMessage && (
          <div className="w-full p-3 mb-4 bg-red-950/60 border border-red-500/30 text-red-400 text-xs rounded-xl text-center">
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div className="w-full p-3 mb-4 bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs rounded-xl text-center animate-pulse">
            {statusMessage}
          </div>
        )}
        {aiLoadError && (
          <div className="w-full p-3 mb-4 bg-amber-950/60 border border-amber-500/30 text-amber-400 text-xs rounded-xl text-center">
            {aiLoadError}
          </div>
        )}

        {/* NÚT CHUYỂN CHẾ ĐỘ QUÉT FACE ID VS THỦ CÔNG */}
        <div className="flex w-full mb-6 bg-slate-900/80 p-1 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setIsFaceMode(true);
              setRegisterFaceStep('scan');
              setTempFaceDescriptor(null);
              setErrorMessage('');
              setStatusMessage('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-300 ${
              isFaceMode
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Quét Khuôn Mặt
          </button>
          <button
            type="button"
            onClick={() => {
              setIsFaceMode(false);
              setRegisterFaceStep('scan');
              setTempFaceDescriptor(null);
              setErrorMessage('');
              setStatusMessage('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-300 ${
              !isFaceMode
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Nhập Thủ Công
          </button>
        </div>

        {/* CHẾ ĐỘ 1: QUÉT KHUÔN MẶT */}
        {isFaceMode && isAiLoaded && (
          <div className="w-full flex flex-col items-center">
            {registerFaceStep === 'password' ? (
              // BƯỚC 2: NHẬP MẬT KHẨU DỰ PHÒNG
              <div className="w-full flex flex-col items-center">
                {/* ICON CHECKMARK HOLOGRAM 3D */}
                <div className="relative w-40 h-40 overflow-hidden rounded-full border-2 border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center justify-center mb-6 animate-[pulse_2s_infinite]">
                  <svg className="w-20 h-20 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-400 font-bold text-sm mb-6 tracking-wide text-center">
                  Đã ghi nhận dữ liệu khuôn mặt 3D sinh trắc học
                </p>

                <form onSubmit={handleFaceRegisterComplete} className="w-full flex flex-col">
                  <div className="w-full mb-4">
                    <label className="block text-xs font-semibold text-gray-400 tracking-wider mb-2">EMAIL TÀI KHOẢN</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 text-gray-400 rounded-xl text-sm focus:outline-none cursor-not-allowed opacity-75"
                    />
                  </div>

                  <div className="w-full mb-6">
                    <label className="block text-xs font-semibold text-cyan-400 tracking-wider mb-2">MẬT KHẨU DỰ PHÒNG</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Thiết lập mật khẩu bảo mật"
                      className="w-full px-4 py-3 bg-slate-950/70 border border-cyan-500/30 rounded-xl focus:outline-none focus:border-cyan-500/70 text-sm transition-all duration-300 text-white"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-2 italic">
                      * Dùng để đăng nhập thủ công khi camera hỏng hoặc thiếu sáng.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-sm font-bold tracking-wider rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center justify-center text-white"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang tạo tài khoản...
                      </span>
                    ) : (
                      'HOÀN TẤT ĐĂNG KÝ TÀI KHOẢN'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterFaceStep('scan');
                      setTempFaceDescriptor(null);
                      setErrorMessage('');
                      setStatusMessage('');
                    }}
                    className="w-full mt-3 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold rounded-xl transition-all duration-300"
                  >
                    Quét Lại Khuôn Mặt
                  </button>
                </form>
              </div>
            ) : (
              // BƯỚC 1: QUÉT CAMERA WEBCAM
              <div className="w-full flex flex-col items-center">
                {/* KHUNG CAMERA TRÒN SCI-FI VỚI TIA LASER */}
                <div className="relative w-64 h-64 overflow-hidden rounded-full border-2 border-cyan-500/40 bg-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.25)] flex items-center justify-center mb-6">
                  {/* VIDEO WEBCAM */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* CANVAS VẼ LANDMARKS HƠN ĐÈ LÊN */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
                  />
                  {/* TIA LÀ-ZE QUÉT CHẠY LÊN XUỐNG */}
                  {webcamActive && (
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#06b6d4] animate-[scan_2.5s_ease-in-out_infinite] z-20 pointer-events-none" />
                  )}
                  {/* KHÔNG BẬT ĐƯỢC CAMERA */}
                  {!webcamActive && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs text-center p-4">
                      Camera chưa hoạt động.<br />Đang tải kết nối...
                    </div>
                  )}
                </div>

                {/* FORM QUÉT FACE ID */}
                <form onSubmit={handleFaceRegisterNext} className="w-full flex flex-col items-center">
                  {isRegister && (
                    <div className="w-full mb-4">
                      <label className="block text-xs font-semibold text-gray-400 tracking-wider mb-2">EMAIL TÀI KHOẢN</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@university.edu"
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500/50 text-sm transition-all duration-300 text-white"
                        required
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={isRegister ? handleFaceRegisterNext : handleFaceLogin}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:from-cyan-700 active:to-blue-700 text-sm font-bold tracking-wider rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center text-white"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý sinh trắc học...
                      </span>
                    ) : (
                      isRegister ? 'XÁC NHẬN ĐĂNG KÝ KHUÔN MẶT' : 'QUÉT KHUÔN MẶT ĐĂNG NHẬP'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* CHẾ ĐỘ 2: NHẬP THỦ CÔNG */}
        {!isFaceMode && (
          <form onSubmit={handleManualSubmit} className="w-full flex flex-col">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 tracking-wider mb-2">EMAIL TÀI KHOẢN</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500/50 text-sm transition-all duration-300"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-400 tracking-wider mb-2">MẬT KHẨU</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500/50 text-sm transition-all duration-300"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-sm font-bold tracking-wider rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang gửi yêu cầu...
                </span>
              ) : (
                isRegister ? 'ĐĂNG KÝ TÀI KHUÔN' : 'ĐĂNG NHẬP HỆ THỐNG'
              )}
            </button>
          </form>
        )}

        {/* CHUYỂN ĐỔI ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setRegisterFaceStep('scan');
              setTempFaceDescriptor(null);
              setErrorMessage('');
              setStatusMessage('');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline transition-all duration-300"
          >
            {isRegister ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký tại đây'}
          </button>
        </div>

      </div>

      {/* CSS ANIMATION CHO TIA LÀ-ZE QUÉT */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 99%; }
        }
      `}</style>
    </div>
  );
}
