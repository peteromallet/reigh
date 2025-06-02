import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GeneratedImageWithMetadata } from '@/shared/components/ImageGallery'; // Updated import path

interface DraggableImageProps {
  image: GeneratedImageWithMetadata;
  children: React.ReactNode;
}

export const DraggableImage: React.FC<DraggableImageProps> = ({ image, children }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: image.id || `draggable-${image.url}`, // Ensure a unique ID
    data: {
      generationId: image.id,
      imageUrl: image.url,
      thumbUrl: image.url, // Using main URL as thumb for now
      // We can add more data if needed for drop handling, e.g., the full image object
      sourceData: image 
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    touchAction: 'none', // Recommended for draggables
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}; 