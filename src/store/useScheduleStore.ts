import { create } from 'zustand';

export interface Session {
  id: string;
  courseCardId: string;
  dayOfWeek: number; // 2..8 (Thứ 2 đến Chủ nhật)
  startPeriod: number; // 1..12
  endPeriod: number; // 1..12
  room: string | null;
  weekParity: string | null; // "all" | "odd" | "even"
  sessionType: string; // "theory" | "lab"
}

export interface CourseCard {
  id: string;
  semesterId: string;
  subjectCode: string;
  subjectName: string;
  classCode: string;
  teacher: string | null;
  slotsLeft: number | null;
  colorRamp: string; // "blue" | "emerald" | "amber" | "rose" | "violet" | "indigo" | "cyan"
  sessions: Session[];
  sourceType: string; // "ocr" | "import" | "api"
}

export interface PlacedCard {
  id: string;
  scheduleVersionId: string;
  courseCardId: string;
  locked: boolean;
}

export interface ScheduleVersion {
  id: string;
  semesterId: string;
  label: string;
  placedCards: PlacedCard[];
}

export interface LobbyMember {
  id: string;
  userId: string;
  username: string;
  color: string;
  scheduleJson?: string;
}

interface ScheduleState {
  courseCards: CourseCard[];
  placedCards: PlacedCard[]; // Các card đang đặt trong version hiện tại
  versions: ScheduleVersion[];
  currentVersionId: string;
  
  // Co-Op Lobby state
  activeLobbyId: string | null;
  lobbyMembers: LobbyMember[];
  coopCourseCards: CourseCard[];
  coopActive: boolean;
  
  // Actions
  setCourseCards: (cards: CourseCard[]) => void;
  addCourseCard: (card: CourseCard) => void;
  removeCourseCard: (cardId: string) => void;
  placeCard: (cardId: string) => { success: boolean; conflicts: string[] };
  removePlacedCard: (cardId: string) => void;
  toggleLockCard: (cardId: string) => void;
  
  // Version management
  addVersion: (label: string) => void;
  switchVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  
  // Conflict checking helper
  getConflicts: (cardId: string, ignoreSelf?: boolean) => string[];
  isCardPlaced: (cardId: string) => boolean;
  clearAllData: () => void;
  initStoreData: (courseCards: CourseCard[], versions: ScheduleVersion[], currentVersionId?: string) => void;
  
  // Co-Op Lobby Actions
  setCoopState: (state: Partial<{ activeLobbyId: string | null; lobbyMembers: LobbyMember[]; coopCourseCards: CourseCard[]; coopActive: boolean }>) => void;
}

// Hàm kiểm tra trùng lặp thời gian giữa 2 Session
export const areSessionsOverlapping = (s1: Session, s2: Session): boolean => {
  if (s1.dayOfWeek !== s2.dayOfWeek) return false;

  // Kiểm tra tuần chẵn/lẻ
  const parityConflict =
    s1.weekParity === 'all' ||
    s2.weekParity === 'all' ||
    s1.weekParity === s2.weekParity;

  if (!parityConflict) return false;

  // Kiểm tra chồng chéo tiết học: [start, end]
  return !(s1.endPeriod < s2.startPeriod || s1.startPeriod > s2.endPeriod);
};

