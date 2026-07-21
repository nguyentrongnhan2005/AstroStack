import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cardtkb-super-secret-key-3d-space';

export async function POST(request: Request) {
  try {
    const { email, password, faceDescriptor } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email không được để trống' }, { status: 400 });
    }

    // Kiểm tra email trùng lặp
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email này đã được đăng ký tài khoản' }, { status: 400 });
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Tạo user mới
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        faceDescriptor: faceDescriptor ? JSON.stringify(faceDescriptor) : null,
        university: 'IT University',
        semesters: {
          create: {
            name: 'HK1 2026-2027',
          }
        }
      },
      include: {
        semesters: true
      }
    });

    const semester = newUser.semesters[0];

    // Tạo token JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        semesterId: semester?.id || null
      }
    });
  } catch (error: any) {
    console.error('Error in register API:', error);
    return NextResponse.json({ error: error.message || 'Lỗi đăng ký tài khoản' }, { status: 500 });
  }
}
