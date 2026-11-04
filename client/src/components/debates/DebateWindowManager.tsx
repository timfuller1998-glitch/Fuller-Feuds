import { useDebateContext } from '@/contexts/DebateContext';
import { PopupDebateWindow } from './PopupDebateWindow';
import { useLocation } from 'wouter';

export function DebateWindowManager() {
  const { openWindows } = useDebateContext();
  const [location] = useLocation();
  // The full debate page already shows this room; don't stack its popup on top.
  const pageRoomId = location.startsWith('/debate-room/') ? location.split('/')[2] : null;

  // Only render non-minimized windows
  const activeWindows = openWindows.filter(w => !w.isMinimized && w.debateRoomId !== pageRoomId);

  return (
    <>
      {activeWindows.map((window) => (
        <PopupDebateWindow
          key={window.debateRoomId}
          debateRoomId={window.debateRoomId}
          topicTitle={window.topicTitle}
          opponentName={window.opponentName}
          opponentId={window.opponentId}
          position={window.position}
        />
      ))}
    </>
  );
}
