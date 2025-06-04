import React, { useState, useEffect, useRef, useCallback } from 'react';
import TaskList from './TaskList';
import { cn } from '@/shared/lib/utils'; // For conditional classnames
import { Button } from '@/shared/components/ui/button'; // For the lock button
import { LockIcon, UnlockIcon } from 'lucide-react'; // Example icons

interface TasksPaneProps {
  onLockStateChange?: (isLockedAndOpen: boolean, currentWidth: number) => void;
  paneWidth?: number;
}

const DEFAULT_PANE_WIDTH = 350;

const TasksPane: React.FC<TasksPaneProps> = ({ onLockStateChange, paneWidth = DEFAULT_PANE_WIDTH }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const hotZoneRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const effectivePaneWidth = paneWidth;

  const handleSetOpen = useCallback((open: boolean) => {
    if (isLocked && !open) {
      return; // If locked, don't allow programmatic close via hover (unless unlocking)
    }
    setIsOpen(open);
  }, [isLocked]);

  useEffect(() => {
    if (onLockStateChange) {
      onLockStateChange(isLocked && isOpen, effectivePaneWidth);
    }
  }, [isLocked, isOpen, onLockStateChange, effectivePaneWidth]);

  const handleHotZoneEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (!isLocked) {
      handleSetOpen(true);
    }
  };

  const handlePaneLeave = () => {
    if (isLocked) return;
    leaveTimeoutRef.current = setTimeout(() => {
      handleSetOpen(false);
    }, 300);
  };

  const handlePaneEnter = () => {
    if (isLocked) return;
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    handleSetOpen(true);
  };

  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    if (newLockState) {
      setIsOpen(true); // Ensure pane is open when locked
    } else {
      // If unlocking, isOpen remains true for now, mouse leave will handle closing if applicable.
      // This prevents it from immediately closing if the mouse isn't over the hotzone.
      setIsOpen(true); 
    }
  };

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {!isLocked && (
        <div
          ref={hotZoneRef}
          onMouseEnter={handleHotZoneEnter}
          className="fixed top-0 right-0 h-full w-[24px] bg-transparent z-40 pointer-events-auto"
          style={{ opacity: 0 }} // Invisible but interactable
        />
      )}

      {/* Tasks Pane */}
      <div
        ref={paneRef}
        onMouseEnter={handlePaneEnter} 
        onMouseLeave={handlePaneLeave} 
        style={{ width: `${effectivePaneWidth}px` }}
        className={cn(
          'fixed top-0 right-0 h-full bg-zinc-900/95 border-l border-zinc-600 shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col',
          (isOpen || isLocked) ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-2 border-b border-zinc-800">
          <Button variant="ghost" size="sm" onClick={toggleLock} className="text-zinc-400 hover:text-zinc-100">
            {isLocked ? <LockIcon className="h-4 w-4 mr-1" /> : <UnlockIcon className="h-4 w-4 mr-1" />}
            {isLocked ? 'Unlock' : 'Lock'}
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <TaskList />
        </div>
      </div>
    </>
  );
};

export default TasksPane; 