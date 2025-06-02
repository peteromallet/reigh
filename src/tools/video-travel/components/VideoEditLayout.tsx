import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Shot, GenerationRow } from "@/types/shots"; // Adjusted path

// Interface for individual video pair configuration (copied from Index.tsx)
export interface VideoPairConfig {
  id: string;
  imageA: GenerationRow;
  imageB: GenerationRow;
  prompt: string;
  frames: number;
  context: number;
  generatedVideoUrl?: string;
}

interface VideoEditLayoutProps {
  selectedShot: Shot;
  videoPairConfigs: VideoPairConfig[];
  videoControlMode: 'individual' | 'batch';
  batchVideoPrompt: string;
  batchVideoFrames: number;
  batchVideoContext: number;
  onBack: () => void;
  onVideoControlModeChange: (mode: 'individual' | 'batch') => void;
  onPairConfigChange: (pairId: string, field: keyof Omit<VideoPairConfig, 'imageA' | 'imageB' | 'id' | 'generatedVideoUrl'>, value: string | number) => void;
  onBatchVideoPromptChange: (value: string) => void;
  onBatchVideoFramesChange: (value: number) => void;
  onBatchVideoContextChange: (value: number) => void;
  // Add any other necessary props, e.g., for generating videos
}

const VideoEditLayout: React.FC<VideoEditLayoutProps> = ({
  selectedShot,
  videoPairConfigs,
  videoControlMode,
  batchVideoPrompt,
  batchVideoFrames,
  batchVideoContext,
  onBack,
  onVideoControlModeChange,
  onPairConfigChange,
  onBatchVideoPromptChange,
  onBatchVideoFramesChange,
  onBatchVideoContextChange,
}) => {
  if (!selectedShot) {
    // This case should ideally be handled by the parent, but as a fallback:
    return <p>No shot selected for video editing.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <Button onClick={onBack} className="mb-6">Back to Video Shots List</Button>
      <h2 className="text-3xl font-bold mb-1">Video Edit: {selectedShot.name}</h2>
      <p className="text-muted-foreground mb-3">Configure and generate video segments for image pairs.</p>
      
      <div className="mb-6 flex items-center space-x-2">
        <Label className="text-sm font-medium">Control Mode:</Label>
        <Button 
          variant={videoControlMode === 'batch' ? 'secondary' : 'outline'} 
          size="sm"
          onClick={() => onVideoControlModeChange('batch')}
        >
          Batch
        </Button>
        <Button 
          variant={videoControlMode === 'individual' ? 'secondary' : 'outline'} 
          size="sm"
          onClick={() => onVideoControlModeChange('individual')}
        >
          Individual
        </Button>
      </div>

      {videoControlMode === 'individual' && videoPairConfigs.length > 0 && (
        <div className="space-y-8">
          {videoPairConfigs.map((pairConfig, index) => (
            <div key={pairConfig.id} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 p-4 border rounded-lg items-start bg-card shadow-md">
              {/* Column 1: Image Pair */}
              <div className="flex flex-col space-y-2 md:flex-row md:space-x-3 md:space-y-0">
                {/* Image A Block */}
                <div className="flex-1 flex flex-col space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground self-start">Image A</Label>
                  <div className="w-full h-36 bg-muted/50 rounded border flex items-center justify-center p-1 overflow-hidden">
                    <img 
                      src={pairConfig.imageA.thumbUrl || pairConfig.imageA.imageUrl || '/placeholder.svg'} 
                      alt={`Pair ${index + 1} - Image A`}
                      className="max-w-full max-h-full object-contain rounded-sm"
                    />
                  </div>
                </div>
                {/* Image B Block */}
                <div className="flex-1 flex flex-col space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground self-start">Image B</Label>
                  <div className="w-full h-36 bg-muted/50 rounded border flex items-center justify-center p-1 overflow-hidden">
                    <img 
                      src={pairConfig.imageB.thumbUrl || pairConfig.imageB.imageUrl || '/placeholder.svg'} 
                      alt={`Pair ${index + 1} - Image B`}
                      className="max-w-full max-h-full object-contain rounded-sm"
                    />
                  </div>
                </div>
              </div>
              {/* Column 2: Settings for this pair */}
              <div className="space-y-4 pt-1 md:pt-0">
                <div>
                  <Label htmlFor={`prompt-${pairConfig.id}`} className="text-sm font-medium block mb-1.5">Prompt</Label>
                  <Textarea 
                    id={`prompt-${pairConfig.id}`}
                    value={pairConfig.prompt}
                    onChange={(e) => onPairConfigChange(pairConfig.id, 'prompt', e.target.value)}
                    placeholder={`Video prompt for A to B...`}
                    className="min-h-[70px] text-sm"
                    rows={3}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`frames-${pairConfig.id}`} className="text-sm font-medium block mb-1">Frames: {pairConfig.frames}</Label>
                    <Slider
                      id={`frames-${pairConfig.id}`}
                      min={10}
                      max={120} 
                      step={1}
                      value={[pairConfig.frames]}
                      onValueChange={(val) => onPairConfigChange(pairConfig.id, 'frames', val[0])}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`context-${pairConfig.id}`} className="text-sm font-medium block mb-1">Context: {pairConfig.context}</Label>
                    <Slider
                      id={`context-${pairConfig.id}`}
                      min={0}
                      max={60}
                      step={1}
                      value={[pairConfig.context]}
                      onValueChange={(val) => onPairConfigChange(pairConfig.id, 'context', val[0])}
                    />
                  </div>
                </div>
              </div>
              {/* Column 3: Video Output & Generate Button */}
              <div className="flex flex-col space-y-2 items-center pt-2 md:pt-0">
                <Label className="text-xs font-medium text-muted-foreground self-center">Video Preview</Label>
                <div className="w-full aspect-video bg-muted/50 rounded border flex items-center justify-center overflow-hidden">
                  {pairConfig.generatedVideoUrl ? (
                    <video src={pairConfig.generatedVideoUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground text-center p-2">Video output will appear here</p>
                  )}
                </div>
                <Button size="sm" className="w-full mt-1" disabled>Generate Video</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {videoControlMode === 'batch' && videoPairConfigs.length > 0 && (
        <div className="space-y-6">
          {/* Batch Settings Controls */}
          <div className="p-4 border rounded-lg bg-card shadow-md space-y-4">
            <h3 className="text-lg font-semibold">Batch Generation Settings</h3>
            <div>
              <Label htmlFor="batchVideoPrompt" className="text-sm font-medium block mb-1.5">Global Prompt</Label>
              <Textarea 
                id="batchVideoPrompt"
                value={batchVideoPrompt}
                onChange={(e) => onBatchVideoPromptChange(e.target.value)}
                placeholder="Enter a global prompt for all video segments... (e.g., cinematic transition)"
                className="min-h-[70px] text-sm"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="batchVideoFrames" className="text-sm font-medium block mb-1">Frames for all: {batchVideoFrames}</Label>
                <Slider
                  id="batchVideoFrames"
                  min={10}
                  max={120} 
                  step={1}
                  value={[batchVideoFrames]}
                  onValueChange={(value) => onBatchVideoFramesChange(value[0])}
                />
              </div>
              <div>
                <Label htmlFor="batchVideoContext" className="text-sm font-medium block mb-1">Context for all: {batchVideoContext}</Label>
                <Slider
                  id="batchVideoContext"
                  min={0}
                  max={60}
                  step={1}
                  value={[batchVideoContext]}
                  onValueChange={(value) => onBatchVideoContextChange(value[0])}
                />
              </div>
            </div>
          </div>

          {/* Image Gallery for Batch Mode - displays unique images from pairs */}
          <div className="p-4 border rounded-lg bg-card shadow-md">
            <h3 className="text-lg font-semibold mb-3">Image Sequence for Batch</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {[...new Map(videoPairConfigs.flatMap(p => [p.imageA, p.imageB]).map(img => [img.shotImageEntryId, img])).values()].map((image, idx) => (
                <div key={image.shotImageEntryId || `batch-img-${idx}`} className="aspect-square bg-muted/50 rounded border flex items-center justify-center p-1 overflow-hidden">
                  <img 
                    src={image.thumbUrl || image.imageUrl || '/placeholder.svg'}
                    alt={`Batch sequence image ${idx + 1}`}
                    className="max-w-full max-h-full object-contain rounded-sm"
                    title={`Image ID: ${image.id}`}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <Button size="lg" className="w-full" disabled>Generate All Videos (Batch)</Button>
        </div>
      )}

      {videoPairConfigs.length === 0 && (
        <p>No image pairs to configure. This shot might have less than one image, or an error occurred.</p>
      )}
    </div>
  );
};

export default VideoEditLayout; 