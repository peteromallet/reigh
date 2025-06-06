import React, { useState, useEffect } from 'react';
import ShotEditor, { SteerableMotionSettings } from '../components/ShotEditor';
import { useListShots, useCreateShot } from '@/shared/hooks/useShots';
import { Shot } from '@/types/shots';
import { Button } from '@/shared/components/ui/button';
import { useProject } from "@/shared/contexts/ProjectContext";
import CreateShotModal from '../components/CreateShotModal';
import ShotListDisplay from '../components/ShotListDisplay';
import { useQueryClient } from '@tanstack/react-query';
// import { useLastAffectedShot } from '@/shared/hooks/useLastAffectedShot';

// Placeholder data or logic to fetch actual data for VideoEditLayout
// This will need to be fleshed out based on VideoEditLayout's requirements

const VideoTravelToolPage: React.FC = () => {
  const { selectedProjectId } = useProject();
  const { data: shots, isLoading, error, refetch: refetchShots } = useListShots(selectedProjectId);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const createShotMutation = useCreateShot();
  const [isCreateShotModalOpen, setIsCreateShotModalOpen] = useState(false);
  const queryClient = useQueryClient();
  // const { lastAffectedShotId, setLastAffectedShotId } = useLastAffectedShot(); // Keep for later if needed

  // Add state for video generation settings
  const [videoControlMode, setVideoControlMode] = useState<'individual' | 'batch'>('batch');
  const [batchVideoPrompt, setBatchVideoPrompt] = useState('');
  const [batchVideoFrames, setBatchVideoFrames] = useState(30);
  const [batchVideoContext, setBatchVideoContext] = useState(10);
  const [batchVideoSteps, setBatchVideoSteps] = useState(4);
  const [dimensionSource, setDimensionSource] = useState<'project' | 'firstImage' | 'custom'>('firstImage');
  const [customWidth, setCustomWidth] = useState<number | undefined>();
  const [customHeight, setCustomHeight] = useState<number | undefined>();
  const [videoPairConfigs, setVideoPairConfigs] = useState<any[]>([]);
  const [steerableMotionSettings, setSteerableMotionSettings] = useState<SteerableMotionSettings>({
    negative_prompt: '',
    model_name: 'vace_14B',
    seed: 789,
    debug: true,
    apply_reward_lora: true,
    colour_match_videos: true,
    apply_causvid: true,
    fade_in_duration: '{"low_point":0.0,"high_point":0.8,"curve_type":"ease_in_out","duration_factor":0.0}',
    fade_out_duration: '{"low_point":0.0,"high_point":0.8,"curve_type":"ease_in_out","duration_factor":0.0}',
    after_first_post_generation_saturation: 0.75,
    after_first_post_generation_brightness: -0.3,
  });

  useEffect(() => {
    if (!selectedProjectId) {
      if (selectedShot) {
        setSelectedShot(null);
        setVideoPairConfigs([]); 
      }
      return;
    }
    if (shots) {
      if (selectedShot) {
        const updatedShotFromList = shots.find(s => s.id === selectedShot.id && s.project_id === selectedProjectId);
        if (updatedShotFromList) {
          if (JSON.stringify(selectedShot) !== JSON.stringify(updatedShotFromList)) {
            setSelectedShot(updatedShotFromList);
          }
        } else {
          setSelectedShot(null);
          setVideoPairConfigs([]);
        }
      }
    } else if (!isLoading && selectedShot) {
      setSelectedShot(null);
      setVideoPairConfigs([]);
    }
  }, [shots, selectedShot, selectedProjectId, isLoading]);

  useEffect(() => {
    if (selectedShot?.images && selectedShot.images.length >= 2) {
      const nonVideoImages = selectedShot.images.filter(img => !img.type?.includes('video'));
      if (nonVideoImages.length >= 2) {
        const pairs = [];
        for (let i = 0; i < nonVideoImages.length - 1; i++) {
          pairs.push({
            id: `${nonVideoImages[i].id}_${nonVideoImages[i + 1].id}`,
            imageA: nonVideoImages[i],
            imageB: nonVideoImages[i + 1],
            prompt: '',
            frames: 30,
            context: 10,
          });
        }
        setVideoPairConfigs(pairs);
      }
    }
  }, [selectedShot?.images]);

  const handleShotSelect = (shot: Shot) => {
    setSelectedShot(shot);
  };

  const handleBackToShotList = () => {
    setSelectedShot(null);
    setVideoPairConfigs([]);
  };

  const handleModalSubmitCreateShot = async (name: string) => {
    if (!selectedProjectId) {
      console.error("[VideoTravelToolPage] Cannot create shot: No project selected");
      return;
    }

    try {
      const newShot = await createShotMutation.mutateAsync({
        shotName: name,
        projectId: selectedProjectId,
      });
      
      // Refetch shots to update the list
      await refetchShots();
      
      // Select the newly created shot
      setSelectedShot(newShot);
      
      // Close the modal
      setIsCreateShotModalOpen(false);
    } catch (error) {
      console.error("[VideoTravelToolPage] Error creating shot:", error);
    }
  };

  const handleShotImagesUpdate = () => {
    if (selectedProjectId && selectedShot?.id) {
      // Invalidate and refetch the shots query to get updated data
      queryClient.invalidateQueries({ queryKey: ['shots', selectedProjectId] });
    }
  };

  const handleSteerableMotionSettingsChange = (settings: Partial<typeof steerableMotionSettings>) => {
    setSteerableMotionSettings(prev => ({
      ...prev,
      ...settings
    }));
  };

  if (!selectedProjectId) {
    return <div className="p-4">Please select a project first.</div>;
  }

  if (error) {
    return <div className="p-4">Error loading shots: {error.message}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {!selectedShot ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Video Travel Tool</h1>
            <Button onClick={() => setIsCreateShotModalOpen(true)}>Create New Shot</Button>
          </div>
          <ShotListDisplay
            shots={shots || []}
            onSelectShot={handleShotSelect}
            currentProjectId={selectedProjectId}
          />
        </>
      ) : (
        <ShotEditor
          selectedShot={selectedShot}
          projectId={selectedProjectId}
          videoPairConfigs={videoPairConfigs}
          videoControlMode={videoControlMode}
          batchVideoPrompt={batchVideoPrompt}
          batchVideoFrames={batchVideoFrames}
          batchVideoContext={batchVideoContext}
          orderedShotImages={selectedShot.images || []}
          onShotImagesUpdate={handleShotImagesUpdate}
          onBack={handleBackToShotList}
          onVideoControlModeChange={setVideoControlMode}
          onPairConfigChange={(pairId, field, value) => {
            setVideoPairConfigs(prev => prev.map(p => p.id === pairId ? { ...p, [field]: value } : p));
          }}
          onBatchVideoPromptChange={setBatchVideoPrompt}
          onBatchVideoFramesChange={setBatchVideoFrames}
          onBatchVideoContextChange={setBatchVideoContext}
          batchVideoSteps={batchVideoSteps}
          onBatchVideoStepsChange={setBatchVideoSteps}
          dimensionSource={dimensionSource}
          onDimensionSourceChange={setDimensionSource}
          customWidth={customWidth}
          onCustomWidthChange={setCustomWidth}
          customHeight={customHeight}
          onCustomHeightChange={setCustomHeight}
          steerableMotionSettings={steerableMotionSettings}
          onSteerableMotionSettingsChange={handleSteerableMotionSettingsChange}
          onGenerateAllSegments={() => {}}
        />
      )}

      <CreateShotModal 
        isOpen={isCreateShotModalOpen}
        onClose={() => setIsCreateShotModalOpen(false)}
        onSubmit={handleModalSubmitCreateShot}
        isLoading={createShotMutation.isPending}
      />
    </div>
  );
};

export default VideoTravelToolPage; 