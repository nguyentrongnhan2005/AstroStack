import { NextResponse } from 'next/server';

// Bộ nhớ tạm thời lưu trữ tín hiệu WebRTC signaling theo lobbyId
interface SignalMessage {
  id: string;
  senderId: string;
  senderName: string;
  targetId: string; // ID người nhận (hoặc 'all')
  type: 'offer' | 'answer' | 'candidate' | 'leave';
  sdp?: any;
  candidate?: any;
  timestamp: number;
}

const lobbySignals: { [lobbyId: string]: SignalMessage[] } = {};

// Clean up tín hiệu cũ hơn 2 phút tránh ngốn bộ nhớ
function cleanupOldSignals() {
  const now = Date.now();
  for (const lobbyId in lobbySignals) {
    lobbySignals[lobbyId] = lobbySignals[lobbyId].filter(
      (sig) => now - sig.timestamp < 120000
    );
    if (lobbySignals[lobbyId].length === 0) {
      delete lobbySignals[lobbyId];
    }
  }
}

// POST: Gửi tín hiệu SDP Offer, Answer hoặc ICE Candidate
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lobbyId, senderId, senderName, targetId, type, sdp, candidate } = body;

    if (!lobbyId || !senderId || !type) {
      return NextResponse.json({ error: 'Thiếu thông tin tín hiệu WebRTC' }, { status: 400 });
    }

    if (!lobbySignals[lobbyId]) {
      lobbySignals[lobbyId] = [];
    }

    const newMessage: SignalMessage = {
      id: `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId,
      senderName: senderName || 'Phi hành gia',
      targetId: targetId || 'all',
      type,
      sdp,
      candidate,
      timestamp: Date.now()
    };

    lobbySignals[lobbyId].push(newMessage);
    cleanupOldSignals();

    return NextResponse.json({ success: true, signalId: newMessage.id });
  } catch (error: any) {
    console.error('Error in POST /api/coop/video/signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Lấy các tín hiệu WebRTC mới dành cho senderId trong lobbyId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lobbyId = searchParams.get('lobbyId');
    const userId = searchParams.get('userId');
    const since = parseInt(searchParams.get('since') || '0', 10);

    if (!lobbyId || !userId) {
      return NextResponse.json({ error: 'Missing lobbyId or userId' }, { status: 400 });
    }

    const allSignals = lobbySignals[lobbyId] || [];
    
    // Lọc tín hiệu gửi cho userId này (hoặc gửi tới 'all') ngoại trừ các tín hiệu do chính userId này tự gửi
    const pendingSignals = allSignals.filter(
      (sig) =>
        sig.timestamp > since &&
        sig.senderId !== userId &&
        (sig.targetId === userId || sig.targetId === 'all')
    );

    return NextResponse.json({
      success: true,
      signals: pendingSignals,
      serverTime: Date.now()
    });
  } catch (error: any) {
    console.error('Error in GET /api/coop/video/signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
