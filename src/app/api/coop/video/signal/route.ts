import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lobbyId, senderId, senderName, targetId, type, sdp, candidate } = body;

    if (!lobbyId || !senderId || !type) {
      return NextResponse.json({ error: 'Thiếu thông tin tín hiệu WebRTC' }, { status: 400 });
    }

    const signal = await prisma.coopSignal.create({
      data: {
        lobbyId,
        senderId,
        senderName: senderName || 'Phi hành gia',
        targetId: targetId || 'all',
        type,
        sdp: sdp ? JSON.stringify(sdp) : null,
        candidate: candidate ? JSON.stringify(candidate) : null
      }
    });

    // Cleanup signal cũ hơn 2 phút trong DB Neon
    const deleteTime = new Date(Date.now() - 120000);
    await prisma.coopSignal.deleteMany({
      where: { createdAt: { lt: deleteTime } }
    }).catch(e => console.error('Cleanup signal error:', e));

    return NextResponse.json({ success: true, signalId: signal.id });
  } catch (error: any) {
    console.error('Error in POST /api/coop/video/signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lobbyId = searchParams.get('lobbyId');
    const userId = searchParams.get('userId');
    const since = parseInt(searchParams.get('since') || '0', 10);

    if (!lobbyId || !userId) {
      return NextResponse.json({ error: 'Missing lobbyId or userId' }, { status: 400 });
    }

    const sinceDate = new Date(since);

    const signals = await prisma.coopSignal.findMany({
      where: {
        lobbyId,
        createdAt: { gt: sinceDate },
        senderId: { not: userId },
        OR: [
          { targetId: 'all' },
          { targetId: userId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    const parsedSignals = signals.map((s) => ({
      id: s.id,
      senderId: s.senderId,
      senderName: s.senderName,
      targetId: s.targetId,
      type: s.type,
      sdp: s.sdp ? JSON.parse(s.sdp) : null,
      candidate: s.candidate ? JSON.parse(s.candidate) : null,
      timestamp: new Date(s.createdAt).getTime()
    }));

    return NextResponse.json({
      success: true,
      signals: parsedSignals,
      serverTime: Date.now()
    });
  } catch (error: any) {
    console.error('Error in GET /api/coop/video/signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
