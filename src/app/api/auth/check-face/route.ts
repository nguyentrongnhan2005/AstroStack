import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Hàm tính khoảng cách Euclidean giữa hai vector 128 chiều
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

    // Lấy toàn bộ user đã có khuôn mặt trong database
    const users = await prisma.user.findMany({
      where: { faceDescriptor: { not: null } },
      select: { id: true, email: true, faceDescriptor: true }
    });

    const threshold = 0.52;
    let minDistance = Infinity;
    let matchedEmail: string | null = null;

    for (const u of users) {
      if (!u.faceDescriptor) continue;
      try {
        const dbDescriptor = JSON.parse(u.faceDescriptor);
        const dist = getEuclideanDistance(faceDescriptor, dbDescriptor);
        if (dist < minDistance) {
          minDistance = dist;
          if (dist < threshold) {
            matchedEmail = u.email;
          }
        }
      } catch (e) {
        // Bỏ qua user có faceDescriptor lỗi
      }
    }

    if (matchedEmail) {
      // Che bớt email để bảo vệ quyền riêng tư (ví dụ: nh****@gmail.com)
      const [local, domain] = matchedEmail.split('@');
      const maskedLocal = local.substring(0, 2) + '****';
      const maskedEmail = `${maskedLocal}@${domain}`;

      return NextResponse.json({
        isDuplicate: true,
        maskedEmail,
        distance: minDistance
      });
    }

    return NextResponse.json({ isDuplicate: false });
  } catch (error: any) {
    console.error('Error in check-face API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
