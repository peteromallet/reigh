import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { X, UploadCloud, ImagePlus, VideoIcon } from "lucide-react";
import { toast } from "sonner";

interface FileInputProps {
  onFileChange: (file: File | null) => void;
  onFileRemove?: () => void; // Optional: if specific logic beyond clearing is needed
  acceptTypes?: ('image' | 'video')[];
  label?: string;
  currentFilePreviewUrl?: string | null; // External preview URL (e.g., from a parent component)
  currentFileName?: string | null; // External file name
  className?: string;
  disabled?: boolean;
}

const FileInput: React.FC<FileInputProps> = ({
  onFileChange,
  onFileRemove,
  acceptTypes = ['image'],
  label = "Input File",
  currentFilePreviewUrl,
  currentFileName,
  className = "",
  disabled = false,
}) => {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [internalPreviewUrl, setInternalPreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedMimeTypes = acceptTypes
    .map(type => (type === 'image' ? 'image/*' : 'video/*'))
    .join(',');

  // Effect for managing internal preview URL based on internalFile
  useEffect(() => {
    let objectUrl: string | null = null;
    if (internalFile) {
      objectUrl = URL.createObjectURL(internalFile);
      setInternalPreviewUrl(objectUrl);
    } else {
      // No internal file, ensure any existing internal object URL is cleared and revoked
      if (internalPreviewUrl && internalPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(internalPreviewUrl);
      }
      setInternalPreviewUrl(null);
    }

    return () => {
      // This cleanup runs when internalFile changes (before the new effect runs)
      // or when the component unmounts.
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [internalFile]); // Only depends on internalFile

  const handleFileSelect = useCallback((file: File | null) => {
    // Revoke previous internal URL *if it exists and belongs to a previous internalFile*
    // This is now primarily handled by the useEffect cleanup when internalFile changes.
    // However, if a file is selected rapidly, we might want to ensure the old one is gone.
    if (internalPreviewUrl && internalPreviewUrl.startsWith('blob:')) {
       // The useEffect tied to internalFile will handle this when internalFile is set/nulled
       // setInternalPreviewUrl(null); // No longer explicitly null here, let useEffect do it
    }

    if (file) {
      const fileType = file.type.split('/')[0];
      if (
        (acceptTypes.includes('image') && fileType === 'image') ||
        (acceptTypes.includes('video') && fileType === 'video')
      ) {
        setInternalFile(file); // This will trigger the useEffect to create/set internalPreviewUrl
        onFileChange(file);
      } else {
        toast.error(`Invalid file type. Please upload ${acceptTypes.join(' or ')}.`);
        setInternalFile(null); // This will trigger the useEffect to clear internalPreviewUrl
        onFileChange(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } else {
      setInternalFile(null); // This will trigger the useEffect to clear internalPreviewUrl
      onFileChange(null);
    }
  }, [acceptTypes, onFileChange]); // Removed internalPreviewUrl from deps as useEffect now manages it

  const handleRemoveFile = useCallback(() => {
    setInternalFile(null); // Triggers useEffect to clear internalPreviewUrl
    onFileChange(null);
    if (onFileRemove) {
      onFileRemove();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFileChange, onFileRemove]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files ? event.target.files[0] : null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  // Determine which preview and name to display
  const displayPreviewUrl = internalFile ? internalPreviewUrl : currentFilePreviewUrl;
  const displayFileName = internalFile ? internalFile.name : currentFileName;
  
  let displayFileType = internalFile?.type.split('/')[0];
  if (!displayFileType && displayPreviewUrl) {
    // Infer from URL if internalFile is not set (e.g. preview from localStorage)
    if (displayPreviewUrl.startsWith('data:video') || displayPreviewUrl.includes('.mp4') || displayPreviewUrl.includes('.webm')) {
        displayFileType = 'video';
    } else if (displayPreviewUrl.startsWith('data:image') || displayPreviewUrl.includes('.jpg') || displayPreviewUrl.includes('.png') || displayPreviewUrl.includes('.jpeg') || displayPreviewUrl.includes('.gif') || displayPreviewUrl.includes('.webp') || displayPreviewUrl.startsWith('blob:http')) {
        displayFileType = 'image';
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor="file-input-element">{label}</Label>}
      <div
        className={`border-2 border-dashed rounded-md p-6 text-center
                    ${isDraggingOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}
                    ${disabled ? 'cursor-not-allowed bg-muted/50' : 'cursor-pointer hover:border-muted-foreground/50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Input
          id="file-input-element"
          ref={fileInputRef}
          type="file"
          accept={acceptedMimeTypes}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        {!displayPreviewUrl && (
          <div className="flex flex-col items-center space-y-2 text-muted-foreground">
            <UploadCloud className="h-10 w-10" />
            <p>Drag & drop or click to upload</p>
            <p className="text-xs">
              Accepted: {acceptTypes.join(', ')}
            </p>
          </div>
        )}
        {displayPreviewUrl && (
          <div className="relative group">
            {displayFileType === 'image' ? (
              <img
                src={displayPreviewUrl}
                alt={displayFileName || 'Preview'}
                className="rounded-md max-h-48 w-auto mx-auto object-contain"
              />
            ) : displayFileType === 'video' ? (
              <video
                src={displayPreviewUrl}
                controls
                className="rounded-md max-h-48 w-auto mx-auto"
              >
                Your browser does not support the video tag.
              </video>
            ) : (
               <div className="mt-2 border rounded-md p-2 h-32 flex items-center justify-center bg-muted max-w-xs mx-auto">
                  {/* Fallback display if type is unknown but preview URL exists */}
                  <p className="text-xs text-muted-foreground">Preview</p> 
                </div>
            )}
            {!disabled && (
                <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                onClick={(e) => {
                    e.stopPropagation(); // Prevent click on dropzone
                    handleRemoveFile();
                }}
                aria-label="Remove file"
                >
                <X className="h-4 w-4" />
                </Button>
            )}
            {displayFileName && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={displayFileName}>
                {displayFileName}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileInput; 