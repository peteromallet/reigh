import React, { useState, useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Shot, GenerationRow } from '@/types/shots';
import { useUpdateShotName, useHandleExternalImageDrop } from '@/shared/hooks/useShots';
import { useToast } from '@/shared/hooks/use-toast';

interface ShotGroupProps {
  shot: Shot;
}

const ShotGroup: React.FC<ShotGroupProps> = ({ shot }) => {
  const { isOver: isDndKitOver, setNodeRef } = useDroppable({
    id: shot.id,
    data: {
      type: 'shot-group',
      shotId: shot.id,
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [currentName, setCurrentName] = useState(shot.name || 'Unnamed Shot');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFileOver, setIsFileOver] = useState(false);

  const updateShotNameMutation = useUpdateShotName();
  const handleExternalImageDropMutation = useHandleExternalImageDrop();
  const { toast } = useToast();

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

  const droppableStyle: React.CSSProperties = {
    border: isDndKitOver ? '2px dashed #22c55e' : (isFileOver ? '2px dashed #0ea5e9' : '2px solid transparent'),
    transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    position: 'relative',
  };

  const MAX_THUMBNAILS = 4;
  const displayedImages = shot.images?.slice(0, MAX_THUMBNAILS) || [];
  const remainingImagesCount = Math.max(0, (shot.images?.length || 0) - MAX_THUMBNAILS);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`[ShotGroup:${shot.id}] handleDragEnter: File entered. Items:`, e.dataTransfer.items.length, e.dataTransfer.types);
    if (e.dataTransfer.types.includes('Files')) {
      setIsFileOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsFileOver(true);
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`[ShotGroup:${shot.id}] handleDragLeave: File left.`);
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    setIsFileOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileOver(false);
    console.log(`[ShotGroup:${shot.id}] handleDrop: File dropped. Items:`, e.dataTransfer.files.length);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      console.log(`[ShotGroup:${shot.id}] handleDrop: No files found in drop event.`);
      return;
    }

    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    let processedCount = 0;

    for (const file of files) {
      console.log(`[ShotGroup:${shot.id}] handleDrop: Processing file - ${file.name}, Type: ${file.type}, Size: ${file.size}`);
      if (!validImageTypes.includes(file.type)) {
        console.warn(`[ShotGroup:${shot.id}] handleDrop: Invalid file type for ${file.name}: ${file.type}. Skipping.`);
        toast({
          title: "Invalid File Type",
          description: `Skipped '${file.name}'. Only JPEG, PNG, WEBP, GIF are allowed. `,
          variant: "destructive",
        });
        continue;
      }

      try {
        await handleExternalImageDropMutation.mutateAsync({ shotId: shot.id, imageFile: file });
        processedCount++;
        console.log(`[ShotGroup:${shot.id}] handleDrop: Successfully initiated processing for ${file.name}.`);
      } catch (error) {
        console.error(`[ShotGroup:${shot.id}] handleDrop: Error processing file ${file.name}:`, error);
        toast({
          title: "Upload Error",
          description: `Could not add '${file.name}': ${(error as Error).message}`,
          variant: "destructive",
        });
      }
    }

    if (processedCount > 0) {
        toast({
            title: "Images Added",
            description: `${processedCount} image(s) successfully added to shot '${currentName}'.`,
        });
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={droppableStyle} 
      className="shot-group p-3 border border-zinc-700 rounded-lg min-w-[200px] max-w-[300px] bg-zinc-800/90 shadow-lg flex flex-col space-y-2 transition-all duration-150 ease-in-out relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isFileOver && (
        <div 
          className="absolute inset-0 bg-sky-500 bg-opacity-30 flex items-center justify-center rounded-lg pointer-events-none z-10"
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <p className="text-white text-sm font-semibold p-2 bg-black/50 rounded">Add to shot</p>
        </div>
      )}
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
                key={image.shotImageEntryId}
                src={image.imageUrl || './placeholder.svg'} 
                alt={`Shot image ${index + 1}`}
                className="w-12 h-12 object-cover rounded-full border-2 border-zinc-700 bg-zinc-600 shadow"
                title={`Image ID: ${image.id} (Entry: ${image.shotImageEntryId})`}
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
    </div>
  );
};

export default ShotGroup; 