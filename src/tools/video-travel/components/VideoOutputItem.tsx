import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Info, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import HoverScrubVideo from '@/shared/components/HoverScrubVideo';
import TaskDetailsModal from './TaskDetailsModal';
import { GenerationRow } from '@/types/shots';

interface VideoOutputItemProps {
  video: GenerationRow;
  onDoubleClick: () => void;
  onDelete: (generationId: string) => void;
  isDeleting: boolean;
  onApplySettings?: (settings: {
    prompt?: string;
    prompts?: string[];
    negativePrompt?: string;
    negativePrompts?: string[];
    steps?: number;
    frame?: number;
    frames?: number[];
    context?: number;
    contexts?: number[];
    width?: number;
    height?: number;
    replaceImages?: boolean;
    inputImages?: string[];
  }) => void;
}

export const VideoOutputItem: React.FC<VideoOutputItemProps> = ({
  video,
  onDoubleClick,
  onDelete,
  isDeleting,
  onApplySettings,
}) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent lightbox from opening on delete
    onDelete(video.id);
  };

  return (
    <div
      className="rounded-lg overflow-hidden shadow-md bg-muted/30 aspect-video flex items-center justify-center relative group"
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute top-2 left-2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <TaskDetailsModal generationId={video.id} onApplySettings={onApplySettings}>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/20 backdrop-blur-sm hover:bg-white/20"
            aria-label="Show task details"
          >
            <Info className="h-5 w-5 text-white" />
          </Button>
        </TaskDetailsModal>
        {video.createdAt && (
          <span className="text-xs text-white bg-black/50 px-1.5 py-0.5 rounded-md">
            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </span>
        )}
      </div>
      {(video.location || video.imageUrl) ? (
        <HoverScrubVideo
          src={video.location || video.imageUrl}
          poster={video.thumbUrl}
          className="absolute inset-0"
          enableScrubbing={false}
        />
      ) : (
        <p className="text-xs text-muted-foreground p-2">Video URL not available.</p>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-destructive bg-black/20 hover:bg-destructive/20 backdrop-blur-sm"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Delete video"
      >
        {isDeleting ? (
          <svg className="animate-spin h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}; 