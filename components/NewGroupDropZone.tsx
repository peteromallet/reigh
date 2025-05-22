import React from 'react';
import { useDroppable } from '@dnd-kit/core';

const NEW_GROUP_DROPPABLE_ID = 'new-shot-group-dropzone';

const NewGroupDropZone: React.FC = () => {
  const { isOver, setNodeRef } = useDroppable({
    id: NEW_GROUP_DROPPABLE_ID,
    data: {
      type: 'new-group-zone',
    }
  });

  const style = {
    borderColor: isOver ? 'green' : '#4B5563', // gray-600
    // Add other visual feedback for drop target highlighting
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="new-group-drop-zone p-4 border-2 border-dashed rounded flex items-center justify-center min-w-[200px] transition-colors"
    >
      <p className="text-gray-400">{isOver ? 'Release to create new shot' : 'Drop here to create new shot'}</p>
    </div>
  );
};

export default NewGroupDropZone;
export { NEW_GROUP_DROPPABLE_ID }; 