import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const currentUserId = decoded.userId;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || !q.trim()) {
      return NextResponse.json({ success: true, results: [] });
    }

    const searchQuery = q.trim();

    // Tìm kiếm tối đa 15 người dùng khác khớp với ID, email hoặc username
    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { id: searchQuery },
          { email: { contains: searchQuery, mode: 'insensitive' } },
          { username: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        university: true
      },
      take: 15
    });

    // Đối chiếu quan hệ kết bạn của từng user được tìm thấy với user hiện tại
    const results = await Promise.all(users.map(async (u) => {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: u.id },
            { senderId: u.id, receiverId: currentUserId }
          ]
        }
      });

      let relationStatus = 'NOT_FRIEND'; // FRIEND, REQUEST_SENT, REQUEST_RECEIVED, NOT_FRIEND
      let friendshipId = null;

      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'ACCEPTED') {
          relationStatus = 'FRIEND';
        } else if (friendship.status === 'PENDING') {
          relationStatus = friendship.senderId === currentUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
        }
      }

      return {
        id: u.id,
        email: u.email,
        username: u.username || u.email.split('@')[0],
        university: u.university || 'IT University',
        relationStatus,
        friendshipId
      };
    }));

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Error searching friends:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tìm kiếm bạn bè' }, { status: 500 });
  }
}
