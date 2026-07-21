import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cardtkb-super-secret-key-3d-space';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ Email và Mật khẩu' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { semesters: true }
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại hoặc chưa cài đặt mật khẩu' }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Mật khẩu không chính xác' }, { status: 400 });
    }

    let semester = user.semesters[0];
    if (!semester) {
      semester = await prisma.semester.create({
        data: {
          userId: user.id,
          name: 'HK1 2026-2027',
        }
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        semesterId: semester.id
      }
    });
  } catch (error: any) {
    console.error('Error in login-manual API:', error);
    return NextResponse.json({ error: error.message || 'Lỗi đăng nhập' }, { status: 500 });
  }
}
