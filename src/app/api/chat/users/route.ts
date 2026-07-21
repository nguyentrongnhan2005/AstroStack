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

    // Chỉ lấy những user đã là bạn bè ACCEPTED với user hiện tại
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: currentUserId, status: 'ACCEPTED' },
          { receiverId: currentUserId, status: 'ACCEPTED' }
        ]
      },
      include: {
        sender: {
          select: { id: true, email: true, username: true, university: true }
        },
        receiver: {
          select: { id: true, email: true, username: true, university: true }
        }
      }
    });

    const users = friendships.map(f => {
      const friend = f.senderId === currentUserId ? f.receiver : f.sender;
      return {
        id: friend.id,
        email: friend.email,
        username: friend.username || friend.email.split('@')[0],
        university: friend.university || 'IT University',
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Error fetching chat users:', error);
    return NextResponse.json({ error: error.message || 'Lỗi lấy danh sách bạn bè' }, { status: 500 });
  }
}
