import { useState, useEffect, useRef, useCallback } from 'react';

interface PeerConnectionMap {
  [userId: string]: RTCPeerConnection;
}

interface RemoteStreamMap {
  [userId: string]: MediaStream;
}

export function useWebRTCVideoCall(lobbyId: string | null, userId: string | null, username: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamMap>({});
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const peersRef = useRef<PeerConnectionMap>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastSignalTimeRef = useRef<number>(0);
  const signalPollingRef = useRef<NodeJS.Timeout | null>(null);

  // STUN Servers miễn phí của Google
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // 1. Gửi tín hiệu WebRTC đến server signaling
  const sendSignal = useCallback(async (type: 'offer' | 'answer' | 'candidate' | 'leave', targetId: string = 'all', payload?: any) => {
    if (!lobbyId || !userId) return;
    try {
      await fetch('/api/coop/video/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          senderId: userId,
          senderName: username || 'Phi hành gia',
          targetId,
          type,
          sdp: payload?.sdp,
          candidate: payload?.candidate
        })
      });
    } catch (err) {
      console.error('Failed to send signal:', err);
    }
  }, [lobbyId, userId, username]);

  // 2. Tạo kết nối Peer Connection mới với 1 thành viên
  const createPeerConnection = useCallback((targetUserId: string, isInitiator: boolean) => {
    if (peersRef.current[targetUserId]) {
      return peersRef.current[targetUserId];
    }

    const pc = new RTCPeerConnection(iceServers);
    peersRef.current[targetUserId] = pc;

    // Thêm local tracks vào peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Nhận ICE Candidates từ peer và gửi đến server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('candidate', targetUserId, { candidate: event.candidate });
      }
    };

    // Nhận luồng Video/Audio remote từ peer
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUserId]: stream
        }));
      }
    };

    // Tự tạo offer nếu là bên khởi xướng
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendSignal('offer', targetUserId, { sdp: pc.localDescription });
        })
        .catch((err) => console.error('Error creating offer:', err));
    }

    return pc;
  }, [sendSignal]);

  // 3. Xử lý các tín hiệu nhận từ Polling
  const handleIncomingSignal = useCallback(async (sig: any) => {
    const { senderId, type, sdp, candidate } = sig;
    if (senderId === userId) return;

    if (type === 'offer') {
      const pc = createPeerConnection(senderId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', senderId, { sdp: pc.localDescription });
    } else if (type === 'answer') {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } else if (type === 'candidate') {
      const pc = peersRef.current[senderId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ice candidate:', e);
        }
      }
    } else if (type === 'leave') {
      if (peersRef.current[senderId]) {
        peersRef.current[senderId].close();
        delete peersRef.current[senderId];
      }
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[senderId];
        return copy;
      });
    }
  }, [userId, createPeerConnection, sendSignal]);

  // 4. Polling tín hiệu Signaling theo chu kỳ
  useEffect(() => {
    if (!isCallActive || !lobbyId || !userId) {
      if (signalPollingRef.current) clearInterval(signalPollingRef.current);
      return;
    }

    const fetchSignals = async () => {
      try {
        const res = await fetch(`/api/coop/video/signal?lobbyId=${lobbyId}&userId=${userId}&since=${lastSignalTimeRef.current}`);
        if (res.ok) {
          const data = await res.json();
          if (data.signals && data.signals.length > 0) {
            for (const sig of data.signals) {
              await handleIncomingSignal(sig);
            }
            lastSignalTimeRef.current = data.serverTime || Date.now();
          }
        }
      } catch (e) {
        console.error('Signal polling failed:', e);
      }
    };

    signalPollingRef.current = setInterval(fetchSignals, 1500);
    return () => {
      if (signalPollingRef.current) clearInterval(signalPollingRef.current);
    };
  }, [isCallActive, lobbyId, userId, handleIncomingSignal]);

  // 5. Bắt đầu cuộc gọi Video (Start Call)
  const startCall = async () => {
    setCallError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCallActive(true);
      setIsAudioMuted(false);
      setIsVideoOff(false);

      // Thông báo cho các thành viên trong phòng biết có người mới tham gia call
      sendSignal('offer', 'all');
    } catch (err: any) {
      console.error('Error starting video call:', err);
      setCallError('Không thể truy cập Camera/Microphone. Vui lòng kiểm tra quyền thiết bị.');
      setIsCallActive(false);
    }
  };

  // 6. Kết thúc cuộc gọi Video (End Call)
  const endCall = useCallback(() => {
    sendSignal('leave', 'all');

    // Dừng tất cả local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // Đóng tất cả Peer Connections
    Object.keys(peersRef.current).forEach((targetId) => {
      peersRef.current[targetId].close();
    });
    peersRef.current = {};
    setRemoteStreams({});
    setIsCallActive(false);
    setIsScreenSharing(false);
  }, [sendSignal]);

  // 7. Bật/tắt Micro (Toggle Mute)
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // 8. Bật/tắt Camera (Toggle Video)
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 9. Chia sẻ màn hình (Screen Share)
  const toggleScreenShare = async () => {
    if (!isCallActive) return;

    if (isScreenSharing) {
      // Chuyển lại về Camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const newVideoTrack = camStream.getVideoTracks()[0];

        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack);
        });

        localStreamRef.current = camStream;
        setLocalStream(camStream);
        setIsScreenSharing(false);
      } catch (e) {
        console.error('Error switching back to camera:', e);
      }
    } else {
      // Bật Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setLocalStream(screenStream);
        setIsScreenSharing(true);
      } catch (e) {
        console.error('Error starting screen share:', e);
      }
    }
  };

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    remoteStreams,
    isCallActive,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    callError,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
}
