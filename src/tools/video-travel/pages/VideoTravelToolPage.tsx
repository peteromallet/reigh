import React, { useState } from 'react';
import VideoEditLayout from '../components/VideoEditLayout';
import { useListShots } from '@/shared/hooks/useShots'; 
import { Shot } from '@/types/shots';
import { Button } from '@/shared/components/ui/button'; // Added for shot list items
// import { useLastAffectedShot } from '@/shared/hooks/useLastAffectedShot';

// Placeholder data or logic to fetch actual data for VideoEditLayout
// This will need to be fleshed out based on VideoEditLayout's requirements

const VideoTravelToolPage: React.FC = () => {
  const { data: shots, isLoading, error } = useListShots();
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  // const { lastAffectedShotId, setLastAffectedShotId } = useLastAffectedShot(); // Keep for later if needed

  // Mocking or preparing props for VideoEditLayout - these might need to be dynamic based on selectedShot
  // For now, videoPairConfigs will be empty. Logic to create pairs from selectedShot.images will be needed.
  const [videoPairConfigs, setVideoPairConfigs] = useState([]); // Placeholder
  const [videoControlMode, setVideoControlMode] = useState<'individual' | 'batch'>('batch');
  const [batchVideoPrompt, setBatchVideoPrompt] = useState("");
  const [batchVideoFrames, setBatchVideoFrames] = useState(50);
  const [batchVideoContext, setBatchVideoContext] = useState(18);

  const handleSelectShot = (shot: Shot) => {
    setSelectedShot(shot);
    // Reset or initialize video pair configs and other settings when a new shot is selected
    // For now, just setting an empty array.
    // A real implementation would generate pairs from shot.images
    if (shot.images && shot.images.length >= 2) {
      // Basic pairing logic: take consecutive images.
      // This is a simplified example.
      const newPairs = [];
      for (let i = 0; i < shot.images.length - 1; i++) {
        newPairs.push({
          id: `pair-${shot.images[i].id}-${shot.images[i+1].id}`,
          imageA: shot.images[i],
          imageB: shot.images[i+1],
          prompt: '', // Default prompt
          frames: 50,  // Default frames
          context: 18, // Default context
        });
      }
      setVideoPairConfigs(newPairs);
    } else {
      setVideoPairConfigs([]);
    }
  };

  const handleBackToShotList = () => {
    setSelectedShot(null);
    setVideoPairConfigs([]); // Clear configs when going back
  };

  if (isLoading) return <div className="container mx-auto p-4">Loading shots...</div>;
  if (error) return <div className="container mx-auto p-4">Error loading shots: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Video Travel Tool</h1>
      
      {!selectedShot ? (
        <>
          <p className="mb-4 text-muted-foreground">
            Select a shot to create video sequences by defining travel paths between its images.
          </p>
          {shots && shots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shots.map((shot) => (
                <Button
                  key={shot.id}
                  variant="outline"
                  className="p-4 h-auto flex flex-col items-start justify-start text-left"
                  onClick={() => handleSelectShot(shot)}
                >
                  <h2 className="text-lg font-semibold mb-1">{shot.name}</h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    Images: {shot.images?.length || 0}
                  </p>
                  {shot.images && shot.images.length > 0 && (
                    <div className="flex items-center space-x-1 mt-1">
                      {shot.images.slice(0, 6).map((image, idx) => (
                        <div key={image.id || `thumb-${idx}`} className="w-12 h-12 rounded bg-muted/50 flex items-center justify-center overflow-hidden border">
                          <img 
                            src={image.thumbUrl || image.imageUrl || '/placeholder.svg'} 
                            alt={`${shot.name} thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {shot.images.length > 6 && (
                        <div className="w-12 h-12 rounded bg-muted/60 flex items-center justify-center text-xs font-medium text-muted-foreground border">
                          +{shot.images.length - 6} more
                        </div>
                      )}
                    </div>
                  )}
                </Button>
              ))}
            </div>
          ) : (
            <p>No shots available for video travel.</p>
          )}
        </>
      ) : (
        <VideoEditLayout
          selectedShot={selectedShot}
          videoPairConfigs={videoPairConfigs}
          videoControlMode={videoControlMode}
          batchVideoPrompt={batchVideoPrompt}
          batchVideoFrames={batchVideoFrames}
          batchVideoContext={batchVideoContext}
          onBack={handleBackToShotList}
          onVideoControlModeChange={setVideoControlMode}
          onPairConfigChange={(pairId, field, value) => {
            setVideoPairConfigs(prev => prev.map(p => p.id === pairId ? { ...p, [field]: value } : p));
          }}
          onBatchVideoPromptChange={setBatchVideoPrompt}
          onBatchVideoFramesChange={setBatchVideoFrames}
          onBatchVideoContextChange={setBatchVideoContext}
        />
      )}
    </div>
  );
};

export default VideoTravelToolPage; 