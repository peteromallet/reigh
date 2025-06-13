
import React, { useContext } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useHandleExternalImageDrop, useCreateShot, useAddImageToShot, useListShots } from "@/shared/hooks/useShots";
import { NEW_GROUP_DROPPABLE_ID } from '@/shared/components/ShotsPane/NewGroupDropZone';
import { LastAffectedShotProvider, LastAffectedShotContext } from '@/shared/contexts/LastAffectedShotContext';
import { AppRoutes } from "./routes";
import { ProjectProvider, useProject } from "@/shared/contexts/ProjectContext";
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { PanesProvider } from '@/shared/contexts/PanesContext';
import { CurrentShotProvider } from '@/shared/contexts/CurrentShotContext';
import { getRandomDummyName } from '@/shared/lib/dummyNames';

const queryClient = new QueryClient();

// New inner component that uses the context
const AppInternalContent = () => {
  useWebSocket(); // Initialize WebSocket connection and listeners
  const context = useContext(LastAffectedShotContext);
  if (!context) throw new Error("useLastAffectedShot must be used within a LastAffectedShotProvider");
  const { setLastAffectedShotId } = context;

  const { selectedProjectId } = useProject();
  const { data: shotsFromHook, isLoading: isLoadingShots } = useListShots(selectedProjectId);

  console.log('[App] shotsFromHook:', shotsFromHook);
  console.log('[App] shotsFromHook type check - is array?:', Array.isArray(shotsFromHook));
  
  // DEBUG: Check if shotsFromHook is iterable before using it
  if (shotsFromHook !== null && shotsFromHook !== undefined) {
    if (typeof shotsFromHook[Symbol.iterator] !== 'function') {
      console.error('[App] ERROR: shotsFromHook is not iterable!', shotsFromHook);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createShotMutation = useCreateShot();
  const addImageToShotMutation = useAddImageToShot();
  const handleExternalImageDropMutation = useHandleExternalImageDrop();

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('handleDragEnd triggered.', {
      activeId: event.active?.id,
      overId: event.over?.id,
    });
    const { active, over } = event;

    if (!selectedProjectId) {
      console.warn('handleDragEnd: No selectedProjectId available');
      return;
    }

    if (!over) {
      console.log('handleDragEnd: No drop target');
      return;
    }

    const draggableItem = active.data.current;
    const droppableZone = over.data.current;

    if (!draggableItem || !droppableZone) {
      console.warn('Drag and drop data missing', { active, over });
      return;
    }

    const generationId = draggableItem.generationId;
    const imageUrl = draggableItem.imageUrl;
    const thumbUrl = draggableItem.thumbUrl;
    const isExternalFile = draggableItem.isExternalFile;
    const externalFile = draggableItem.externalFile;

    if (isExternalFile && externalFile) {
      if (droppableZone.type === 'new-group-zone' || droppableZone.type === 'shot-group') {
        const targetShotId = droppableZone.type === 'shot-group' ? droppableZone.shotId : null;
        const currentShotsCount = Array.isArray(shotsFromHook) ? shotsFromHook.length : 0;
        
        const result = await handleExternalImageDropMutation.mutateAsync({
            imageFiles: [externalFile], 
            targetShotId, 
            currentProjectQueryKey: selectedProjectId, 
            currentShotCount: currentShotsCount
        });

        if (result && result.shotId) {
            setLastAffectedShotId(result.shotId);
        }
        return;
      }
    }

    if (!generationId) {
      console.warn('generationId missing from draggable item', draggableItem);
      return;
    }

    console.log(`Attempting to process drop: generationId=${generationId}, droppableType=${droppableZone.type}, droppableId=${over.id}, shotId=${droppableZone.shotId}`);

    try {
      if (droppableZone.type === 'shot-group') {
        const shotId = droppableZone.shotId;
        if (!shotId) {
          console.warn('shotId missing from shot-group droppable', droppableZone);
          return;
        }
        await addImageToShotMutation.mutateAsync({ 
          shot_id: shotId, 
          generation_id: generationId,
          imageUrl: imageUrl,
          thumbUrl: thumbUrl,
          project_id: selectedProjectId,
        });
        setLastAffectedShotId(shotId);

      } else if (over.id === NEW_GROUP_DROPPABLE_ID && droppableZone.type === 'new-group-zone') {
        const newShotName = getRandomDummyName();
        
        const newShot = await createShotMutation.mutateAsync({ shotName: newShotName, projectId: selectedProjectId });
        if (newShot && newShot.id) {
          await addImageToShotMutation.mutateAsync({ 
            shot_id: newShot.id,
            generation_id: generationId,
            imageUrl: imageUrl,
            thumbUrl: thumbUrl,
            project_id: selectedProjectId,
          });
          setLastAffectedShotId(newShot.id);
        } else {
          throw new Error('Failed to create new shot or new shot ID is missing.');
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    }
  };

  return (
    <TooltipProvider>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <AppRoutes />
        <Sonner />
      </DndContext>
    </TooltipProvider>
  );
};

function App() {
  console.log('[App] Initializing application...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <PanesProvider>
          <LastAffectedShotProvider>
            <CurrentShotProvider>
              <AppInternalContent />
            </CurrentShotProvider>
          </LastAffectedShotProvider>
        </PanesProvider>
      </ProjectProvider>
    </QueryClientProvider>
  );
}

export default App;
