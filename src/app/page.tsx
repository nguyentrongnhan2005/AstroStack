'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  useScheduleStore, 
  CourseCard, 
  Session 
} from '@/store/useScheduleStore';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import CardBoard3D from '@/components/CardBoard3D';
import AiAssistantChat from '@/components/AiAssistantChat';
import { 
  Sparkles, 
  Upload, 
  BookOpen, 
  Layers, 
  Calendar, 
  Lock, 
  Unlock, 
  Trash2, 
  RefreshCw, 
  Download, 
  Share2, 
  Check, 
  FileText, 
  Sliders, 
  ChevronRight, 
  X, 
  Cloud,
  Info,
  Clock,
  User as UserIcon,
  MapPin,
  AlertTriangle,
  LogOut,
  MessageSquare,
  Send,
  Image as ImageIcon,
  FileSpreadsheet,
  FileJson,
  Search,
  UserPlus,
  Video
} from 'lucide-react';
import confetti from 'canvas-confetti';

const COLOR_MAP: { [key: string]: string } = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  gray: '#6b7280',
};

export default function Home() {
  const {
    courseCards,
    placedCards,
    versions,
    currentVersionId,
    setCourseCards,
    addCourseCard,
    removeCourseCard,
    placeCard,
    removePlacedCard,
    toggleLockCard,
    addVersion,
    switchVersion,
    deleteVersion,
    clearAllData,
    initStoreData,
    activeLobbyId,
    lobbyMembers,
    coopCourseCards,
    coopActive,
    setCoopState
  } = useScheduleStore();

  // State cục bộ
  const [activeTab, setActiveTab] = useState<'cards' | 'import' | 'coop'>('cards');
  const [selectedCard, setSelectedCard] = useState<CourseCard | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [compareUserId, setCompareUserId] = useState<string | null>(null);
  const [compareCourseCards, setCompareCourseCards] = useState<CourseCard[]>([]);
  const [icsStartDate, setIcsStartDate] = useState<string>('2026-09-07');
  const [icsWeeksCount, setIcsWeeksCount] = useState<number>(15);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number] | null>(null);
  const [groqKeyInput, setGroqKeyInput] = useState<string>('');
  const [myUserId, setMyUserId] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
    
    // Tự động tính ngày Thứ Hai gần nhất của tuần hiện tại làm ngày bắt đầu học kỳ mẫu
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    setIcsStartDate(`${yyyy}-${mm}-${dd}`);

    // Đọc Groq API Key
    const storedGroqKey = localStorage.getItem('cardtkb_groq_api_key');
    if (storedGroqKey) setGroqKeyInput(storedGroqKey);

    // Đọc User ID từ localStorage
    const storedUserId = localStorage.getItem('cardtkb_user_id');
    if (storedUserId) setMyUserId(storedUserId);
  }, []);

  const coopPollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!coopActive || !activeLobbyId) {
      if (coopPollingRef.current) {
        clearInterval(coopPollingRef.current);
        coopPollingRef.current = null;
      }
      return;
    }

    const syncLobby = async () => {
      try {
        const token = localStorage.getItem('cardtkb_token');
        if (!token) return;

        // Map dữ liệu TKB của bản thân đã xếp lịch gửi lên
        const myPlacedCardsData = placedCards.map(placed => {
          const card = courseCards.find(c => c.id === placed.courseCardId);
          return card;
        }).filter(Boolean);

        const res = await fetch('/api/coop/lobby/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            lobbyId: activeLobbyId,
            scheduleJson: JSON.stringify(myPlacedCardsData)
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const currentUserId = localStorage.getItem('cardtkb_user_id');
            const otherMembers = data.members.filter((m: any) => m.userId !== currentUserId);
            
            let aggregatedCards: CourseCard[] = [];
            otherMembers.forEach((m: any) => {
              try {
                const memberCards = JSON.parse(m.scheduleJson || '[]');
                const formattedCards = memberCards.map((card: any) => ({
                  ...card,
                  sourceType: 'coop',
                  coopMemberColor: m.color,
                  coopMemberUsername: m.username,
                  sessions: (card.sessions || []).map((s: any) => ({
                    ...s,
                    id: `coop-${m.userId}-${s.id}`
                  }))
                }));
                aggregatedCards = [...aggregatedCards, ...formattedCards];
              } catch (e) {
                console.error('Error parsing member schedule:', e);
              }
            });

            setCoopState({
              lobbyMembers: data.members,
              coopCourseCards: aggregatedCards
            });
          }
        } else {
          setCoopState({ activeLobbyId: null, lobbyMembers: [], coopCourseCards: [], coopActive: false });
        }
      } catch (err) {
        console.error('Sync lobby failed:', err);
      }
    };

    syncLobby();
    coopPollingRef.current = setInterval(syncLobby, 3000);

    return () => {
      if (coopPollingRef.current) {
        clearInterval(coopPollingRef.current);
        coopPollingRef.current = null;
      }
    };
  }, [coopActive, activeLobbyId, placedCards, courseCards, setCoopState]);

  const handleCreateLobby = async () => {
    setCoopLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) {
        alert('Vui lòng đăng nhập để tạo phòng Co-Op.');
        setCoopLoading(false);
        return;
      }

      const res = await fetch('/api/coop/lobby/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCoopState({
          activeLobbyId: data.lobbyId,
          coopActive: true,
          lobbyMembers: [data.member]
        });
      } else {
        alert('Lỗi tạo phòng: ' + (data.error || 'Không xác định'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setCoopLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!joinRoomId.trim()) {
      alert('Vui lòng nhập mã phòng.');
      return;
    }
    setCoopLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) {
        alert('Vui lòng đăng nhập để tham gia phòng Co-Op.');
        setCoopLoading(false);
        return;
      }

      const res = await fetch('/api/coop/lobby/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lobbyId: joinRoomId })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCoopState({
          activeLobbyId: data.lobbyId,
          coopActive: true,
          lobbyMembers: data.members
        });
        setJoinRoomId('');
      } else {
        alert('Không thể tham gia phòng: ' + (data.error || 'Vui lòng kiểm tra lại mã phòng.'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setCoopLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    if (coopPollingRef.current) {
      clearInterval(coopPollingRef.current);
      coopPollingRef.current = null;
    }
    setCoopState({
      activeLobbyId: null,
      lobbyMembers: [],
      coopCourseCards: [],
      coopActive: false
    });
  };

  const handleOpenProfileModal = async () => {
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileData(data.user);
        setNewUsername(data.user.username);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      alert('Tên người dùng không được để trống.');
      return;
    }
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'updateUsername',
          username: newUsername
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileData(data.user);
        alert('Cập nhật tên người dùng thành công!');
      } else {
        alert(data.error || 'Cập nhật thất bại.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      alert('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'changePassword',
          oldPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Đổi mật khẩu thành công!');
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        alert(data.error || 'Đổi mật khẩu thất bại.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchFriendsAndRequests = async () => {
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReceivedRequests(data.receivedRequests || []);
        setSentRequests(data.sentRequests || []);
        // Đồng thời cập nhật danh sách chat để chỉ hiển thị bạn bè thực sự
        setChatUsers(data.friends || []);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  };

  const handleOpenFriendManager = () => {
    setShowFriendModal(true);
    setFriendSearchQuery('');
    setFriendSearchResults([]);
    fetchFriendsAndRequests();
  };

  const handleSearchFriends = async () => {
    if (!friendSearchQuery.trim()) return;
    setFriendSearchLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(friendSearchQuery.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFriendSearchResults(data.results || []);
      } else {
        alert(data.error || 'Tìm kiếm thất bại');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối tìm kiếm');
    } finally {
      setFriendSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetId: string) => {
    setFriendActionLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'request',
          targetId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Đã gửi lời mời kết bạn!');
        // Cập nhật lại kết quả tìm kiếm để đổi trạng thái sang REQUEST_SENT
        setFriendSearchResults(prev =>
          prev.map(r => r.id === targetId ? { ...r, relationStatus: 'REQUEST_SENT', friendshipId: data.friendship.id } : r)
        );
        fetchFriendsAndRequests();
      } else {
        alert(data.error || 'Gửi kết bạn thất bại');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRespondFriendRequest = async (friendshipId: string, action: 'accept' | 'decline', targetId?: string) => {
    setFriendActionLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      if (!token) return;

      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          friendshipId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Xử lý thành công!');
        
        // Cập nhật kết quả tìm kiếm nếu có
        if (targetId) {
          setFriendSearchResults(prev =>
            prev.map(r => r.id === targetId ? { 
              ...r, 
              relationStatus: action === 'accept' ? 'FRIEND' : 'NOT_FRIEND',
              friendshipId: action === 'accept' ? friendshipId : null
            } : r)
          );
        }

        // Tải lại lời mời và danh sách bạn bè
        fetchFriendsAndRequests();
        fetchChatUsers(); // Tải lại danh sách chat chính
      } else {
        alert(data.error || 'Xử lý thất bại');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const nextSession = useMemo(() => {
    if (placedCards.length === 0) return null;
    const now = new Date();
    let currentJSIdx = now.getDay();
    let currentDayOfWeek = currentJSIdx === 0 ? 8 : currentJSIdx + 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const periodStartTimes = {
      1: 7 * 60, 2: 7 * 60 + 55, 3: 9 * 60, 4: 9 * 60 + 55,
      5: 10 * 60 + 50, 6: 13 * 60, 7: 13 * 60 + 55, 8: 15 * 60,
      9: 15 * 60 + 55, 10: 16 * 60 + 50, 11: 18 * 60, 12: 18 * 60 + 55
    } as any;

    const allSessions: { card: CourseCard; session: Session; absoluteMinutes: number }[] = [];
    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((s) => {
          const startMin = periodStartTimes[s.startPeriod] || 7 * 60;
          const absoluteMinutes = s.dayOfWeek * 1440 + startMin;
          allSessions.push({ card, session: s, absoluteMinutes });
        });
      }
    });

    if (allSessions.length === 0) return null;

    const nowAbsoluteMinutes = currentDayOfWeek * 1440 + currentMinutes;
    allSessions.sort((a, b) => a.absoluteMinutes - b.absoluteMinutes);
    let next = allSessions.find((s) => s.absoluteMinutes > nowAbsoluteMinutes);
    if (!next) {
      next = allSessions[0];
    }
    return next;
  }, [placedCards, courseCards]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // State cho phần import
  const [textInput, setTextInput] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);

  // State cho Co-Op Lobby
  const [joinRoomId, setJoinRoomId] = useState('');
  const [coopLoading, setCoopLoading] = useState(false);

  // State cho User Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<{ id: string; email: string; username: string } | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // State cho Friend Manager Modal
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  // State cho phần Chat trực tiếp (User vs User)
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUsersLoading, setChatUsersLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'export'>('chat');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // State cho upload file/ảnh trong chat
  const [chatAttachment, setChatAttachment] = useState<{
    file: File;
    previewUrl: string;
    fileType: 'image' | 'document' | 'other';
  } | null>(null);
  const [chatUploadLoading, setChatUploadLoading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  // State cho emoji/sticker picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'sticker'>('emoji');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // State cho share popup
  const [showShareModal, setShowShareModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // State cho Neon Database Sync
  const [userId, setUserId] = useState<string>('');
  const [dbSyncLoading, setDbSyncLoading] = useState(false);
  const [dbSyncMessage, setDbSyncMessage] = useState('');

  // Tải dữ liệu từ database khi mount trang
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('cardtkb_token');
    const storedUserId = localStorage.getItem('cardtkb_user_id');

    if (!token || !storedUserId) {
      router.push('/login');
      return;
    }

    setUserId(storedUserId);
    setAuthChecking(false);

    // 2. Định nghĩa hàm tải dữ liệu từ DB
    const fetchScheduleFromDB = async (uid: string) => {
      try {
        const res = await fetch(`/api/schedule?userId=${uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.courseCards && data.courseCards.length > 0) {
            initStoreData(data.courseCards, data.versions);
            return true;
          }
        }
      } catch (err) {
        console.error('Failed to load schedule from DB:', err);
      }
      return false;
    };

    // 3. Tiến hành khởi tạo dữ liệu
    const initData = async () => {
      const loadedFromDB = await fetchScheduleFromDB(storedUserId);
      
      const hasBeenUsed = localStorage.getItem('cardtkb_has_been_used') === 'true';
      
      // Nếu DB trống hoàn toàn và người dùng chưa từng dùng app (mới truy cập lần đầu)
      if (!loadedFromDB && !hasBeenUsed) {
        const initialCards = getInitialSampleCards();
        setCourseCards(initialCards);
        placeCard(initialCards[0].id);
        placeCard(initialCards[1].id);
        
        localStorage.setItem('cardtkb_has_been_used', 'true');
        
        // Đồng bộ ngầm bản mẫu này lên DB để khởi tạo
        try {
          await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: storedUserId,
              courseCards: initialCards,
              versions: [
                {
                  id: `version-default-${Date.now()}`,
                  semesterId: 'default-semester',
                  label: 'Phương án A',
                  placedCards: [
                    { id: `placed-${initialCards[0].id}-${Date.now()}`, courseCardId: initialCards[0].id, locked: false },
                    { id: `placed-${initialCards[1].id}-${Date.now()}`, courseCardId: initialCards[1].id, locked: false },
                  ]
                }
              ]
            })
          });
        } catch (e) {
          console.error('Silent sync initial cards failed:', e);
        }
      }
    };

    initData();
  }, [router]);

  // Hàm đồng bộ thời khóa biểu hiện tại lên Neon Database
  const syncScheduleToDB = async (overrideCards?: CourseCard[], overrideVersions?: any[]) => {
    if (!userId) return;
    setDbSyncLoading(true);
    setDbSyncMessage('Đang lưu TKB lên cloud...');
    try {
      const cardsToSync = overrideCards !== undefined ? overrideCards : courseCards;
      const versionsToSync = overrideVersions !== undefined ? overrideVersions : versions.map(v => {
        if (v.id === currentVersionId) {
          return { ...v, placedCards };
        }
        return v;
      });

      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          courseCards: cardsToSync,
          versions: versionsToSync,
        }),
      });

      if (res.ok) {
        setDbSyncMessage('Đã đồng bộ thành công lên Neon Database!');
        if (typeof window !== 'undefined') {
          localStorage.setItem('cardtkb_has_been_used', 'true');
        }
        setTimeout(() => setDbSyncMessage(''), 3000);
      } else {
        const data = await res.json();
        setDbSyncMessage(`Lỗi đồng bộ: ${data.error || 'Lỗi không xác định'}`);
        setTimeout(() => setDbSyncMessage(''), 5000);
      }
    } catch (err: any) {
      console.error('Failed to sync to DB:', err);
      setDbSyncMessage(`Lỗi kết nối: ${err.message}`);
      setTimeout(() => setDbSyncMessage(''), 5000);
    } finally {
      setDbSyncLoading(false);
    }
  };



  // ----------------------------------------------------
  // Xử lý Import bằng Paste Văn Bản
  // ----------------------------------------------------
  const handleTextImport = async () => {
    if (!textInput.trim()) {
      alert('Vui lòng dán văn bản thời khóa biểu trước.');
      return;
    }
    setPasteLoading(true);
    
    // Giả lập parser AI hoặc regex qua Gemini API. Ở đây ta gọi API OCR với ảnh giả lập chứa văn bản
    // hoặc đơn giản là tạo ra các card từ văn bản.
    // Để giữ tính năng đáng tin cậy: ta sẽ gửi text lên một mock parser hoặc xử lý regex đơn giản
    // nhằm tách mã môn, tên môn, nhóm, thứ, tiết, phòng.
    try {
      // Phân tích văn bản học phần đơn giản bằng Regex tiếng Việt phổ biến
      // Cú pháp mẫu: "IT001 Cấu trúc dữ liệu và giải thuật Nhóm IT001.N11 Thứ 2 Tiết 1-3 Phòng A.212 GV Nguyễn Văn A"
      const cards = parseRawTimetableText(textInput);
      if (cards.length > 0) {
        cards.forEach((c) => addCourseCard(c));
        confetti({ particleCount: 80, spread: 60 });
        setTextInput('');
        setActiveTab('cards');
      } else {
        alert('Không tìm thấy môn học nào hợp lệ từ văn bản dán vào. Vui lòng kiểm tra lại định dạng mẫu.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi phân tích văn bản.');
    } finally {
      setPasteLoading(false);
    }
  };

  // 1. Tải danh sách user chat
  const fetchChatUsers = async () => {
    setChatUsersLoading(true);
    try {
      const token = localStorage.getItem('cardtkb_token');
      const res = await fetch('/api/chat/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChatUsers(data.users);
        }
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách user chat:', err);
    } finally {
      setChatUsersLoading(false);
    }
  };

  // 2. Tải tin nhắn chat hai chiều
  const fetchChatMessages = async (receiverId: string) => {
    try {
      const token = localStorage.getItem('cardtkb_token');
      const res = await fetch(`/api/chat?receiverId=${receiverId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChatMessages(data.messages);
        }
      }
    } catch (err) {
      console.error('Lỗi lấy tin nhắn:', err);
    }
  };

  // 3a. Upload file/ảnh đính kèm
  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    const fileType: 'image' | 'document' | 'other' = isImage ? 'image' : 'document';
    setChatAttachment({ file, previewUrl, fileType });
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  };

  const handleRemoveChatAttachment = () => {
    if (chatAttachment?.previewUrl) URL.revokeObjectURL(chatAttachment.previewUrl);
    setChatAttachment(null);
  };

  // 3b. Gửi tin nhắn mới (hỗ trợ text + file)
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUser) return;
    if (!chatInput.trim() && !chatAttachment) return;

    const content = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    let uploadedFileUrl: string | null = null;
    let uploadedFileType: string | null = null;
    let uploadedFileName: string | null = null;

    // Upload file trước nếu có
    if (chatAttachment) {
      setChatUploadLoading(true);
      try {
        const token = localStorage.getItem('cardtkb_token');
        const formData = new FormData();
        formData.append('file', chatAttachment.file);
        const uploadRes = await fetch('/api/chat/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.success) {
            uploadedFileUrl  = uploadData.url;
            uploadedFileType = uploadData.fileType;
            uploadedFileName = uploadData.fileName;
          }
        } else {
          alert('Lỗi upload file. Vui lòng thử lại.');
          setChatLoading(false);
          setChatUploadLoading(false);
          return;
        }
      } catch (err) {
        console.error('Lỗi upload:', err);
        setChatLoading(false);
        setChatUploadLoading(false);
        return;
      } finally {
        setChatUploadLoading(false);
        handleRemoveChatAttachment();
      }
    }

    try {
      const token = localStorage.getItem('cardtkb_token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedChatUser.id,
          content,
          fileUrl:  uploadedFileUrl,
          fileType: uploadedFileType,
          fileName: uploadedFileName,
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChatMessages((prev) => [...prev, data.message]);
          setTimeout(() => {
            const chatBox = document.getElementById('chat-messages-container');
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
          }, 100);
        }
      }
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
    } finally {
      setChatLoading(false);
    }
  };

  // 4. Polling tin nhắn mỗi 3 giây
  useEffect(() => {
    if (!selectedChatUser) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Lấy tin nhắn ngay khi click chọn user
    fetchChatMessages(selectedChatUser.id).then(() => {
      setTimeout(() => {
        const chatBox = document.getElementById('chat-messages-container');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 150);
    });

    pollingRef.current = setInterval(() => {
      fetchChatMessages(selectedChatUser.id);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedChatUser]);

  // Tải danh sách user khi mount trang thành công
  useEffect(() => {
    if (userId) {
      fetchChatUsers();
    }
  }, [userId]);

  // 5. Xuất hình ảnh PNG thời khóa biểu (Client-side Canvas capture)
  const handleExportImage = async () => {
    const captureElement = document.getElementById('tkb-board-capture-area');
    if (!captureElement) {
      alert('Không tìm thấy vùng bàn cờ để xuất ảnh. Vui lòng kiểm tra lại hiển thị.');
      return;
    }

    try {
      setDbSyncMessage('Đang chuyển đổi và chụp ảnh TKB...');
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(captureElement, {
        backgroundColor: '#090d16',
        scale: 2.2, // Tăng phân giải cho căng đét
        useCORS: true,
        allowTaint: true,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `TKB_CardTKB_${Date.now()}.png`;
      link.click();
      confetti({ particleCount: 50, spread: 45 });
      setDbSyncMessage('✅ Đã xuất ảnh PNG thành công!');
      setTimeout(() => setDbSyncMessage(''), 3000);
    } catch (err: any) {
      console.error('Lỗi xuất ảnh:', err);
      alert('Lỗi xuất ảnh: ' + err.message);
      setDbSyncMessage('');
    }
  };

  // 6. Xuất bảng dữ liệu Excel (.xls) gộp ô
  const handleExportExcel = () => {
    if (placedCards.length === 0) {
      alert('Bàn cờ trống! Vui lòng xếp môn học lên lịch trước khi xuất Excel.');
      return;
    }

    // Khởi tạo lưới 12 tiết học x 7 ngày
    const gridText: string[][] = Array.from({ length: 12 }, () => Array(7).fill(''));
    const detailsGrid: any[][] = Array.from({ length: 12 }, () => Array(7).fill(null));

    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        card.sessions.forEach((s) => {
          const colIdx = s.dayOfWeek - 2; // Thứ 2 là 0
          if (colIdx >= 0 && colIdx < 7) {
            for (let p = s.startPeriod - 1; p < s.endPeriod; p++) {
              if (p >= 0 && p < 12) {
                gridText[p][colIdx] = `${card.subjectName}\n(${card.subjectCode} - ${card.classCode})\nPhòng: ${s.room || 'TBA'}\nGV: ${card.teacher || 'TBA'}`;
                detailsGrid[p][colIdx] = {
                  card,
                  session: s,
                  start: s.startPeriod - 1,
                  span: s.endPeriod - s.startPeriod + 1
                };
              }
            }
          }
        });
      }
    });

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1.5px solid #334155; padding: 12px; font-size: 13px; }
          td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 11px; white-space: pre-line; line-height: 1.4; }
          .time-col { background-color: #f8fafc; font-weight: bold; width: 90px; color: #475569; }
          .course-cell { background-color: #f0fdf4; color: #166534; font-weight: 600; border: 1.5px solid #bbf7d0; }
        </style>
      </head>
      <body>
        <h2 style="font-family: 'Segoe UI', sans-serif; color: #0f172a;">THỜI KHÓA BIỂU CÁ NHÂN</h2>
        <p style="font-size: 11px; color: #64748b;">Xuất từ ứng dụng 3D CardTKB vào lúc ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Tiết học</th>
              <th>Thứ 2</th>
              <th>Thứ 3</th>
              <th>Thứ 4</th>
              <th>Thứ 5</th>
              <th>Thứ 6</th>
              <th>Thứ 7</th>
              <th>Chủ Nhật</th>
            </tr>
          </thead>
          <tbody>
    `;

    const rendered = Array.from({ length: 12 }, () => Array(7).fill(false));

    for (let r = 0; r < 12; r++) {
      html += `<tr><td class="time-col">Tiết ${r + 1}</td>`;
      for (let c = 0; c < 7; c++) {
        if (rendered[r][c]) continue;

        const info = detailsGrid[r][c];
        if (info && info.start === r) {
          const span = info.span;
          for (let sp = 0; sp < span; sp++) {
            if (r + sp < 12) rendered[r + sp][c] = true;
          }
          html += `<td class="course-cell" rowspan="${span}">${gridText[r][c]}</td>`;
        } else if (!info) {
          html += `<td></td>`;
        }
      }
      html += `</tr>`;
    }

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CardTKB_Excel_${Date.now()}.xls`;
    link.click();
    confetti({ particleCount: 50, spread: 45 });
  };

  // 7. Xuất file backup JSON
  const handleExportJSON = () => {
    if (courseCards.length === 0) {
      alert('Không có dữ liệu môn học nào để xuất!');
      return;
    }
    const backup = {
      courseCards,
      versions,
      placedCards,
      exportedAt: new Date().toISOString(),
      app: 'CardTKB-3D'
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CardTKB_Backup_${Date.now()}.json`;
    link.click();
    confetti({ particleCount: 50, spread: 45 });
  };

  // ----------------------------------------------------
  // Thống kê & Kiểm tra giới hạn (Stats Panel)
  // ----------------------------------------------------
  const currentSemesterStats = () => {
    let totalCredits = 0;
    const studyDays = new Set<number>();
    let maxContinuousPeriods = 0; // Số tiết học liên tục dài nhất
    
    // Thu thập các session đã được đặt trên bàn cờ
    const placedSessions: Session[] = [];
    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (card) {
        totalCredits += 3; // Giả định mỗi môn là 3 tín chỉ
        card.sessions.forEach((s) => {
          placedSessions.push(s);
          studyDays.add(s.dayOfWeek);
        });
      }
    });

    // Tính số tiết học liên tục trong cùng 1 ngày
    for (let day = 2; day <= 8; day++) {
      const daySessions = placedSessions.filter((s) => s.dayOfWeek === day);
      if (daySessions.length === 0) continue;

      // Sắp xếp các tiết học trong ngày tăng dần
      daySessions.sort((a, b) => a.startPeriod - b.startPeriod);
      
      let currentContinuous = 0;
      let prevEnd = -1;

      daySessions.forEach((s) => {
        if (prevEnd === -1) {
          currentContinuous = s.endPeriod - s.startPeriod + 1;
        } else if (s.startPeriod <= prevEnd + 1) {
          // Buổi học liền kề hoặc trùng nhau
          currentContinuous += s.endPeriod - Math.max(s.startPeriod, prevEnd) + 1;
        } else {
          // Có khoảng trống nghỉ
          maxContinuousPeriods = Math.max(maxContinuousPeriods, currentContinuous);
          currentContinuous = s.endPeriod - s.startPeriod + 1;
        }
        prevEnd = s.endPeriod;
      });
      maxContinuousPeriods = Math.max(maxContinuousPeriods, currentContinuous);
    }

    return {
      totalCredits,
      studyDaysCount: studyDays.size,
      maxContinuousPeriods,
      hasLongStudyWarning: maxContinuousPeriods >= 5,
    };
  };

  const stats = currentSemesterStats();

  // ----------------------------------------------------
  // Export lịch học sang file ICS (Google Calendar)
  // ----------------------------------------------------
  const handleExportICS = () => {
    if (placedCards.length === 0) {
      alert('Bàn cờ thời khóa biểu hiện đang trống. Hãy xếp lịch trước khi xuất file.');
      return;
    }

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CardTKB//Timetable Calendar//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n') + '\r\n';

    // Ngày bắt đầu học kỳ và số tuần do người dùng chọn cấu hình
    const startDate = new Date(icsStartDate);
    const weeksCount = icsWeeksCount;

    placedCards.forEach((placed) => {
      const card = courseCards.find((c) => c.id === placed.courseCardId);
      if (!card) return;

      card.sessions.forEach((session) => {
        // Tính toán ngày diễn ra buổi học đầu tiên khớp với dayOfWeek (Thứ 2 = 2, Thứ 3 = 3...)
        const firstSessionDate = new Date(startDate);
        const currentDay = firstSessionDate.getDay(); // 0: CN, 1: T2, ..., 6: T7
        const targetDay = session.dayOfWeek === 8 ? 0 : session.dayOfWeek - 1; // Quy đổi sang JS day
        
        let diff = targetDay - currentDay;
        if (diff < 0) diff += 7;
        firstSessionDate.setDate(firstSessionDate.getDate() + diff);

        // Quy đổi tiết học sang giờ thực tế:
        const periodHours: { [key: number]: { start: string; end: string } } = {
          1: { start: '070000', end: '075000' },
          2: { start: '075000', end: '084000' },
          3: { start: '090000', end: '095000' },
          4: { start: '095000', end: '104000' },
          5: { start: '104000', end: '113000' },
          6: { start: '130000', end: '135000' },
          7: { start: '135000', end: '144000' },
          8: { start: '150000', end: '155000' },
          9: { start: '155000', end: '164000' },
          10: { start: '164000', end: '173000' },
          11: { start: '180000', end: '185000' },
          12: { start: '185000', end: '194000' },
        };

        const times = periodHours[session.startPeriod] || { start: '070000', end: '095000' };
        const endTimes = periodHours[session.endPeriod] || times;

        const dateStr = firstSessionDate.toISOString().slice(0, 10).replace(/-/g, '');
        const dtStart = `${dateStr}T${times.start}`;
        const dtEnd = `${dateStr}T${endTimes.end}`;

        // Cấu hình lặp tuần chẵn lẻ
        let rrule = `FREQ=WEEKLY;COUNT=${weeksCount};BYDAY=${getICSDayCode(session.dayOfWeek)}`;
        if (session.weekParity === 'odd' || session.weekParity === 'even') {
          rrule += ';INTERVAL=2'; // Lặp cách tuần
        }

        const uid = `cardtkb-event-${card.id}-${session.id}-${Date.now()}@cardtkb.app`;

        const event = [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
          `DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`,
          `DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`,
          `RRULE:${rrule}`,
          `SUMMARY:${card.subjectName} (${card.classCode})`,
          `LOCATION:${session.room || 'Phòng học ảo'}`,
          `DESCRIPTION:Giảng viên: ${card.teacher || 'Chưa cập nhật'}\\nLoại buổi học: ${session.sessionType === 'lab' ? 'Thực hành' : 'Lý thuyết'}\\nTuần học: ${session.weekParity === 'all' ? 'Tất cả' : session.weekParity === 'odd' ? 'Tuần Lẻ' : 'Tuần Chẵn'}`,
          'END:VEVENT'
        ].join('\r\n') + '\r\n';

        icsContent += event;
      });
    });

    icsContent += 'END:VCALENDAR';

    // Tạo file download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `TKB_CardTKB_${versions.find(v => v.id === currentVersionId)?.label || 'Plan'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getICSDayCode = (day: number) => {
    const codes: { [key: number]: string } = {
      2: 'MO', 3: 'TU', 4: 'WE', 5: 'TH', 6: 'FR', 7: 'SA', 8: 'SU'
    };
    return codes[day] || 'MO';
  };

  // Sao chép link chia sẻ
  const copyShareLink = () => {
    const fakeLink = `${window.location.origin}/share/tkb-draft-73948293`;
    navigator.clipboard.writeText(fakeLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Group các courseCard trong kho để hiển thị dạng cỗ bài (stack)
  const groupedCards = useMemo(() => {
    const groups: { [key: string]: CourseCard[] } = {};
    courseCards.forEach((c) => {
      if (!groups[c.subjectCode]) {
        groups[c.subjectCode] = [];
      }
      groups[c.subjectCode].push(c);
    });
    return groups;
  }, [courseCards]);

  if (authChecking) {
    return (
      <div className="w-screen h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm tracking-widest animate-pulse font-bold">ĐANG KẾT NỐI KHÔNG GIAN 3D...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100">
      
      {/* ====================================================
          LEFT SIDEBAR: KHO BÀI (DECK) & IMPORT PANEL
          ==================================================== */}
      <div className="w-full lg:w-96 flex flex-col border-r border-slate-800 bg-[#0c1221] shrink-0 z-20">
        
        {/* Logo & Version Selector */}
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <img
                src="/nhandev-logo.png"
                alt="NhânDev Logo"
                className="h-10 w-10 rounded-lg object-contain bg-white p-0.5"
              />
              <div>
                <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  CardTKB
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono max-w-[150px] truncate" title={myUserId}>
                  ID: {myUserId || 'Chưa rõ'}
                </p>
              </div>
            </div>
            {/* Điều hướng Profile và Đăng xuất */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenProfileModal}
                title="Thông tin tài khoản"
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors border border-slate-800 cursor-pointer"
              >
                <UserIcon className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('cardtkb_token');
                  localStorage.removeItem('cardtkb_user_id');
                  localStorage.removeItem('cardtkb_email');
                  localStorage.removeItem('cardtkb_semester_id');
                  router.push('/login');
                }}
                title="Đăng xuất khỏi hệ thống"
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-800 cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Draft Versions dropdown */}
          <div className="flex gap-2">
            <select
              value={currentVersionId}
              onChange={(e) => switchVersion(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 grow focus:outline-none focus:border-cyan-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.placedCards.length} thẻ)
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const name = prompt('Nhập tên phương án mới:');
                if (name) addVersion(name);
              }}
              title="Tạo phương án mới"
              className="bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 transition-colors"
            >
              +
            </button>
            {versions.length > 1 && (
              <button
                onClick={() => deleteVersion(currentVersionId)}
                title="Xóa phương án hiện tại"
                className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 px-2 py-1.5 rounded-lg text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>



        {/* Tab Selector */}
        <div className="flex border-b border-slate-800/80 px-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'cards' 
                ? 'border-cyan-500 text-cyan-400 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🎴 Kho Thẻ ({courseCards.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'import' 
                ? 'border-cyan-500 text-cyan-400 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📥 Import TKB
          </button>
          <button
            onClick={() => setActiveTab('coop')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'coop' 
                ? 'border-cyan-500 text-cyan-400 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 Co-Op
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: KHO THẺ BÀI */}
          {activeTab === 'cards' && (
            <div className="space-y-4">
              {courseCards.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
                  <BookOpen className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Chưa có môn học nào trong kho bài.</p>
                  <button
                    onClick={() => setActiveTab('import')}
                    className="mt-3 text-xs text-cyan-400 font-bold hover:underline"
                  >
                    Import dữ liệu ngay ➡️
                  </button>
                </div>
              ) : (
                Object.keys(groupedCards).map((subjectCode) => {
                  const subjectCards = groupedCards[subjectCode];
                  const firstCard = subjectCards[0];
                  
                  // Kiểm tra xem đã có card nào thuộc môn này được đặt trên bàn cờ chưa
                  const placedCard = placedCards.find((p) => 
                    subjectCards.some((sc) => sc.id === p.courseCardId)
                  );

                  return (
                    <div 
                      key={subjectCode} 
                      className="p-3 bg-slate-900/70 border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition-all"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-950`}
                                style={{ borderColor: COLOR_MAP[firstCard.colorRamp], color: COLOR_MAP[firstCard.colorRamp] }}>
                            {firstCard.subjectCode}
                          </span>
                          <h3 className="text-sm font-bold mt-1 text-slate-200">{firstCard.subjectName}</h3>
                        </div>
                      </div>

                      {/* Các Nhóm Lớp Học Phần có sẵn (Stack cards) */}
                      <div className="space-y-2 mt-3">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">CÁC LỚP HỌC PHẦN:</p>
                        {subjectCards.map((card) => {
                          const isCurrentlyPlaced = placedCards.some((p) => p.courseCardId === card.id);
                          const currentPlacedInfo = placedCards.find((p) => p.courseCardId === card.id);
                          
                          return (
                            <div 
                              key={card.id}
                              onClick={() => setSelectedCard(card)}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                isCurrentlyPlaced 
                                  ? 'bg-slate-800 border border-cyan-500/50 text-cyan-400 font-semibold' 
                                  : 'bg-slate-950/60 border border-slate-900 hover:bg-slate-850 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="font-bold truncate">{card.classCode}</div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  👤 {card.teacher || 'TBA'} • 🏢 {card.sessions.map(s => `${s.room || 'TBA'}`).join(', ')}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {isCurrentlyPlaced ? (
                                  <>
                                    <button
                                      onClick={() => toggleLockCard(card.id)}
                                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                      title={currentPlacedInfo?.locked ? "Mở khóa thẻ" : "Khóa thẻ trên lịch"}
                                    >
                                      {currentPlacedInfo?.locked ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Unlock className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      onClick={() => removePlacedCard(card.id)}
                                      className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 text-[10px] font-bold"
                                    >
                                      THU HỒI
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => placeCard(card.id)}
                                    disabled={!!placedCard} // Chỉ cho phép đặt tối đa 1 nhóm của môn này lên bàn cờ cùng lúc
                                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                                      placedCard 
                                        ? 'bg-slate-900 text-slate-600 border border-slate-950 cursor-not-allowed'
                                        : 'bg-cyan-950/50 hover:bg-cyan-900/80 border border-cyan-900/50 text-cyan-400'
                                    }`}
                                  >
                                    XẾP LỊCH
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: IMPORT PANEL */}
          {activeTab === 'import' && (
            <div className="space-y-4">

              {/* Option 2: Nâng cấp Raw Text Parser */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    ✍️ Nhập Văn Bản Thô
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 font-bold tracking-wide">
                    Khuyên dùng
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Copy toàn bộ thời khóa biểu từ trang cá nhân trường của bạn, dán vào khung bên dưới. Hệ thống tự động bóc tách các môn học.
                </p>

                {/* Hướng dẫn định dạng mẫu */}
                <div className="bg-slate-950/70 border border-slate-800/60 rounded-lg p-2.5 space-y-1">
                  <p className="text-[10px] text-cyan-400 font-bold mb-1">📌 Định dạng mẫu:</p>
                  <pre className="text-[9.5px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{`INT2208 Cấu trúc dữ liệu & Giải thuật
Mã nhóm: INT2208.N12.1
Thứ 3, Tiết 1-3, Phòng 301-G3, GV Nguyễn Văn A
Thứ 5, Tiết 7-9 (Thực hành), Phòng PM.302`}</pre>
                </div>

                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Dán nội dung TKB vào đây..."
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/20 resize-none font-mono transition-colors placeholder:text-slate-700"
                />

                {/* Thanh hành động */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTextInput('')}
                    disabled={!textInput || pasteLoading}
                    className="flex-shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition-colors border border-slate-700"
                  >
                    XÓA
                  </button>
                  <button
                    onClick={handleTextImport}
                    disabled={pasteLoading || !textInput.trim()}
                    className="flex-1 py-2 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-600 text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border border-slate-600"
                  >
                    {pasteLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    BÓC TÁCH & NHẬP VÀO KHO
                  </button>
                </div>
              </div>

              {/* Mẹo sử dụng */}
              <div className="p-3 bg-slate-950/80 border border-slate-900/60 rounded-xl">
                <h4 className="text-[10px] font-bold text-cyan-400 mb-2 flex items-center gap-1">
                  <Info className="h-3 w-3" /> MẸO SỬ DỤNG
                </h4>
                <ul className="space-y-1.5 text-[10px] text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 shrink-0 mt-0.5">▸</span> Có thể dán nhiều môn học liên tiếp trong cùng một lần dán.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 shrink-0 mt-0.5">▸</span> Sau khi bóc tách xong, sang tab <strong className="text-slate-300">Kho bài</strong> để bắt đầu xếp lịch.</li>
                </ul>
              </div>

            </div>
          )}

          {/* TAB: CO-OP LOBBY */}
          {activeTab === 'coop' && (
            <div className="space-y-4">
              {!coopActive ? (
                // Giao diện khi CHƯA vào phòng
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      🛰️ Sảnh Co-Op Vũ Trụ
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Kết nối bàn cờ thời khóa biểu 3D của bạn với bạn bè hoặc người yêu theo thời gian thực.
                    </p>
                  </div>

                  {/* Nút Tạo Phòng */}
                  <button
                    onClick={handleCreateLobby}
                    disabled={coopLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer border border-cyan-400/30"
                  >
                    {coopLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : '🚀 TẠO PHÒNG VŨ TRỤ'}
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-slate-600 text-[10px] font-bold">HOẶC THAM GIA</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  {/* Nhập mã vào phòng */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nhập mã phòng ví dụ: ROOM-ABCD"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 text-center font-mono font-bold placeholder:font-sans placeholder:font-normal"
                    />
                    <button
                      onClick={handleJoinLobby}
                      disabled={coopLoading || !joinRoomId.trim()}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-xl text-xs font-bold transition-colors border border-slate-700 cursor-pointer"
                    >
                      {coopLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'THAM GIA PHÒNG'}
                    </button>
                  </div>
                </div>
              ) : (
                // Giao diện khi ĐÃ ở trong phòng
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PHÒNG CO-OP HIỆN TẠI:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-black text-cyan-400 font-mono tracking-wider">{activeLobbyId}</span>
                        <button
                          onClick={() => {
                            if (activeLobbyId) {
                              navigator.clipboard.writeText(activeLobbyId);
                              alert('Đã copy mã phòng!');
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[9px] font-bold border border-slate-750 transition-colors cursor-pointer"
                        >
                          COPY
                        </button>
                      </div>
                    </div>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>

                  {/* Danh sách thành viên */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">THÀNH VIÊN ONLINE ({lobbyMembers.length}):</p>
                    <div className="space-y-1.5">
                      {lobbyMembers.map((m) => {
                        const isMe = m.userId === localStorage.getItem('cardtkb_user_id');
                        return (
                          <div 
                            key={m.id}
                            className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-850 rounded-xl"
                          >
                            <div className="flex items-center gap-2">
                              {/* Avatar phi thuyền nhỏ */}
                              <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm"
                                style={{ backgroundColor: m.color + '20', border: `1px solid ${m.color}`, color: m.color }}
                              >
                                🛸
                              </div>
                              <span className={`text-xs font-semibold ${isMe ? 'text-cyan-400' : 'text-slate-300'}`}>
                                {m.username} {isMe && '(Bạn)'}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              ONLINE
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nút Rời Phòng */}
                  <button
                    onClick={handleLeaveLobby}
                    className="w-full py-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    RỜI PHÒNG VŨ TRỤ
                  </button>
                </div>
              )}

              {/* Mẹo sử dụng */}
              <div className="p-3 bg-slate-950/80 border border-slate-900/60 rounded-xl">
                <h4 className="text-[10px] font-bold text-cyan-400 mb-2 flex items-center gap-1">
                  <Info className="h-3 w-3" /> HƯỚNG DẪN CO-OP
                </h4>
                <ul className="space-y-1.5 text-[10px] text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 shrink-0 mt-0.5">▸</span> Tạo phòng hoặc nhập mã phòng của bạn bè để hợp thể thời khóa biểu.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 shrink-0 mt-0.5">▸</span> Khi vào phòng, phi thuyền của từng người sẽ bay quanh bàn cờ 3D.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 shrink-0 mt-0.5">▸</span> Các ô rảnh chung của cả nhóm sẽ mở ra các **Cổng Không Gian phát sáng xanh lục**.</li>
                </ul>
              </div>
            </div>
          )}


        </div>

        {/* THỐNG KÊ (BOTTOM SIDEBAR) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-4">
          {/* Xóa Dữ Liệu */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              💾 Xóa Dữ Liệu
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Khi dọn dẹp hoặc chuyển đổi sang học kỳ mới, bạn có thể xóa toàn bộ dữ liệu hiện có trong kho bài và bàn cờ để bắt đầu lại.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              XÓA TẤT CẢ DỮ LIỆU KHO BÀI
            </button>
          </div>

          <hr className="border-slate-800/80" />

          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">📊 THỐNG KÊ TKB</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-900">
              <div className="text-slate-400 text-[10px]">Tổng tín chỉ</div>
              <div className="text-sm font-bold text-cyan-400 mt-0.5">{stats.totalCredits} TC</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-900">
              <div className="text-slate-400 text-[10px]">Số ngày đi học</div>
              <div className="text-sm font-bold text-cyan-400 mt-0.5">{stats.studyDaysCount} ngày/tuần</div>
            </div>
          </div>
          
          {stats.hasLongStudyWarning && (
            <div className="mt-2.5 p-2 bg-amber-950/30 border border-amber-900/40 rounded-lg flex gap-2 items-start text-[10px] text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <span className="font-bold">Cảnh báo:</span> Có ngày học liên tục {stats.maxContinuousPeriods} tiết dài không nghỉ trưa! Hãy sắp xếp lại để có năng lượng học tốt nhất.
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ====================================================
          CENTER: 3D BOARD CANVAS
          ==================================================== */}
      <div className="flex-1 flex flex-col h-full relative">
        <div id="tkb-board-capture-area" className="flex-1 p-4 pb-2 relative">
          {isMounted ? (
            <>
              <CardBoard3D 
                onSelectCard={(card) => setSelectedCard(card)} 
                compareCourseCards={compareCourseCards} 
                cameraTarget={cameraTarget}
              />
              
              {/* WIDGET HOLOGRAM ĐỊNH VỊ CA HỌC TIẾP THEO */}
              {(() => {
                if (!nextSession) {
                  return (
                    <div className="absolute bottom-6 left-6 z-10 p-3 bg-slate-950/85 backdrop-blur-md border border-slate-850 rounded-xl max-w-[200px] text-[10px] text-slate-500 font-semibold shadow-lg select-none">
                      ☄️ Hệ thống định vị sẵn sàng. Vui lòng đặt môn lên bàn cờ để phi hành!
                    </div>
                  );
                }

                const { card, session } = nextSession;
                const handleFocusSession3D = () => {
                  const cIdx = session.dayOfWeek - 2;
                  const rIdx = session.startPeriod - 1;
                  const x = - (7 * 1.3) / 2 + (cIdx + 0.5) * 1.3;
                  const z = - (12 * 0.65) / 2 + (rIdx + 0.5) * 0.65;
                  setCameraTarget([x, 0.3, z]);
                  setTimeout(() => setCameraTarget(null), 3000);
                };

                return (
                  <div 
                    className="absolute bottom-6 left-6 z-10 p-3 bg-slate-950/90 backdrop-blur-md border border-cyan-800/50 rounded-xl w-64 shadow-[0_0_20px_rgba(6,182,212,0.12)] flex flex-col gap-2 select-none border-l-4 border-l-cyan-500"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyan-400 tracking-wider">🛰️ ĐỊNH VỊ CA HỌC TIẾP THEO</span>
                      <button 
                        onClick={handleFocusSession3D}
                        title="Định vị và phóng camera 3D cận cảnh môn học"
                        className="p-1 rounded bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-900 transition-colors text-cyan-400 cursor-pointer flex items-center justify-center"
                      >
                        <Video className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 truncate leading-tight">{card.subjectName}</h4>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                        <span>Thứ {session.dayOfWeek === 8 ? 'CN' : session.dayOfWeek}</span>
                        <span>•</span>
                        <span>Tiết {session.startPeriod}-{session.endPeriod}</span>
                        <span>•</span>
                        <span className="text-cyan-300">Phòng {session.room || 'TBA'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="w-full h-full bg-[#090d16] rounded-xl border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-t-cyan-400 border-slate-800 animate-spin" />
              <p className="text-xs font-semibold animate-pulse">ĐANG KHỞI TẠO BÀN CỜ 3D...</p>
            </div>
          )}
        </div>

        {/* CONTROLS BAR (BOTTOM MIDDLE) */}
        <div className="px-4 py-3 bg-[#0c1221] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
          <div className="flex items-center flex-wrap gap-3">
            <div className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Lưu nháp:</span> {placedCards.length} thẻ bài đã được đặt lên bàn cờ.
            </div>
            {dbSyncMessage && (
              <span className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded animate-pulse">
                {dbSyncMessage}
              </span>
            )}
            {/* Cấu hình Groq API Key (Tùy chọn di chuyển) */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-850 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] text-slate-500 font-semibold" title="Groq API Key dùng để trò chuyện với Leo">🔑 GROQ KEY:</span>
              <input
                type="password"
                placeholder="gsk_..."
                value={groqKeyInput}
                onChange={(e) => {
                  setGroqKeyInput(e.target.value);
                  localStorage.setItem('cardtkb_groq_api_key', e.target.value);
                }}
                className="bg-transparent text-[10px] text-slate-300 focus:outline-none w-28 font-mono border-b border-transparent focus:border-cyan-500/50"
              />
              {groqKeyInput && (
                <button
                  onClick={() => {
                    setGroqKeyInput('');
                    localStorage.removeItem('cardtkb_groq_api_key');
                  }}
                  className="text-[9px] text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer"
                  title="Xóa API Key"
                >
                  XÓA
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncScheduleToDB()}
              disabled={dbSyncLoading}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all text-slate-200 disabled:opacity-50"
            >
              <Cloud className={`h-4 w-4 ${dbSyncLoading ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
              {dbSyncLoading ? 'ĐANG LƯU...' : 'LƯU LÊN CLOUD'}
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-slate-900 px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md neon-glow-cyan"
            >
              <Share2 className="h-4 w-4" />
              CHIA SẺ TKB
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================
          RIGHT PANEL: UTILITY HUB (CHAT & EXPORTS)
          ==================================================== */}
      <div className="w-full lg:w-80 flex flex-col border-l border-slate-800 bg-[#0c1221] shrink-0 z-20 overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
          <button
            onClick={() => setActiveRightTab('chat')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeRightTab === 'chat'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            TRÒ CHUYỆN
          </button>
          <button
            onClick={() => setActiveRightTab('export')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeRightTab === 'export'
                ? 'bg-slate-900 text-cyan-400 border border-slate-800'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <Download className="h-4 w-4" />
            LƯU & XUẤT BẢN
          </button>
        </div>

        {/* Tab Content: CHAT */}
        {activeRightTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedChatUser ? (
              // 1. Danh sách Users để chat cùng
              <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
                <div className="flex gap-2 items-center shrink-0">
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Tìm kiếm bạn bè..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/70 placeholder:text-slate-700"
                    />
                  </div>
                  <button
                    onClick={handleOpenFriendManager}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-400 rounded-lg transition-colors cursor-pointer"
                    title="Quản lý bạn bè & Lời mời"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {chatUsersLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-cyan-500" />
                      <span className="text-[10px]">Đang kết nối bạn bè...</span>
                    </div>
                  ) : chatUsers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] text-center p-4">
                      Chưa có bạn bè nào. Hãy nhấn tìm kiếm kết bạn để bắt đầu trò chuyện!
                    </div>
                  ) : (
                    chatUsers
                      .filter((u) => {
                        const s = chatSearch.toLowerCase();
                        const displayName = u.username || u.email?.split('@')[0] || '';
                        return (
                          displayName.toLowerCase().includes(s) || 
                          u.email?.toLowerCase().includes(s) || 
                          u.university?.toLowerCase().includes(s)
                        );
                      })
                      .map((u) => {
                        const displayName = u.username || u.email?.split('@')[0] || 'Unknown';
                        const initLetters = displayName.substring(0, 2).toUpperCase();
                        return (
                          <div
                            key={u.id}
                            onClick={() => setSelectedChatUser(u)}
                            className="p-2.5 bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center gap-3 hover:bg-slate-850/40 group"
                          >
                            <div className="relative shrink-0 w-8 h-8 rounded-full bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 text-xs font-black group-hover:neon-glow-cyan">
                              {initLetters}
                              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#0c1221] rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-300 truncate group-hover:text-cyan-400 transition-colors">
                                {displayName}
                              </div>
                              <div className="text-[9px] text-slate-500 truncate mt-0.5 uppercase tracking-wider">
                                🏫 {u.university || 'Tự do'}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ) : (
              // 2. Cửa sổ chat riêng tư
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header chat */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => {
                        setSelectedChatUser(null);
                        setCompareUserId(null);
                        setCompareCourseCards([]);
                      }}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white shrink-0"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate">{selectedChatUser.username || selectedChatUser.email.split('@')[0]}</div>
                      <div className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Đang trực tuyến
                      </div>
                    </div>
                  </div>

                  {/* Nút Ghép Lịch Nhóm */}
                  <button
                    onClick={async () => {
                      if (compareUserId === selectedChatUser.id) {
                        setCompareUserId(null);
                        setCompareCourseCards([]);
                      } else {
                        setCompareUserId(selectedChatUser.id);
                        setCompareCourseCards([]);
                        try {
                          const res = await fetch(`/api/schedule?userId=${selectedChatUser.id}`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.courseCards && data.courseCards.length > 0) {
                              setCompareCourseCards(data.courseCards);
                              confetti({ particleCount: 40, spread: 30 });
                            } else {
                              alert('Người bạn này chưa xếp lịch học nào trên hệ thống.');
                            }
                          } else {
                            alert('Không lấy được dữ liệu thời khóa biểu.');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Lỗi kết nối trạm máy chủ.');
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all flex items-center gap-1 border cursor-pointer ${
                      compareUserId === selectedChatUser.id
                        ? 'bg-emerald-600 border-emerald-500 text-slate-900 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    ⚡ {compareUserId === selectedChatUser.id ? 'ĐANG SO KHỚP' : 'GHÉP LỊCH'}
                  </button>
                </div>

                {/* Bong bóng tin nhắn */}
                <div
                  id="chat-messages-container"
                  className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#080d16]/30"
                >
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-650 text-[10px] text-center p-4">
                      Bắt đầu cuộc trò chuyện học tập. Gửi lời chào đến bạn học ngay!
                    </div>
                  ) : (
                    chatMessages.map((m) => {
                      const isMe = m.senderId === userId;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words ${
                              isMe
                                ? 'bg-cyan-600/90 text-slate-950 rounded-tr-none font-medium'
                                : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                            }`}
                          >
                            {/* Nội dung file/ảnh đính kèm */}
                            {m.fileUrl && m.fileType === 'image' && (
                              <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                                <img
                                  src={m.fileUrl}
                                  alt={m.fileName || 'Ảnh'}
                                  className="rounded-xl max-w-full max-h-40 object-cover border border-white/10 hover:opacity-90 transition-opacity cursor-zoom-in"
                                />
                              </a>
                            )}
                            {m.fileUrl && m.fileType !== 'image' && (
                              <a
                                href={m.fileUrl}
                                download={m.fileName || 'file'}
                                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 border transition-colors ${
                                  isMe
                                    ? 'border-slate-900/50 bg-cyan-700/50 hover:bg-cyan-700/80 text-slate-900'
                                    : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate text-[10px] font-medium max-w-[120px]">{m.fileName || 'Tài liệu'}</span>
                                <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              </a>
                            )}
                            {/* Nội dung text */}
                            {m.content && <div>{m.content}</div>}
                            <div
                              className={`text-[8px] text-right mt-1 opacity-70 ${
                                isMe ? 'text-slate-900' : 'text-slate-500'
                              }`}
                            >
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Preview file trước khi gửi */}
                {chatAttachment && (
                  <div className="px-2 py-1.5 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
                    {chatAttachment.fileType === 'image' ? (
                      <img src={chatAttachment.previewUrl} alt="preview" className="h-10 w-10 rounded-lg object-cover border border-slate-700" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-violet-400" />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-300 truncate flex-1">{chatAttachment.file.name}</span>
                    <button
                      type="button"
                      onClick={handleRemoveChatAttachment}
                      className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Form nhập tin nhắn + Emoji Picker */}
                <div className="shrink-0 border-t border-slate-800 bg-[#0c1221] relative">

                  {/* EMOJI / STICKER PICKER PANEL */}
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-full left-0 right-0 bg-slate-950 border border-slate-800 rounded-t-xl shadow-2xl z-30"
                      style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}
                    >
                      {/* Tabs */}
                      <div className="flex border-b border-slate-800">
                        {(['emoji', 'sticker'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setEmojiTab(tab)}
                            className={`flex-1 py-2 text-xs font-bold transition-colors ${
                              emojiTab === tab
                                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-900/50'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {tab === 'emoji' ? '😄 Emoji' : '🌟 Sticker'}
                          </button>
                        ))}
                      </div>

                      {/* EMOJI TAB */}
                      {emojiTab === 'emoji' && (
                        <div className="p-2 max-h-44 overflow-y-auto">
                          {[
                            { label: '😀 Phổ biến', emojis: ['😀','😂','😄','🤣','🥰','😘','😍','🤗','😢','😡','😱','🤔','😎','🥳','😔','😴','😩','🙃','😐','😏'] },
                            { label: '❤️ Tình cảm', emojis: ['❤️','🧡','💛','💚','💙','💜','💖','💗','💞','💕','💟','💘','💌','💋','💏','💑','💓','😍','😘','🥷'] },
                            { label: '🎉 Lễ hội', emojis: ['🎉','🎈','🎂','🎆','🎇','🎁','🏆','🍎','🍜','🕺','💃','🎚️','🩞','🚀','✨','💫','💥','💦','⚡','🌈'] },
                            { label: '📚 Học tập', emojis: ['📚','📝','✏️','📋','🎓','🏅','🖥️','💻','🔍','💡','✅','❌','🚨','🚩','🔔','🏷️','📌','📱','⏰','📊'] },
                            { label: '🐶 Động vật', emojis: ['🐶','🐱','🦁','🐯','🐻','🐸','🐢','🐠','🦊','🦉','🦄','🐵','🐷','🐼','🐧','👧','🦸','🐉','🦖','🐺'] },
                          ].map((cat) => (
                            <div key={cat.label} className="mb-2">
                              <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1 px-1">{cat.label}</div>
                              <div className="flex flex-wrap gap-0.5">
                                {cat.emojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      setChatInput((prev) => prev + emoji);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-base transition-colors"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* STICKER TAB */}
                      {emojiTab === 'sticker' && (
                        <div className="p-2 max-h-44 overflow-y-auto">
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: '🚀 Hào hứng!',   bg: 'from-cyan-950 to-blue-950',   border: 'border-cyan-800/50',   icon: '🚀', text: 'Hào hứng!' },
                              { label: '💕 Yêu quá!',    bg: 'from-pink-950 to-rose-950',  border: 'border-pink-800/50',   icon: '💕', text: 'Yêu quá' },
                              { label: '🤣 Xin chào!',   bg: 'from-amber-950 to-yellow-950',border: 'border-amber-800/50', icon: '🤣', text: 'Hi~' },
                              { label: '💪 Gvô sứ!',   bg: 'from-emerald-950 to-green-950',border: 'border-emerald-800/50',icon: '💪', text: 'Gà thỳ!' },
                              { label: '❤️ Cảm ơn!',   bg: 'from-red-950 to-rose-950',   border: 'border-red-800/50',    icon: '❤️',  text: 'Thân mến~' },
                              { label: '😢 Buồn quá!',  bg: 'from-indigo-950 to-violet-950',border:'border-indigo-800/50', icon: '😢', text: 'Buồn lắm' },
                              { label: '🤔 Hỏi chút', bg: 'from-violet-950 to-purple-950',border:'border-violet-800/50',  icon: '🤔', text: 'Biết không?' },
                              { label: '🔥 Quá xịn!',  bg: 'from-orange-950 to-red-950', border: 'border-orange-800/50',  icon: '🔥', text: 'Xịn xò!' },
                              { label: '💤 Ngủ rồi',  bg: 'from-slate-900 to-gray-900',  border: 'border-slate-700/50',   icon: '💤', text: 'Ngủ đây' },
                              { label: '🎉 Cheer!',    bg: 'from-teal-950 to-cyan-950',  border: 'border-teal-800/50',    icon: '🎉', text: 'Hooray!' },
                              { label: '🙅 Không!',    bg: 'from-red-950 to-pink-950',   border: 'border-red-800/50',    icon: '🙅‍♀️', text: 'Không!' },
                              { label: '👍 OK!',       bg: 'from-lime-950 to-green-950', border: 'border-lime-800/50',    icon: '👍', text: 'OK!' },
                            ].map((sticker) => (
                              <button
                                key={sticker.label}
                                type="button"
                                onClick={async () => {
                                  if (!selectedChatUser) return;
                                  setShowEmojiPicker(false);
                                  const stickerText = `${sticker.icon} ${sticker.text}`;
                                  setChatLoading(true);
                                  try {
                                    const token = localStorage.getItem('cardtkb_token');
                                    const res = await fetch('/api/chat', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                      body: JSON.stringify({ receiverId: selectedChatUser.id, content: stickerText }),
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.success) {
                                        setChatMessages((prev) => [...prev, data.message]);
                                        setTimeout(() => {
                                          const chatBox = document.getElementById('chat-messages-container');
                                          if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
                                        }, 100);
                                      }
                                    }
                                  } finally { setChatLoading(false); }
                                }}
                                className={`bg-gradient-to-br ${sticker.bg} border ${sticker.border} rounded-xl p-2 flex flex-col items-center gap-1 hover:scale-105 transition-transform cursor-pointer`}
                              >
                                <span className="text-2xl">{sticker.icon}</span>
                                <span className="text-[8px] text-slate-400 font-bold truncate w-full text-center">{sticker.text}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                <form
                  onSubmit={handleSendChatMessage}
                  className="p-2 flex gap-1.5 items-center"
                >
                  {/* Input ẩn cho file */}
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    accept="*"
                    className="hidden"
                    onChange={handleChatFileSelect}
                  />
                  {/* Nút đính kèm file */}
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    title="Đính kèm file hoặc ảnh"
                    className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-colors shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                  {/* Nút Emoji/Sticker */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    title="Emoji & Sticker"
                    className={`p-2 rounded-lg border transition-colors shrink-0 text-base leading-none ${
                      showEmojiPicker
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    😄
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder={chatAttachment ? 'Thêm chú thích (tuỳ chọn)...' : 'Nhập tin nhắn...'}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-350 focus:outline-none focus:border-cyan-500/70"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || chatUploadLoading || (!chatInput.trim() && !chatAttachment)}
                    className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-900 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                  >
                    {chatUploadLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: EXPORTS */}
        {activeRightTab === 'export' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bạn có thể xuất và lưu trữ thời khóa biểu của mình dưới nhiều định dạng khác nhau để in ấn hoặc sao lưu dữ liệu.
            </p>

            {/* 1. Xuất Hình ảnh PNG */}
            <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-cyan-400" /> Xuất Ảnh TKB (PNG)
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Chụp ảnh màn hình toàn bộ khu vực bàn cờ thời khóa biểu hiện tại với độ phân giải cao để lưu về máy.
              </p>
              <button
                onClick={handleExportImage}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 hover:text-cyan-400 border border-slate-750 hover:border-cyan-900/60 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-300"
              >
                TẢI ẢNH TKB PNG
              </button>
            </div>

            {/* 2. Xuất file Excel .xls */}
            <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Xuất Lịch Excel (.xls)
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Xuất thời khóa biểu ra bảng tính Excel được định dạng hàng cột và gộp ca học chuyên nghiệp để lưu trữ ngoại tuyến.
              </p>
              <button
                onClick={handleExportExcel}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 hover:text-emerald-400 border border-slate-750 hover:border-emerald-900/60 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-300"
              >
                XUẤT FILE EXCEL
              </button>
            </div>

            {/* 3. Xuất file Backup JSON */}
            <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileJson className="h-4 w-4 text-violet-400" /> Sao Lưu Dữ Liệu (JSON)
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Tải file chứa cấu trúc dữ liệu thô (.json). Thích hợp để lưu trữ hoặc chia sẻ cho bạn bè import lại vào CardTKB.
              </p>
              <button
                onClick={handleExportJSON}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 hover:text-violet-400 border border-slate-750 hover:border-violet-900/60 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-300"
              >
                TẢI FILE BACKUP JSON
              </button>
            </div>

            {/* 4. Đồng bộ Google Calendar */}
            <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-amber-400" /> Google Calendar (.ics)
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Thiết lập thông tin học kỳ để xuất lịch học đồng bộ vào Google / Apple Calendar chuẩn xác:
              </p>
              
              {/* Form thiết lập xuất ICS */}
              <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 text-[10px]">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 font-semibold">Ngày bắt đầu học kỳ:</span>
                  <input
                    type="date"
                    value={icsStartDate}
                    onChange={(e) => setIcsStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono text-[10px] cursor-pointer"
                  />
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 font-semibold">Tổng số tuần học:</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={icsWeeksCount}
                    onChange={(e) => setIcsWeeksCount(parseInt(e.target.value) || 15)}
                    className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-500 text-center font-mono text-[10px]"
                  />
                </div>
              </div>

              <button
                onClick={handleExportICS}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 hover:text-amber-400 border border-slate-750 hover:border-amber-900/60 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-300"
              >
                TẢI FILE SỰ KIỆN .ICS
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ====================================================
          MODAL: CHI TIẾT THẺ BÀI (CARD DETAIL MODAL)
          ==================================================== */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl neon-glow-cyan">
            {/* Header màu theo colorRamp */}
            <div className="h-2 w-full" style={{ backgroundColor: COLOR_MAP[selectedCard.colorRamp] }} />
            
            {/* Nút đóng */}
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 p-1.5 rounded-full border border-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-5 space-y-4">
              {/* Thông tin chính */}
              <div>
                <span className="inline-block px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-xs font-bold text-cyan-400">
                  {selectedCard.subjectCode}
                </span>
                <h2 className="text-lg font-black text-slate-100 mt-1.5 leading-snug">{selectedCard.subjectName}</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Nhóm lớp: {selectedCard.classCode}</p>
              </div>

              {/* Chi tiết ca học */}
              <div className="space-y-2 bg-slate-900/50 p-3 rounded-xl border border-slate-900/80 text-xs">
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">🗓️ THỜI GIAN VÀ ĐỊA ĐIỂM:</p>
                {selectedCard.sessions.map((session, idx) => (
                  <div key={session.id} className="flex flex-col gap-0.5 py-1 border-b border-slate-850/60 last:border-b-0">
                    <div className="font-bold text-slate-200 flex justify-between">
                      <span>
                        Thứ {session.dayOfWeek === 8 ? 'Nhật' : session.dayOfWeek} (Tiết {session.startPeriod} - {session.endPeriod})
                      </span>
                      <span className={session.sessionType === 'lab' ? 'text-rose-400 font-semibold' : 'text-blue-400'}>
                        {session.sessionType === 'lab' ? 'Thực hành' : 'Lý thuyết'}
                      </span>
                    </div>
                    <div className="text-slate-400 flex items-center gap-3">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {session.room || 'TBA'}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Tuần: {session.weekParity === 'all' ? 'Tất cả' : session.weekParity === 'odd' ? 'Lẻ' : 'Chẵn'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thông tin bổ sung */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-900">
                  <div className="text-slate-400 flex items-center gap-1 mb-0.5"><UserIcon className="h-3.5 w-3.5" /> Giảng viên</div>
                  <div className="font-bold text-slate-200 truncate">{selectedCard.teacher || 'Chưa cập nhật'}</div>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-900">
                  <div className="text-slate-400 flex items-center gap-1 mb-0.5"><Layers className="h-3.5 w-3.5" /> Số chỗ trống</div>
                  <div className={`font-bold ${selectedCard.slotsLeft === 0 ? 'text-red-400' : 'text-slate-200'}`}>
                    {selectedCard.slotsLeft !== null ? `${selectedCard.slotsLeft} chỗ` : 'Không rõ'}
                  </div>
                </div>
              </div>

              {/* Ghi chú cộng đồng (Gaming style cho SV IT) */}
              <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg text-xs leading-relaxed text-slate-400">
                <span className="font-bold text-cyan-400 block mb-1">🎮 MẸO HỌC MÔN NÀY (CỘNG ĐỒNG):</span>
                {selectedCard.subjectName.includes('Cấu trúc dữ liệu') ? (
                  "Môn này code C++ khá nhiều, thi trắc nghiệm lý thuyết chiếm 40% + thực hành chấm code tự động. Nên ôn kỹ thuật toán cây nhị phân và đồ thị BFS/DFS trước."
                ) : selectedCard.subjectName.includes('Cơ sở dữ liệu') ? (
                  "Nắm chắc phần chuẩn hóa 1NF, 2NF, 3NF để làm bài tập lớn. Thi cuối kỳ thực hành viết truy vấn SQL khá dài, chú ý tối ưu hóa chỉ mục."
                ) : (
                  "Đọc trước slide bài giảng, chuẩn bị đầy đủ bài tập lớn trước tuần 10. Chú ý điểm danh đầy đủ vì giảng viên hay kiểm tra ngẫu nhiên."
                )}
              </div>

              {/* Actions trong modal */}
              <div className="flex gap-2 pt-2">
                {placedCards.some((p) => p.courseCardId === selectedCard.id) ? (
                  <>
                    <button
                      onClick={() => {
                        toggleLockCard(selectedCard.id);
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {placedCards.find((p) => p.courseCardId === selectedCard.id)?.locked ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" /> MỞ KHÓA THẺ
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 text-amber-500" /> KHÓA THẺ
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        removePlacedCard(selectedCard.id);
                        setSelectedCard(null);
                      }}
                      className="flex-1 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-900/40 text-red-400 font-bold rounded-lg text-xs transition-colors"
                    >
                      THU HỒI VỀ KHO
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      placeCard(selectedCard.id);
                      setSelectedCard(null);
                    }}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    XẾP LÊN BÀN CỜ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODAL: CHIA SẺ THỜI KHÓA BIỂU (SHARE MODAL)
          ==================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl neon-glow-cyan text-center space-y-5">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 p-1.5 rounded-full border border-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="h-12 w-12 rounded-full bg-cyan-950/50 border border-cyan-800 flex items-center justify-center mx-auto text-cyan-400">
              <Share2 className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-100">Chia sẻ Thời khóa biểu 3D</h2>
              <p className="text-xs text-slate-400 mt-1">
                Tạo một đường link xem-only chia sẻ với bạn bè để cùng tìm giờ rảnh chung hoặc đọ TKB độc đáo.
              </p>
            </div>

            {/* Timetable Card Preview Box */}
            <div className="border border-slate-850 bg-slate-900/40 p-4 rounded-xl space-y-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/10 via-transparent to-violet-950/10 pointer-events-none" />
              <div className="text-left">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">PREVIEW CARD:</div>
                <div className="text-sm font-black text-slate-200 mt-1">CardTKB Player: Student #9103</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Học kỳ 1 2026-2027 • {stats.totalCredits} Tín chỉ</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                  <div className="text-slate-500">Môn học</div>
                  <div className="text-slate-300 font-bold mt-0.5">{placedCards.length} lớp</div>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                  <div className="text-slate-500">Xung đột</div>
                  <div className="text-slate-300 font-bold mt-0.5">0 lớp</div>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                  <div className="text-slate-500">Lịch trống</div>
                  <div className="text-slate-300 font-bold mt-0.5">{7 - stats.studyDaysCount} ngày</div>
                </div>
              </div>
            </div>

            {/* Share Link Copy */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/tkb-draft-73948293`}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 grow focus:outline-none focus:border-cyan-500 select-all font-mono"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-black rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {isCopied ? 'ĐÃ COPPY!' : 'COPY LINK'}
              </button>
            </div>

            <button
              onClick={() => {
                alert('Chức năng xuất ảnh JPEG đang được tạo bản dựng. Bạn có thể chụp ảnh màn hình giao diện 3D tuyệt đẹp để chia sẻ ngay bây giờ!');
              }}
              className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-colors"
            >
              📷 XUẤT ẢNH THỜI KHÓA BIỂU
            </button>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA DỮ LIỆU CUSTOM (GAMING-STYLE) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-[0_0_30px_rgba(239,68,68,0.25)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="h-14 w-14 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 animate-pulse">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-red-500 uppercase tracking-widest">
                Xác Nhận Xóa Dữ Liệu
              </h2>
              <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                Hành động này sẽ xóa sạch toàn bộ môn học trong kho và trên bàn cờ của mọi phương án nháp. Bạn chắc chắn muốn reset?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition-colors border border-slate-700"
              >
                HỦY BỎ
              </button>
              <button
                onClick={() => {
                  clearAllData();
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('cardtkb_has_been_used', 'true');
                  }
                  // Đồng bộ trạng thái rỗng này lên DB ngay lập tức
                  syncScheduleToDB([], [
                    {
                      id: 'default-version',
                      semesterId: 'default-semester',
                      label: 'Phương án A',
                      placedCards: [],
                    }
                  ]);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-slate-950 font-black rounded-lg text-xs transition-all shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500"
              >
                XÁC NHẬN XÓA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HỒ SƠ CÁ NHÂN (USER PROFILE MODAL) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-[0_0_40px_rgba(6,182,212,0.2)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
            
            {/* Header Modal */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                👤 HỒ SƠ PHI HÀNH GIA
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-gray-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileLoading && !profileData ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-8 w-8 rounded-full border-4 border-t-cyan-400 border-slate-800 animate-spin" />
                <p className="text-xs text-slate-400">Đang tải hồ sơ...</p>
              </div>
            ) : (
              <div className="space-y-5 text-xs text-slate-300">
                {/* ID & Gmail (Read-only) */}
                <div className="space-y-3 bg-slate-950/50 p-4 border border-slate-850 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mã định danh (ID):</span>
                    <button
                      onClick={() => {
                        if (profileData) {
                          navigator.clipboard.writeText(profileData.id);
                          alert('Đã copy ID người dùng!');
                        }
                      }}
                      className="text-[9px] font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-800/30 px-1.5 py-0.5 rounded hover:bg-cyan-900/30 cursor-pointer"
                    >
                      COPY
                    </button>
                  </div>
                  <div className="font-mono text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-850 truncate select-all">
                    {profileData?.id}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Địa chỉ Gmail:</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Không thể sửa</span>
                  </div>
                  <div className="font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-850 truncate">
                    {profileData?.email}
                  </div>
                </div>

                {/* Tên người dùng (Có quyền đổi) */}
                <div className="space-y-2 bg-slate-950/30 p-4 border border-slate-850 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tên người dùng hiển thị:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Nhập tên người dùng..."
                      className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleUpdateUsername}
                      disabled={profileLoading}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-900 font-black rounded-xl transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
                    >
                      LƯU
                    </button>
                  </div>
                </div>

                {/* Đổi mật khẩu */}
                <div className="space-y-0.5">
                  <div
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 bg-slate-950/30 p-4 border border-slate-850 rounded-2xl select-none transition-all"
                  >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      🔒 Đổi Mật Khẩu Tĩnh
                    </span>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-800/30 px-1.5 py-0.5 rounded hover:bg-cyan-900/30">
                      {showPasswordChange ? 'THU GỌN' : 'THỰC HIỆN'}
                    </span>
                  </div>

                  {showPasswordChange && (
                    <div className="space-y-3 bg-slate-950/30 p-4 border border-slate-850 border-t-0 -mt-2 rounded-b-2xl rounded-t-none animate-in slide-in-from-top duration-200">
                      <div className="space-y-2">
                        <input
                          type="password"
                          placeholder="Mật khẩu hiện tại"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                        <input
                          type="password"
                          placeholder="Mật khẩu mới"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                        <input
                          type="password"
                          placeholder="Nhập lại mật khẩu mới"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <button
                        onClick={handleChangePassword}
                        disabled={profileLoading}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 font-bold rounded-xl transition-colors border border-slate-700 cursor-pointer"
                      >
                        {profileLoading ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT MẬT KHẨU'}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: QUẢN LÝ BẠN BÈ & LỜI MỜI (FRIEND MANAGER MODAL) */}
      {showFriendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-[0_0_40px_rgba(6,182,212,0.2)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
            
            {/* Header Modal */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                👥 QUẢN LÝ BẠN BÈ
              </h3>
              <button
                onClick={() => {
                  setShowFriendModal(false);
                  setFriendSearchResults([]);
                  setFriendSearchQuery('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-gray-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tìm kiếm người dùng mới */}
            <div className="space-y-2 bg-slate-950/50 p-4 border border-slate-850 rounded-2xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                🔍 Tìm kiếm bằng Tên hoặc ID
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  placeholder="Nhập tên người dùng hoặc ID..."
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchFriends()}
                />
                <button
                  onClick={handleSearchFriends}
                  disabled={friendSearchLoading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-900 font-black rounded-xl transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
                >
                  TÌM
                </button>
              </div>

              {/* Kết quả tìm kiếm */}
              {friendSearchResults.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-850 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {friendSearchResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-slate-900 rounded-xl border border-slate-850 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-200 truncate">{r.username}</div>
                        <div className="text-[9px] text-slate-500 truncate mt-0.5">ID: {r.id}</div>
                      </div>

                      {/* Nút thao tác tương ứng trạng thái */}
                      {r.relationStatus === 'FRIEND' && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg">Bạn bè</span>
                      )}
                      {r.relationStatus === 'REQUEST_SENT' && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-950/40 border border-amber-800/40 px-2 py-1 rounded-lg">Đã gửi yêu cầu</span>
                      )}
                      {r.relationStatus === 'REQUEST_RECEIVED' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRespondFriendRequest(r.friendshipId, 'accept', r.id)}
                            disabled={friendActionLoading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Đồng ý
                          </button>
                          <button
                            onClick={() => handleRespondFriendRequest(r.friendshipId, 'decline', r.id)}
                            disabled={friendActionLoading}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Từ chối
                          </button>
                        </div>
                      )}
                      {r.relationStatus === 'NOT_FRIEND' && (
                        <button
                          onClick={() => handleSendFriendRequest(r.id)}
                          disabled={friendActionLoading}
                          className="bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-black text-[10px] px-3 py-1 rounded-lg transition-all shadow-[0_0_5px_rgba(6,182,212,0.2)] cursor-pointer"
                        >
                          + Kết bạn
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lời mời kết bạn đang chờ (Received requests) */}
            <div className="space-y-2 bg-slate-950/30 p-4 border border-slate-850 rounded-2xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                📥 Lời mời kết bạn đang chờ ({receivedRequests.length})
              </span>

              {receivedRequests.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-[11px]">
                  Không có lời mời kết bạn nào.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {receivedRequests.map((req) => (
                    <div key={req.friendshipId} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-850 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-200 truncate">{req.sender.username}</div>
                        <div className="text-[9px] text-slate-500 truncate mt-0.5">🏫 {req.sender.university || 'Tự do'}</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespondFriendRequest(req.friendshipId, 'accept')}
                          disabled={friendActionLoading}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer animate-pulse hover:animate-none"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleRespondFriendRequest(req.friendshipId, 'decline')}
                          disabled={friendActionLoading}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TRỢ LÝ PHI HÀNH GIA ẢO GEMINI 3D */}
      <AiAssistantChat />
    </div>
  );
}

// ----------------------------------------------------
// DỮ LIỆU ĐỊNH HÌNH BAN ĐẦU (SAMPLE DATA)
// ----------------------------------------------------
function getInitialSampleCards(): CourseCard[] {
  return [
    {
      id: 'sample-card-1',
      semesterId: 'default-semester',
      subjectCode: 'INT2208',
      subjectName: 'Cấu trúc dữ liệu và giải thuật',
      classCode: 'INT2208.1',
      teacher: 'TS. Nguyễn Văn Hùng',
      slotsLeft: 12,
      colorRamp: 'blue',
      sourceType: 'import',
      sessions: [
        {
          id: 'sample-sess-1-1',
          courseCardId: 'sample-card-1',
          dayOfWeek: 2, // Thứ 2
          startPeriod: 1, // Tiết 1
          endPeriod: 3, // Tiết 3
          room: 'A.302',
          weekParity: 'all',
          sessionType: 'theory',
        },
        {
          id: 'sample-sess-1-2',
          courseCardId: 'sample-card-1',
          dayOfWeek: 4, // Thứ 4
          startPeriod: 7, // Tiết 7
          endPeriod: 9, // Tiết 9
          room: 'LAB.203',
          weekParity: 'even',
          sessionType: 'lab',
        },
      ],
    },
    {
      id: 'sample-card-2',
      semesterId: 'default-semester',
      subjectCode: 'INT2215',
      subjectName: 'Lập trình hướng đối tượng',
      classCode: 'INT2215.3',
      teacher: 'TS. Lê Thị Oanh',
      slotsLeft: 5,
      colorRamp: 'emerald',
      sourceType: 'import',
      sessions: [
        {
          id: 'sample-sess-2-1',
          courseCardId: 'sample-card-2',
          dayOfWeek: 3, // Thứ 3
          startPeriod: 1, // Tiết 1
          endPeriod: 3, // Tiết 3
          room: 'B.102',
          weekParity: 'all',
          sessionType: 'theory',
        },
      ],
    },
    {
      id: 'sample-card-3',
      semesterId: 'default-semester',
      subjectCode: 'INT2211',
      subjectName: 'Cơ sở dữ liệu',
      classCode: 'INT2211.2',
      teacher: 'PGS. TS. Trần Đức Quý',
      slotsLeft: 0,
      colorRamp: 'violet',
      sourceType: 'import',
      sessions: [
        {
          id: 'sample-sess-3-1',
          courseCardId: 'sample-card-3',
          dayOfWeek: 3, // Thứ 3
          startPeriod: 7, // Tiết 7
          endPeriod: 9, // Tiết 9
          room: 'C.104',
          weekParity: 'all',
          sessionType: 'theory',
        },
      ],
    },
  ];
}

// Helper Parser Regex bóc tách văn bản thô cho TKB
function parseRawTimetableText(text: string): CourseCard[] {
  const cards: CourseCard[] = [];
  
  // Tách dòng để phân tích
  const lines = text.split('\n').map(l => l.replace(/^\ufeff/i, '').trim()).filter(Boolean);
  
  let currentCard: CourseCard | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Nhận diện Tên môn và Mã môn (ví dụ: "Pháp luật đại cương (LAW106)" hoặc "INT2208 Cấu trúc dữ liệu")
    let subjectCode = '';
    let subjectName = '';
    
    const parenthesisMatch = line.match(/^([^(]+)\s*\(([A-Za-z0-9]+)\)/);
    const standardMatch = line.match(/^([A-Z]{2,4}\d{3,4})\s+(.+)$/);
    
    if (parenthesisMatch) {
      subjectName = parenthesisMatch[1].trim();
      subjectCode = parenthesisMatch[2].trim();
    } else if (standardMatch) {
      subjectCode = standardMatch[1].trim();
      subjectName = standardMatch[2].trim();
    }

    if (subjectCode && subjectName) {
      // Nếu đã có card trước đó, đẩy nó vào danh sách
      if (currentCard) {
        cards.push(currentCard);
      }

      const id = `parse-card-${Date.now()}-${cards.length}`;
      currentCard = {
        id,
        semesterId: 'default-semester',
        subjectCode,
        subjectName,
        classCode: `${subjectCode}.G01`, // Gán nhóm mặc định
        teacher: 'Chưa rõ',
        slotsLeft: 40,
        colorRamp: getRandomColorRamp(),
        sourceType: 'import',
        sessions: []
      };
    }

    // 2. Nhận diện Lịch học (Thứ, Tiết) trên dòng hiện hành
    // Khớp: "Thứ 4 - Tiết 7-11" hoặc "Thứ 7 - Tiết 7-11 (06/07-12/07)"
    const sessionRegex = /(?:Thứ|T|Day)\s*([2-8]|CN|Chủ\s*Nhật)\s*[-–,\s]*\s*(?:Tiết|Period)?\s*(\d+)\s*[-–]\s*(\d+)/i;
    const sessionMatch = line.match(sessionRegex);

    if (sessionMatch && currentCard) {
      const dayOfWeekStr = sessionMatch[1].toUpperCase();
      let dayOfWeek = 2; // Mặc định Thứ 2
      if (dayOfWeekStr === 'CN' || dayOfWeekStr.includes('CHỦ') || dayOfWeekStr === '8') {
        dayOfWeek = 8;
      } else {
        const d = parseInt(dayOfWeekStr);
        if (!isNaN(d)) {
          dayOfWeek = d;
        }
      }

      const startPeriod = parseInt(sessionMatch[2]);
      const endPeriod = parseInt(sessionMatch[3]);

      // Tìm phòng học: Lấy phần text đứng sau cụm "Tiết X-Y"
      let room = 'TBA';
      const afterSessionText = line.substring(line.indexOf(sessionMatch[0]) + sessionMatch[0].length).trim();
      
      const roomMatch = afterSessionText.match(/(?:Phòng|Room)?\s*([A-Za-z0-9./-]+)/i);
      if (roomMatch && roomMatch[1] && !roomMatch[1].startsWith('(')) {
        room = roomMatch[1];
      } else if (afterSessionText && !afterSessionText.startsWith('(')) {
        const words = afterSessionText.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord && lastWord.match(/[A-Za-z0-9.-]/)) {
          room = lastWord;
        }
      }

      const sessionType = line.toLowerCase().includes('thực hành') || line.toLowerCase().includes('lab') ? 'lab' : 'theory';
      const weekParity = line.toLowerCase().includes('lẻ') || line.toLowerCase().includes('odd') 
        ? 'odd' 
        : line.toLowerCase().includes('chẵn') || line.toLowerCase().includes('even') 
          ? 'even' 
          : 'all';

      currentCard.sessions.push({
        id: `parse-sess-${currentCard.id}-${currentCard.sessions.length}`,
        courseCardId: currentCard.id,
        dayOfWeek,
        startPeriod,
        endPeriod,
        room,
        weekParity,
        sessionType,
      });
    }
  }

  // Đẩy phần tử cuối cùng vào
  if (currentCard) {
    cards.push(currentCard);
  }

  return cards;
}

function getRandomColorRamp(): string {
  const colors = ['blue', 'emerald', 'amber', 'rose', 'violet', 'indigo', 'cyan'];
  return colors[Math.floor(Math.random() * colors.length)];
}
