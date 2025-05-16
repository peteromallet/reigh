
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  className?: string;
  label?: string;
}

const ImageUpload = ({
  onImageSelect,
  className,
  label = "Upload Image",
}: ImageUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFile(file);
  };

  const handleFile = (file: File | null) => {
    if (file) {
      onImageSelect(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      onImageSelect(null);
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    handleFile(file);
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-center font-medium">{label}</div>}
      <div
        className={cn(
          "border-2 border-dashed rounded-md flex flex-col items-center justify-center p-4 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400",
          previewUrl ? "bg-transparent" : "bg-gray-50",
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="imageUpload"
        />
        <label htmlFor="imageUpload" className="w-full h-full cursor-pointer">
          <div className="flex flex-col items-center justify-center h-full">
            {previewUrl ? (
              <div className="relative w-full">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto object-contain max-h-48"
                />
              </div>
            ) : (
              <div className="text-center p-6">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Drag and drop or click to upload
                </p>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};

export { ImageUpload };
