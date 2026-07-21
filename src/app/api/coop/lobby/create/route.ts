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

function generateLobbyId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ROOM-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const userId = decoded.userId;
    const userEmail = decoded.email || '';
    const username = userEmail.split('@')[0] || 'Phi hành gia';

    // Tạo mã phòng ngẫu nhiên duy nhất
    let lobbyId = generateLobbyId();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await prisma.coopLobby.findUnique({
        where: { id: lobbyId }
      });
      if (!existing) {
        isUnique = true;
      } else {
        lobbyId = generateLobbyId();
        attempts++;
      }
    }

    // 1. Tạo phòng mới
    const lobby = await prisma.coopLobby.create({
      data: {
        id: lobbyId,
        hostId: userId,
      }
    });

    // Chọn màu ngẫu nhiên cho phi thuyền của chủ phòng
    const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];

    // 2. Thêm chủ phòng vào danh sách thành viên sảnh
    const member = await prisma.lobbyMember.create({
      data: {
        lobbyId: lobby.id,
        userId: userId,
        username: username,
        color: color,
        scheduleJson: '[]',
      }
    });

    return NextResponse.json({
      success: true,
      lobbyId: lobby.id,
      member: {
        id: member.id,
        userId: member.userId,
        username: member.username,
        color: member.color,
      }
    });

  } catch (error: any) {
    console.error('Error creating lobby:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tạo phòng sảnh vũ trụ' }, { status: 500 });
  }
}
