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

    // 1. Lấy danh sách bạn bè (ACCEPTED)
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

    const friends = friendships.map(f => {
      const friend = f.senderId === currentUserId ? f.receiver : f.sender;
      return {
        friendshipId: f.id,
        id: friend.id,
        email: friend.email,
        username: friend.username || friend.email.split('@')[0],
        university: friend.university || 'IT University'
      };
    });

    // 2. Lấy yêu cầu kết bạn gửi đến mình (PENDING)
    const pendingReceived = await prisma.friendship.findMany({
      where: {
        receiverId: currentUserId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: { id: true, email: true, username: true, university: true }
        }
      }
    });

    const receivedRequests = pendingReceived.map(f => ({
      friendshipId: f.id,
      sender: {
        id: f.sender.id,
        email: f.sender.email,
        username: f.sender.username || f.sender.email.split('@')[0],
        university: f.sender.university || 'IT University'
      }
    }));

    // 3. Lấy yêu cầu mình gửi đi (PENDING)
    const pendingSent = await prisma.friendship.findMany({
      where: {
        senderId: currentUserId,
        status: 'PENDING'
      },
      include: {
        receiver: {
          select: { id: true, email: true, username: true, university: true }
        }
      }
    });

    const sentRequests = pendingSent.map(f => ({
      friendshipId: f.id,
      receiver: {
        id: f.receiver.id,
        email: f.receiver.email,
        username: f.receiver.username || f.receiver.email.split('@')[0],
        university: f.receiver.university || 'IT University'
      }
    }));

    return NextResponse.json({
      success: true,
      friends,
      receivedRequests,
      sentRequests
    });

  } catch (error: any) {
    console.error('Error fetching friends data:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải danh sách bạn bè' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const currentUserId = decoded.userId;
    const { action, targetId, friendshipId } = await request.json();

    // A. Gửi lời mời kết bạn
    if (action === 'request') {
      if (!targetId) {
        return NextResponse.json({ error: 'Thiếu thông tin người nhận kết bạn' }, { status: 400 });
      }

      if (currentUserId === targetId) {
        return NextResponse.json({ error: 'Bạn không thể tự kết bạn với chính mình' }, { status: 400 });
      }

      // Kiểm tra xem đã có quan hệ kết bạn nào chưa
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: targetId },
            { senderId: targetId, receiverId: currentUserId }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          return NextResponse.json({ error: 'Hai người đã là bạn bè của nhau' }, { status: 400 });
        }
        if (existing.status === 'PENDING') {
          return NextResponse.json({ error: 'Yêu cầu kết bạn đang ở trạng thái chờ chấp nhận' }, { status: 400 });
        }
      }

      // Tạo mới
      const newFriendship = await prisma.friendship.create({
        data: {
          senderId: currentUserId,
          receiverId: targetId,
          status: 'PENDING'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Đã gửi lời mời kết bạn thành công',
        friendship: newFriendship
      });
    }

    // B. Chấp nhận kết bạn
    if (action === 'accept') {
      if (!friendshipId) {
        return NextResponse.json({ error: 'Thiếu mã yêu cầu kết bạn' }, { status: 400 });
      }

      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'ACCEPTED' }
      });

      return NextResponse.json({
        success: true,
        message: 'Đã chấp nhận kết bạn',
        friendship: updated
      });
    }

    // C. Từ chối hoặc hủy yêu cầu kết bạn
    if (action === 'decline') {
      if (!friendshipId) {
        return NextResponse.json({ error: 'Thiếu mã yêu cầu kết bạn' }, { status: 400 });
      }

      await prisma.friendship.delete({
        where: { id: friendshipId }
      });

      return NextResponse.json({
        success: true,
        message: 'Đã hủy/từ chối yêu cầu kết bạn thành công'
      });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });

  } catch (error: any) {
    console.error('Error handling friendship request:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý kết bạn' }, { status: 500 });
  }
}
