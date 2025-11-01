import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OpenDebateWindow {
  debateRoomId: string;
  topicTitle: string;
  opponentName: string;
  opponentId: string;
  isMinimized: boolean;
  position?: { x: number; y: number };
}

interface DebateContextType {
  // Open windows management
  openWindows: OpenDebateWindow[];
  openDebateWindow: (window: Omit<OpenDebateWindow, 'isMinimized'>) => void;
  closeDebateWindow: (debateRoomId: string) => void;
  minimizeDebateWindow: (debateRoomId: string) => void;
  restoreDebateWindow: (debateRoomId: string) => void;
  updateWindowPosition: (debateRoomId: string, position: { x: number; y: number }) => void;
  
  // Panel management
  activePanel: 'none' | 'all-debates' | 'archived' | 'opponent-list';
  opponentPanelData: { opponentId: string; opponentName: string } | null;
  openPanel: (panel: 'all-debates' | 'archived') => void;
  openOpponentPanel: (opponentId: string, opponentName: string) => void;
  closePanel: () => void;
  
  // Unread counts
  unreadCounts: Record<string, number>; // debateRoomId -> count
  setUnreadCount: (debateRoomId: string, count: number) => void;
  incrementUnread: (debateRoomId: string) => void;
  clearUnread: (debateRoomId: string) => void;
  
  // Total unread for footer badge
  totalUnread: number;
}

const DebateContext = createContext<DebateContextType | undefined>(undefined);

const STORAGE_KEY = 'opinionfeud_debate_windows';

export function DebateProvider({ children }: { children: ReactNode }) {
  const [openWindows, setOpenWindows] = useState<OpenDebateWindow[]>([]);
  const [activePanel, setActivePanel] = useState<'none' | 'all-debates' | 'archived' | 'opponent-list'>('none');
  const [opponentPanelData, setOpponentPanelData] = useState<{ opponentId: string; opponentName: string } | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Load persisted windows on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setOpenWindows(parsed);
      } catch (e) {
        console.error('Failed to parse stored windows:', e);
      }
    }
  }, []);

  // Persist windows to localStorage
  useEffect(() => {
    if (openWindows.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openWindows));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [openWindows]);

  const openDebateWindow = (window: Omit<OpenDebateWindow, 'isMinimized'>) => {
    setOpenWindows(prev => {
      // Check if already open
      const existing = prev.find(w => w.debateRoomId === window.debateRoomId);
      if (existing) {
        // Restore if minimized
        return prev.map(w => 
          w.debateRoomId === window.debateRoomId 
            ? { ...w, isMinimized: false }
            : w
        );
      }
      
      // Add new window
      return [...prev, { ...window, isMinimized: false }];
    });
    
    // Clear unread when opening
    clearUnread(window.debateRoomId);
  };

  const closeDebateWindow = (debateRoomId: string) => {
    setOpenWindows(prev => prev.filter(w => w.debateRoomId !== debateRoomId));
  };

  const minimizeDebateWindow = (debateRoomId: string) => {
    setOpenWindows(prev => 
      prev.map(w => 
        w.debateRoomId === debateRoomId 
          ? { ...w, isMinimized: true }
          : w
      )
    );
  };

  const restoreDebateWindow = (debateRoomId: string) => {
    setOpenWindows(prev => 
      prev.map(w => 
        w.debateRoomId === debateRoomId 
          ? { ...w, isMinimized: false }
          : w
      )
    );
  };

  const updateWindowPosition = (debateRoomId: string, position: { x: number; y: number }) => {
    setOpenWindows(prev => 
      prev.map(w => 
        w.debateRoomId === debateRoomId 
          ? { ...w, position }
          : w
      )
    );
  };

  const openPanel = (panel: 'all-debates' | 'archived') => {
    setActivePanel(panel);
    setOpponentPanelData(null);
  };

  const openOpponentPanel = (opponentId: string, opponentName: string) => {
    setActivePanel('opponent-list');
    setOpponentPanelData({ opponentId, opponentName });
  };

  const closePanel = () => {
    setActivePanel('none');
    setOpponentPanelData(null);
  };

  const setUnreadCount = (debateRoomId: string, count: number) => {
    setUnreadCounts(prev => ({ ...prev, [debateRoomId]: count }));
  };

  const incrementUnread = (debateRoomId: string) => {
    setUnreadCounts(prev => ({ 
      ...prev, 
      [debateRoomId]: (prev[debateRoomId] || 0) + 1 
    }));
  };

  const clearUnread = (debateRoomId: string) => {
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[debateRoomId];
      return newCounts;
    });
  };

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <DebateContext.Provider value={{
      openWindows,
      openDebateWindow,
      closeDebateWindow,
      minimizeDebateWindow,
      restoreDebateWindow,
      updateWindowPosition,
      activePanel,
      opponentPanelData,
      openPanel,
      openOpponentPanel,
      closePanel,
      unreadCounts,
      setUnreadCount,
      incrementUnread,
      clearUnread,
      totalUnread,
    }}>
      {children}
    </DebateContext.Provider>
  );
}

export function useDebateContext() {
  const context = useContext(DebateContext);
  if (!context) {
    throw new Error('useDebateContext must be used within a DebateProvider');
  }
  return context;
}
