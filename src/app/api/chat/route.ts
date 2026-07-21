import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

// 1. GET: Lấy lịch sử trò chuyện giữa hai người dùng
export async function GET(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const receiverId = searchParams.get('receiverId');

    if (!receiverId) {
      return NextResponse.json({ error: 'Vui lòng cung cấp receiverId' }, { status: 400 });
    }

    const currentUserId = decoded.userId;

    // Lấy tin nhắn giữa currentUserId và receiverId
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: receiverId },
          { senderId: receiverId, receiverId: currentUserId }
        ]
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải lịch sử trò chuyện' }, { status: 500 });
  }
}

// 2. POST: Gửi tin nhắn mới (có thể kèm file/ảnh)
export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Không thể xác thực người dùng.' }, { status: 401 });
    }

    const { receiverId, content, fileUrl, fileType, fileName } = await request.json();

    // Tin nhắn hợp lệ nếu có ít nhất text HOẶC file
    const hasText = content && content.trim() !== '';
    const hasFile = fileUrl && fileUrl.trim() !== '';

    if (!receiverId || (!hasText && !hasFile)) {
      return NextResponse.json({ error: 'Dữ liệu tin nhắn không hợp lệ' }, { status: 400 });
    }

    const currentUserId = decoded.userId;

    // Kiểm tra xem receiverId có tồn tại trong hệ thống không
    const receiverExists = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiverExists) {
      return NextResponse.json({ error: 'Người nhận không tồn tại trên hệ thống' }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        senderId:   currentUserId,
        receiverId: receiverId,
        content:    hasText ? content.trim() : '',
        fileUrl:    hasFile ? fileUrl.trim() : null,
        fileType:   fileType || null,
        fileName:   fileName || null,
      }
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message || 'Lỗi gửi tin nhắn' }, { status: 500 });
  }
}
