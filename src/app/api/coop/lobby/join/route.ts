import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

const NEON_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#6366f1', // Indigo
  '#3b82f6', // Blue
];

export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const userId = decoded.userId;
    const userEmail = decoded.email || '';
    const username = userEmail.split('@')[0] || 'Phi hành gia';

    const { lobbyId } = await request.json();
    if (!lobbyId) {
      return NextResponse.json({ error: 'Mã phòng không hợp lệ' }, { status: 400 });
    }

    // 1. Kiểm tra xem phòng có tồn tại không
    const lobby = await prisma.coopLobby.findUnique({
      where: { id: lobbyId.trim().toUpperCase() }
    });

    if (!lobby) {
      return NextResponse.json({ error: 'Phòng không tồn tại hoặc đã bị hủy' }, { status: 404 });
    }

    // 2. Kiểm tra xem người dùng đã là thành viên trong phòng chưa
    let member = await prisma.lobbyMember.findFirst({
      where: {
        lobbyId: lobby.id,
        userId: userId,
      }
    });

    if (!member) {
      // Chọn một màu ngẫu nhiên cho phi thuyền của thành viên mới
      const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];

      member = await prisma.lobbyMember.create({
        data: {
          lobbyId: lobby.id,
          userId: userId,
          username: username,
          color: color,
          scheduleJson: '[]',
        }
      });
    }

    // 3. Lấy danh sách thành viên hiện tại trong phòng
    const members = await prisma.lobbyMember.findMany({
      where: { lobbyId: lobby.id },
      select: {
        id: true,
        userId: true,
        username: true,
        color: true,
      }
    });

    return NextResponse.json({
      success: true,
      lobbyId: lobby.id,
      members,
      myMemberId: member.id,
    });

  } catch (error: any) {
    console.error('Error joining lobby:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tham gia phòng' }, { status: 500 });
  }
}