const DEFAULT_VERSION_ID = 'default-version-' + Math.random().toString(36).substring(2, 9);

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  courseCards: [],
  placedCards: [],
  versions: [
    {
      id: DEFAULT_VERSION_ID,
      semesterId: 'default-semester',
      label: 'Phương án A',
      placedCards: [],
    },
  ],
  currentVersionId: DEFAULT_VERSION_ID,

  // Co-Op Lobby default state
  activeLobbyId: null,
  lobbyMembers: [],
  coopCourseCards: [],
  coopActive: false,

  setCoopState: (partialState) => set((state) => ({ ...state, ...partialState })),

  setCourseCards: (cards) => set({ courseCards: cards }),
  
  addCourseCard: (card) => set((state) => {
    // Tránh trùng ID card
    if (state.courseCards.some((c) => c.id === card.id)) return state;
    return { courseCards: [...state.courseCards, card] };
  }),

  removeCourseCard: (cardId) => set((state) => ({
    courseCards: state.courseCards.filter((c) => c.id !== cardId),
    placedCards: state.placedCards.filter((p) => p.courseCardId !== cardId),
    versions: state.versions.map((v) => ({
      ...v,
      placedCards: v.placedCards.filter((p) => p.courseCardId !== cardId),
    })),
  })),

  isCardPlaced: (cardId) => {
    return get().placedCards.some((p) => p.courseCardId === cardId);
  },

  getConflicts: (cardId: string, ignoreSelf = true) => {
    const { courseCards, placedCards } = get();
    const targetCard = courseCards.find((c) => c.id === cardId);
    if (!targetCard) return [];

    const conflicts: string[] = [];

    // Duyệt qua các card ĐÃ ĐẶT trên bàn cờ
    for (const placed of placedCards) {
      if (ignoreSelf && placed.courseCardId === cardId) continue;
      
      const placedCardData = courseCards.find((c) => c.id === placed.courseCardId);
      if (!placedCardData) continue;

      // So sánh từng session của targetCard với placedCard
      let hasOverlap = false;
      for (const tSession of targetCard.sessions) {
        for (const pSession of placedCardData.sessions) {
          if (areSessionsOverlapping(tSession, pSession)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) break;
      }

      if (hasOverlap) {
        conflicts.push(placed.courseCardId);
      }
    }

    return conflicts;
  },

  placeCard: (cardId) => {
    const { isCardPlaced, getConflicts, placedCards, currentVersionId, versions } = get();
    
    // Nếu card đã được đặt rồi, không đặt thêm nữa
    if (isCardPlaced(cardId)) {
      return { success: true, conflicts: [] };
    }

    // Kiểm tra xung đột với các card hiện tại trên bàn cờ
    const conflicts = getConflicts(cardId, false);

    // Vẫn cho phép đặt (dạng xung đột) để người dùng có thể so sánh trực quan và tự gỡ rối sau
    const newPlacedCard: PlacedCard = {
      id: `placed-${cardId}-${Date.now()}`,
      scheduleVersionId: currentVersionId,
      courseCardId: cardId,
      locked: false,
    };

    const updatedPlacedCards = [...placedCards, newPlacedCard];

    set({
      placedCards: updatedPlacedCards,
      versions: versions.map((v) =>
        v.id === currentVersionId ? { ...v, placedCards: updatedPlacedCards } : v
      ),
    });

    return {
      success: conflicts.length === 0,
      conflicts,
    };
  },

  removePlacedCard: (cardId) => set((state) => {
    const updatedPlaced = state.placedCards.filter((p) => p.courseCardId !== cardId);
    return {
      placedCards: updatedPlaced,
      versions: state.versions.map((v) =>
        v.id === state.currentVersionId ? { ...v, placedCards: updatedPlaced } : v
      ),
    };
  }),

  toggleLockCard: (cardId) => set((state) => {
    const updatedPlaced = state.placedCards.map((p) =>
      p.courseCardId === cardId ? { ...p, locked: !p.locked } : p
    );
    return {
      placedCards: updatedPlaced,
      versions: state.versions.map((v) =>
        v.id === state.currentVersionId ? { ...v, placedCards: updatedPlaced } : v
      ),
    };
  }),

  addVersion: (label) => set((state) => {
    const newId = `version-${Date.now()}`;
    const newVersion: ScheduleVersion = {
      id: newId,
      semesterId: 'default-semester',
      label,
      placedCards: [],
    };
    return {
      versions: [...state.versions, newVersion],
      currentVersionId: newId,
      placedCards: [],
    };
  }),

  switchVersion: (versionId) => set((state) => {
    const targetVersion = state.versions.find((v) => v.id === versionId);
    if (!targetVersion) return state;
    return {
      currentVersionId: versionId,
      placedCards: targetVersion.placedCards,
    };
  }),

  deleteVersion: (versionId) => set((state) => {
    // Không cho xóa version duy nhất
    if (state.versions.length <= 1) return state;
    const remainingVersions = state.versions.filter((v) => v.id !== versionId);
    const fallbackVersion = remainingVersions[0];
    return {
      versions: remainingVersions,
      currentVersionId: state.currentVersionId === versionId ? fallbackVersion.id : state.currentVersionId,
      placedCards: state.currentVersionId === versionId ? fallbackVersion.placedCards : state.placedCards,
    };
  }),

  clearAllData: () => set({
    courseCards: [],
    placedCards: [],
    versions: [
      {
        id: DEFAULT_VERSION_ID,
        semesterId: 'default-semester',
        label: 'Phương án A',
        placedCards: [],
      },
    ],
    currentVersionId: DEFAULT_VERSION_ID,
  }),

  initStoreData: (courseCards, versions, currentVersionId) => set((state) => {
    const activeVersionId = currentVersionId || versions[0]?.id || DEFAULT_VERSION_ID;
    const activePlacedCards = versions.find((v) => v.id === activeVersionId)?.placedCards || [];
    return {
      courseCards,
      versions: versions.length > 0 ? versions : [
        {
          id: DEFAULT_VERSION_ID,
          semesterId: 'default-semester',
          label: 'Phương án A',
          placedCards: [],
        }
      ],
      currentVersionId: activeVersionId,
      placedCards: activePlacedCards,
    };
  }),
}));
