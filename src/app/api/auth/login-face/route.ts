import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cardtkb-super-secret-key-3d-space';

// Hàm tính khoảng cách Euclidean giữa hai mảng vector số thực
function getEuclideanDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
}

export async function POST(request: Request) {
  try {
    const { faceDescriptor } = await request.json();

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json({ error: 'Dữ liệu quét khuôn mặt không hợp lệ' }, { status: 400 });
    }

    // Lấy toàn bộ user có khuôn mặt trong database
    const users = await prisma.user.findMany({
      where: {
        faceDescriptor: {
          not: null
        }
      },
      include: {
        semesters: true
      }
    });

    let bestMatchUser = null;
    let minDistance = Infinity;
    const threshold = 0.52; // Ngưỡng nhận diện an toàn của face-api.js (khoảng cách càng nhỏ càng giống)

    for (const u of users) {
      if (!u.faceDescriptor) continue;
      try {
        const dbDescriptor = JSON.parse(u.faceDescriptor);
        const dist = getEuclideanDistance(faceDescriptor, dbDescriptor);
        
        if (dist < minDistance) {
          minDistance = dist;
          bestMatchUser = u;
        }
      } catch (e) {
        console.error('Failed to parse faceDescriptor for user:', u.id, e);
      }
    }

    // Kiểm tra kết quả khớp
    if (!bestMatchUser || minDistance > threshold) {
      console.warn(`Face login failed. Min distance: ${minDistance}`);
      return NextResponse.json({
        error: 'Không nhận diện được khuôn mặt. Vui lòng thử lại hoặc đăng nhập thủ công.'
      }, { status: 400 });
    }

    let semester = bestMatchUser.semesters[0];
    if (!semester) {
      semester = await prisma.semester.create({
        data: {
          userId: bestMatchUser.id,
          name: 'HK1 2026-2027',
        }
      });
    }

    // Đăng nhập thành công, cấp JWT
    const token = jwt.sign(
      { userId: bestMatchUser.id, email: bestMatchUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: bestMatchUser.id,
        email: bestMatchUser.email,
        semesterId: semester.id
      }
    });
  } catch (error: any) {
    console.error('Error in login-face API:', error);
    return NextResponse.json({ error: error.message || 'Lỗi nhận diện khuôn mặt' }, { status: 500 });
  }
}
