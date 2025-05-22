import React, { useState, useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Shot, GenerationRow } from '../types/shots';
import { useUpdateShotName } from '../hooks/useShots';

interface ShotGroupProps {
  shot: Shot;
}

const ShotGroup: React.FC<ShotGroupProps> = ({ shot }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: shot.id,
    data: {
      type: 'shot-group',
      shotId: shot.id,
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [currentName, setCurrentName] = useState(shot.name || 'Unnamed Shot');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateShotNameMutation = useUpdateShotName();

  useEffect(() => {
    if (shot.name !== currentName && !isEditing) {
      setCurrentName(shot.name || 'Unnamed Shot');
    }
  }, [shot.name, currentName, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameDoubleClick = () => {
    setIsEditing(true);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentName(event.target.value);
  };

  const saveName = () => {
    setIsEditing(false);
    const trimmedName = currentName.trim();
    if (trimmedName && trimmedName !== shot.name) {
      updateShotNameMutation.mutate({ shotId: shot.id, newName: trimmedName });
    } else if (!trimmedName && shot.name) {
      setCurrentName(shot.name || 'Unnamed Shot'); 
    } else if (!trimmedName && !shot.name) {
      setCurrentName('Unnamed Shot');
    }
  };

  const handleInputBlur = () => {
    saveName();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      saveName();
    } else if (event.key === 'Escape') {
      setIsEditing(false);
      setCurrentName(shot.name || 'Unnamed Shot');
    }
  };

  const droppableStyle = {
    border: isOver ? '2px dashed #22c55e' : '2px solid transparent',
  };

  const MAX_THUMBNAILS = 4;
  const displayedImages = shot.images?.slice(0, MAX_THUMBNAILS) || [];
  const remainingImagesCount = Math.max(0, (shot.images?.length || 0) - MAX_THUMBNAILS);

  return (
    <div 
      ref={setNodeRef} 
      style={droppableStyle} 
      className="shot-group p-3 border border-zinc-700 rounded-lg min-w-[200px] max-w-[300px] bg-zinc-800/90 shadow-lg flex flex-col space-y-2 transition-all duration-150 ease-in-out"
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={currentName}
          onChange={handleNameChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="bg-zinc-700 text-white p-1 rounded border border-zinc-600 text-sm focus:ring-1 focus:ring-sky-500 outline-none w-full"
        />
      ) : (
        <p 
          onDoubleClick={handleNameDoubleClick}
          className="text-white text-sm font-semibold truncate cursor-pointer hover:bg-zinc-700/70 p-1 rounded transition-colors"
          title={currentName}
        >
          {currentName}
        </p>
      )}
      
      {/* Thumbnail mosaic area */}
      <div className="flex-grow min-h-[60px]">
        {displayedImages.length > 0 ? (
          <div className="flex -space-x-3 rtl:space-x-reverse overflow-hidden p-1">
            {displayedImages.map((image, index) => (
              <img 
                key={image.id || `img-${index}`}
                src={image.imageUrl || './placeholder.svg'} 
                alt={`Shot image ${index + 1}`}
                className="w-12 h-12 object-cover rounded-full border-2 border-zinc-700 bg-zinc-600 shadow"
                title={`Image ID: ${image.id}`}
              />
            ))}
            {remainingImagesCount > 0 && (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-700 border-2 border-zinc-600 text-xs text-zinc-300 font-medium">
                +{remainingImagesCount}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-zinc-500">
            Drop images here
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-700/50">
        Total: {shot.images?.length || 0} image(s)
      </div>

      {isOver && (
        <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-green-300 text-sm font-semibold">Drop to add</p>
        </div>
      )}
    </div>
  );
};

export default ShotGroup; 