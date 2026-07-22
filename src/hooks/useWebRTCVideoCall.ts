import { useState, useEffect, useRef, useCallback } from 'react';

interface PeerConnectionMap {
  [userId: string]: RTCPeerConnection;
}

interface RemoteStreamMap {
  [userId: string]: MediaStream;
}

interface PendingCandidatesMap {
  [userId: string]: RTCIceCandidateInit[];
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
  const pendingCandidatesRef = useRef<PendingCandidatesMap>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastSignalTimeRef = useRef<number>(0);
  const signalPollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCallActiveRef = useRef<boolean>(false);

  const lobbyIdRef = useRef<string | null>(lobbyId);
  const userIdRef = useRef<string | null>(userId);
  const usernameRef = useRef<string | null>(username);

  useEffect(() => {
    lobbyIdRef.current = lobbyId;
    userIdRef.current = userId;
    usernameRef.current = username;
  }, [lobbyId, userId, username]);

  // STUN Servers chuẩn Google & Cloudflare
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  // 1. Gửi tín hiệu WebRTC đến server signaling
  const sendSignal = useCallback(async (
    type: 'join-call' | 'offer' | 'answer' | 'candidate' | 'leave',
    targetId: string = 'all',
    payload?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
  ) => {
    const currentLobbyId = lobbyIdRef.current;
    const currentUserId = userIdRef.current;
    if (!currentLobbyId || !currentUserId) return;

    try {
      await fetch('/api/coop/video/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: currentLobbyId,
          senderId: currentUserId,
          senderName: usernameRef.current || 'Phi hành gia',
          targetId,
          type,
          sdp: payload?.sdp || null,
          candidate: payload?.candidate || null
        })
      });
    } catch (err) {
      console.error('Failed to send WebRTC signal:', err);
    }
  }, []);

  // 2. Thêm các ICE candidate đang chờ xử lý sau khi setRemoteDescription thành công
  const flushPendingCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current[peerId] || [];
    delete pendingCandidatesRef.current[peerId];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
  };

  // 3. Tạo kết nối Peer Connection mới với 1 thành viên
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
        sendSignal('candidate', targetUserId, { candidate: event.candidate.toJSON() });
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[targetUserId];
          return copy;
        });
      }
    };

    // Tự tạo offer nếu là bên khởi xướng
    if (isInitiator) {
      pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendSignal('offer', targetUserId, { sdp: pc.localDescription! });
        })
        .catch((err) => console.error('Error creating offer:', err));
    }

    return pc;
  }, [sendSignal]);

  // 4. Xử lý các tín hiệu nhận từ Polling
  const handleIncomingSignal = useCallback(async (sig: any) => {
    const { senderId, targetId, type, sdp, candidate } = sig;
    const currentUserId = userIdRef.current;
    if (!currentUserId || senderId === currentUserId) return;
    if (!isCallActiveRef.current) return;

    if (type === 'join-call') {
      // Khi thành viên khác mới bấm tham gia call
      // Người có ID lớn hơn (hoặc chưa có peer) sẽ chủ động tạo offer để khởi tạo kết nối P2P
      if (currentUserId > senderId || !peersRef.current[senderId]) {
        createPeerConnection(senderId, true);
      }
    } else if (type === 'offer') {
      if (!sdp) return;
      const pc = createPeerConnection(senderId, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(senderId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal('answer', senderId, { sdp: pc.localDescription! });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    } else if (type === 'answer') {
      if (!sdp) return;
      const pc = peersRef.current[senderId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushPendingCandidates(senderId, pc);
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      }
    } else if (type === 'candidate') {
      if (!candidate) return;
      const pc = peersRef.current[senderId];
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ice candidate:', e);
        }
      } else {
        if (!pendingCandidatesRef.current[senderId]) {
          pendingCandidatesRef.current[senderId] = [];
        }
        pendingCandidatesRef.current[senderId].push(candidate);
      }
    } else if (type === 'leave') {
      if (peersRef.current[senderId]) {
        peersRef.current[senderId].close();
        delete peersRef.current[senderId];
      }
      delete pendingCandidatesRef.current[senderId];
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[senderId];
        return copy;
      });
    }
  }, [createPeerConnection, sendSignal]);

  // 5. Polling tín hiệu Signaling theo chu kỳ
  useEffect(() => {
    if (!isCallActive || !lobbyId || !userId) {
      if (signalPollingRef.current) clearInterval(signalPollingRef.current);
      return;
    }

    const fetchSignals = async () => {
      try {
        const sinceTime = lastSignalTimeRef.current;
        const res = await fetch(`/api/coop/video/signal?lobbyId=${lobbyId}&userId=${userId}&since=${sinceTime}`);
        if (res.ok) {
          const data = await res.json();
          if (data.serverTime) {
            lastSignalTimeRef.current = data.serverTime;
          }
          if (data.signals && data.signals.length > 0) {
            for (const sig of data.signals) {
              await handleIncomingSignal(sig);
            }
          }
        }
      } catch (e) {
        console.error('Signal polling failed:', e);
      }
    };

    fetchSignals();
    signalPollingRef.current = setInterval(fetchSignals, 1000);

    return () => {
      if (signalPollingRef.current) clearInterval(signalPollingRef.current);
    };
  }, [isCallActive, lobbyId, userId, handleIncomingSignal]);

  // 6. Bắt đầu cuộc gọi Video (Start Call)
  const startCall = async () => {
    setCallError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      isCallActiveRef.current = true;
      setIsCallActive(true);
      setIsAudioMuted(false);
      setIsVideoOff(false);

      lastSignalTimeRef.current = Date.now() - 3000;
      sendSignal('join-call', 'all');
    } catch (err: any) {
      console.error('Error starting video call:', err);
      setCallError('Không thể truy cập Camera/Microphone. Vui lòng kiểm tra quyền thiết bị.');
      isCallActiveRef.current = false;
      setIsCallActive(false);
    }
  };

  // 7. Kết thúc cuộc gọi Video (End Call)
  const endCall = useCallback(() => {
    if (isCallActiveRef.current) {
      sendSignal('leave', 'all');
    }

    isCallActiveRef.current = false;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    Object.keys(peersRef.current).forEach((targetId) => {
      try {
        peersRef.current[targetId].close();
      } catch (e) {}
    });
    peersRef.current = {};
    pendingCandidatesRef.current = {};
    setRemoteStreams({});
    setIsCallActive(false);
    setIsScreenSharing(false);
  }, [sendSignal]);

  // 8. Bật/tắt Micro (Toggle Mute)
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // 9. Bật/tắt Camera (Toggle Video)
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 10. Chia sẻ màn hình (Screen Share)
  const toggleScreenShare = async () => {
    if (!isCallActive) return;

    if (isScreenSharing) {
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

