import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
      }
    });

  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải hồ sơ người dùng' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const userId = decoded.userId;
    const { action, username, oldPassword, newPassword } = await request.json();

    if (action === 'updateUsername') {
      if (!username || !username.trim()) {
        return NextResponse.json({ error: 'Tên người dùng không được để trống' }, { status: 400 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { username: username.trim() },
        select: {
          id: true,
          email: true,
          username: true,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Cập nhật tên người dùng thành công',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username || updatedUser.email.split('@')[0],
        }
      });
    }

    if (action === 'changePassword') {
      if (!oldPassword || !newPassword) {
        return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin mật khẩu cũ và mới' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.password) {
        return NextResponse.json({ error: 'Người dùng không tồn tại hoặc chưa cài đặt mật khẩu tĩnh' }, { status: 400 });
      }

      // 1. Kiểm tra mật khẩu cũ có khớp không
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác' }, { status: 400 });
      }

      // 2. Hash mật khẩu mới và cập nhật
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      return NextResponse.json({
        success: true,
        message: 'Đổi mật khẩu thành công'
      });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });

  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật hồ sơ' }, { status: 500 });
  }
}
