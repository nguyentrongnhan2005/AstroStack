import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng. Vui lòng đăng nhập lại.' }, { status: 401 });
    }

    const userId = decoded.userId;

    const { lobbyId, scheduleJson } = await request.json();
    if (!lobbyId) {
      return NextResponse.json({ error: 'Mã phòng không hợp lệ' }, { status: 400 });
    }

    // 1. Cập nhật trạng thái thời khóa biểu và thời gian hoạt động của thành viên này
    const member = await prisma.lobbyMember.findFirst({
      where: {
        lobbyId: lobbyId,
        userId: userId,
      }
    });

    if (!member) {
      return NextResponse.json({ error: 'Bạn không phải là thành viên trong phòng này' }, { status: 403 });
    }

    // Cập nhật dữ liệu
    await prisma.lobbyMember.update({
      where: { id: member.id },
      data: {
        scheduleJson: scheduleJson || '[]',
        updatedAt: new Date(), // Cập nhật dấu mốc online
      }
    });

    // 2. Lọc các thành viên đang hoạt động thực tế (online trong 15 giây gần nhất)
    const thresholdTime = new Date(Date.now() - 15 * 1000);

    const activeMembers = await prisma.lobbyMember.findMany({
      where: {
        lobbyId: lobbyId,
        updatedAt: { gte: thresholdTime }
      },
      select: {
        id: true,
        userId: true,
        username: true,
        color: true,
        scheduleJson: true,
        updatedAt: true,
      }
    });

    // 3. Tự động dọn dẹp các thành viên offline lâu hơn 1 phút khỏi DB để giải phóng dung lượng
    const deleteThreshold = new Date(Date.now() - 60 * 1000);
    await prisma.lobbyMember.deleteMany({
      where: {
        lobbyId: lobbyId,
        updatedAt: { lt: deleteThreshold }
      }
    }).catch(err => console.error('Error cleaning offline members:', err));

    // Nếu không còn thành viên nào trong phòng kể cả host, ta có thể tự động xóa phòng
    const remainingMembersCount = await prisma.lobbyMember.count({
      where: { lobbyId: lobbyId }
    });

    if (remainingMembersCount === 0) {
      await prisma.coopLobby.delete({
        where: { id: lobbyId }
      }).catch(err => console.error('Error deleting empty lobby:', err));
    }

    return NextResponse.json({
      success: true,
      members: activeMembers,
    });

  } catch (error: any) {
    console.error('Error syncing lobby state:', error);
    return NextResponse.json({ error: error.message || 'Lỗi đồng bộ dữ liệu nhóm' }, { status: 500 });
  }
}
