import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCreateShot, useAddImageToShot, useListShots } from '@/shared/hooks/useShots';
import { NEW_GROUP_DROPPABLE_ID } from '@/shared/components/ShotsPane/NewGroupDropZone';
import { useToast } from "@/shared/hooks/use-toast";
import { LastAffectedShotProvider } from "@/shared/contexts/LastAffectedShotContext";
import { useLastAffectedShot } from "@/shared/hooks/useLastAffectedShot";
import { AppRoutes } from "./routes";
import { GlobalHeader } from "@/shared/components/GlobalHeader";

const queryClient = new QueryClient();

// New inner component that uses the context
const AppInternalContent = () => {
  const { setLastAffectedShotId } = useLastAffectedShot();

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

  const { toast } = useToast();
  
  const { data: shots } = useListShots();
  const createShotMutation = useCreateShot();
  const addImageToShotMutation = useAddImageToShot();

  const handleDragEnd = async (event: DragEndEvent) => {
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
        } else {
          throw new Error('Failed to create new shot or new shot ID is missing.');
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ title: "Failed to process drop.", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <TooltipProvider>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <GlobalHeader />
        <div className="flex flex-col" style={{minHeight: 'calc(100vh - 3.5rem)'}}>
          <main className="flex-grow container mx-auto p-4">
            <AppRoutes />
          </main>
        </div>
        <Sonner />
      </DndContext>
    </TooltipProvider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LastAffectedShotProvider>
        <AppInternalContent />
      </LastAffectedShotProvider>
    </QueryClientProvider>
  );
}

export default App;
