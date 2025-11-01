import { useDebateContext } from '@/contexts/DebateContext';
import { PopupDebateWindow } from './PopupDebateWindow';

export function DebateWindowManager() {
  const { openWindows } = useDebateContext();

  // Only render non-minimized windows
  const activeWindows = openWindows.filter(w => !w.isMinimized);

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
