import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCreateShot, useAddImageToShot, useListShots } from '../hooks/useShots';
import { NEW_GROUP_DROPPABLE_ID } from '../components/NewGroupDropZone';
import { useToast } from "@/hooks/use-toast"; // For feedback
import React, { createContext, useState, useContext } from 'react'; // Import context tools

// 1. Create Context for Last Affected Shot ID
interface LastAffectedShotContextType {
  lastAffectedShotId: string | undefined;
  setLastAffectedShotId: (id: string | undefined) => void;
}
const LastAffectedShotContext = createContext<LastAffectedShotContextType | undefined>(undefined);

export const useLastAffectedShot = () => {
  const context = useContext(LastAffectedShotContext);
  if (!context) {
    throw new Error('useLastAffectedShot must be used within a LastAffectedShotProvider');
  }
  return context;
};

const queryClient = new QueryClient();

// New component to house the logic requiring QueryClient context
const AppContent = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the mouse to move by at least 8 pixels before initiating a drag
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const { toast } = useToast();
  
  // Shot-related hooks
  const { data: shots, isLoading: isLoadingShots } = useListShots();
  const createShotMutation = useCreateShot();
  const addImageToShotMutation = useAddImageToShot();

  // Get setLastAffectedShotId from context (will be provided higher up by LastAffectedShotProvider)
  const { setLastAffectedShotId } = useLastAffectedShot();

  const handleDragEnd = async (event: DragEndEvent) => {
    // Avoid JSON.stringify on the full event object as it can contain circular references.
    console.log('handleDragEnd triggered.', {
      activeId: event.active?.id,
      overId: event.over?.id,
    });
    const { active, over } = event;

    if (!over) {
      console.log('handleDragEnd: No droppable target.');
      return;
    }

    const draggableItem = active.data.current;
    const droppableZone = over.data.current;
    console.log('handleDragEnd: Draggable Item:', draggableItem, 'Droppable Zone:', droppableZone);

    if (!draggableItem || !droppableZone) {
      console.warn('Drag and drop data missing', { active, over });
      return;
    }

    const generationId = draggableItem.generationId;
    const imageUrl = draggableItem.imageUrl;
    const thumbUrl = draggableItem.thumbUrl;

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
        });
        setLastAffectedShotId(shotId);
        toast({ title: "Image Added", description: "Successfully added image to shot." });

      } else if (over.id === NEW_GROUP_DROPPABLE_ID && droppableZone.type === 'new-group-zone') {
        const currentShotCount = shots ? shots.length : 0;
        const newShotName = `Shot ${currentShotCount + 1}`;
        
        const newShot = await createShotMutation.mutateAsync(newShotName);
        if (newShot && newShot.id) {
          await addImageToShotMutation.mutateAsync({ 
            shot_id: newShot.id, 
            generation_id: generationId,
            imageUrl: imageUrl,
            thumbUrl: thumbUrl,
          });
          setLastAffectedShotId(newShot.id);
          toast({ title: "Shot Created & Image Added", description: `Image added to new shot: ${newShotName}` });
        } else {
          throw new Error('Failed to create new shot or new shot ID is missing.');
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      // The toast message now includes the specific error from the database if available
      toast({ title: "Failed to process drop.", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DndContext>
    </TooltipProvider>
  );
};

const App = () => {
  const [lastAffectedShotId, setLastAffectedShotIdState] = useState<string | undefined>(undefined);

  return (
    <QueryClientProvider client={queryClient}>
      <LastAffectedShotContext.Provider value={{ lastAffectedShotId, setLastAffectedShotId: setLastAffectedShotIdState }}>
        <AppContent />
      </LastAffectedShotContext.Provider>
    </QueryClientProvider>
  );
};

export default App;
