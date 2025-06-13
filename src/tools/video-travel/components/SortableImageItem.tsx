import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GenerationRow } from '@/types/shots';
import { Button } from '@/shared/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';

interface SortableImageItemProps {
  image: GenerationRow;
  onDelete: (shotImageEntryId: string) => void;
  onDoubleClick: () => void;
  onClick: (event: React.MouseEvent) => void;
  isSelected: boolean;
}

const SKIP_CONFIRMATION_KEY = 'skipImageDeletionConfirmation';

const baseUrl = import.meta.env.VITE_API_TARGET_URL || '';

const getDisplayUrl = (relativePath: string | undefined): string => {
  if (!relativePath) return '/placeholder.svg'; // Default placeholder if no path
  // If it's already an absolute URL, a blob URL, or a root-relative path (like /placeholder.svg itself), use as is.
  if (relativePath.startsWith('http') || relativePath.startsWith('blob:') || relativePath.startsWith('/')) {
    return relativePath;
  }
  // For other relative paths (like 'files/image.png'), prepend the base URL.
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Ensure the relative path doesn't start with a slash if we are prepending base
  const cleanRelative = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  return `${cleanBase}/${cleanRelative}`;
};

export const SortableImageItem: React.FC<SortableImageItemProps> = ({
  image,
  onDelete,
  onDoubleClick,
  onClick,
  isSelected,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.shotImageEntryId,
  });
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [skipConfirmationNextTimeVisual, setSkipConfirmationNextTimeVisual] = useState(false);
  const currentDialogSkipChoiceRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none', // Recommended for Sortable with pointer/touch sensors
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shouldSkipConfirmation = sessionStorage.getItem(SKIP_CONFIRMATION_KEY) === 'true';
    if (shouldSkipConfirmation) {
      onDelete(image.shotImageEntryId);
    } else {
      setSkipConfirmationNextTimeVisual(false);
      currentDialogSkipChoiceRef.current = false;
      setIsConfirmDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    onDelete(image.shotImageEntryId);
    if (currentDialogSkipChoiceRef.current) {
      sessionStorage.setItem(SKIP_CONFIRMATION_KEY, 'true');
    }
    setIsConfirmDeleteDialogOpen(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative group bg-muted/50 rounded border p-1 flex flex-col items-center justify-center aspect-square overflow-hidden shadow-sm cursor-grab active:cursor-grabbing',
        { 'ring-2 ring-offset-2 ring-blue-500 border-blue-500': isSelected },
      )}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      <img
        src={getDisplayUrl(image.thumbUrl || image.imageUrl)}
        alt={`Image ${image.id}`}
        className="max-w-full max-h-full object-contain rounded-sm"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleDeleteClick}
        title="Remove image from shot"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Do you want to permanently remove this image from the shot? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 my-4">
            <Checkbox
              id="skip-confirm"
              checked={skipConfirmationNextTimeVisual}
              onCheckedChange={(checked) => {
                const booleanValue = Boolean(checked);
                setSkipConfirmationNextTimeVisual(booleanValue);
                currentDialogSkipChoiceRef.current = booleanValue;
              }}
            />
            <Label 
              htmlFor="skip-confirm" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              onClick={() => {
                const newValue = !skipConfirmationNextTimeVisual;
                setSkipConfirmationNextTimeVisual(newValue);
                currentDialogSkipChoiceRef.current = newValue;
              }}
            >
              Delete without confirmation in the future
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 