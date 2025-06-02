import React from 'react';
import { Shot, GenerationRow } from '../../types/shots'; // Corrected import path

interface VideoShotDisplayProps {
  shot: Shot; 
  onSelectShot: (shotId: string) => void;
}

const VideoShotDisplay: React.FC<VideoShotDisplayProps> = ({ shot, onSelectShot }) => {
  // Display max 5 images, or a placeholder if no images
  const imagesToShow: GenerationRow[] = shot.images?.slice(0, 5) || [];

  return (
    <div 
      key={shot.id} 
      className="mb-6 p-4 border rounded-lg cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => onSelectShot(shot.id)}
    >
      <h3 className="text-xl font-medium mb-3">{shot.name}</h3>
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {imagesToShow.length > 0 ? (
          imagesToShow.map((image, index) => (
            <div key={image.shotImageEntryId || `img-${index}`} className="flex-shrink-0 w-32 h-32 rounded overflow-hidden border">
              <img 
                src={image.thumbUrl || image.imageUrl || '/placeholder.svg'} 
                alt={`Shot image ${index + 1} for ${shot.name}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic">No images in this shot yet.</p>
        )}
        {shot.images && shot.images.length > 5 && (
          <div className="flex-shrink-0 w-32 h-32 rounded border bg-muted flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">+{shot.images.length - 5} more</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoShotDisplay; 