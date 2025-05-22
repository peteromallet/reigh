import React, { useState, useEffect, useRef } from 'react';
import ShotGroup from './ShotGroup'; // Adjust path as needed
import NewGroupDropZone from './NewGroupDropZone'; // Adjust path as needed

// Import hooks and types
import { useListShots } from '../hooks/useShots'; // Adjust path
import { Shot } from '../types/shots'; // Adjust path

const ShotsPane: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHoveringPane, setIsHoveringPane] = useState(false);
  const hotZoneRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  let leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: shots, isLoading, error } = useListShots(); // Now directly returns Shot[]

  const handleHotZoneEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handlePaneLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300); // 300ms delay before closing
  };

  const handlePaneEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Hot Zone: Invisible div at the bottom to trigger the pane */}
      <div
        ref={hotZoneRef}
        onMouseEnter={handleHotZoneEnter}
        className="fixed bottom-0 left-0 w-full h-[24px] bg-transparent z-40 pointer-events-auto"
        style={{ opacity: 0 }} // Make it invisible but interactable
      />

      {/* Shots Pane */}
      <div
        ref={paneRef}
        onMouseEnter={handlePaneEnter} // Clear close timeout if mouse re-enters pane
        onMouseLeave={handlePaneLeave} // Set timeout to close if mouse leaves pane
        className={`fixed bottom-0 inset-x-0 h-[220px] bg-zinc-900/95 border-t border-zinc-700 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex gap-4 px-4 py-3 h-full overflow-x-auto scrollbar-hide">
          <NewGroupDropZone />
          
          {isLoading && <p className="text-white">Loading shots...</p>}
          {error && <p className="text-red-500">Error loading shots: {error.message}</p>}
          {shots && shots.map(shot => {
            return <ShotGroup key={shot.id} shot={shot} />;
          })}
          
        </div>
      </div>
    </>
  );
};

export default ShotsPane; 