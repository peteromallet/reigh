import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PromptEntry, PromptInputRow } from '@/components/ImageGenerationForm'; // Assuming PromptInputRow is exported
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle } from 'lucide-react';

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: PromptEntry[];
  onSave: (updatedPrompts: PromptEntry[]) => void;
  onUpdatePrompt: (id: string, field: 'fullPrompt', value: string) => void;
  onAddPrompt: (source: 'modal') => void; // Specify source if needed
  onRemovePrompt: (id: string) => void;
  generatePromptId: () => string; // To generate IDs for new prompts in modal
  isGenerating?: boolean;
  hasApiKey?: boolean;
}

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen, onClose, prompts, onSave, 
  onUpdatePrompt, onAddPrompt, onRemovePrompt, 
  isGenerating, hasApiKey
}) => {
  // Internal state for edits within the modal if needed, or can directly modify parent state via onUpdatePrompt
  // For simplicity here, we'll assume onUpdatePrompt handles live updates to the parent state.

  const handleSave = () => {
    onSave(prompts); // Parent will handle actual saving/validation
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl sm:max-w-xl"> {/* Responsive width, removed invalid chars */}
        <DialogHeader>
          <DialogTitle>Edit Prompts</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-1 pr-3">
          <div className="space-y-4 p-3">
            {prompts.map((promptEntry, index) => (
              <PromptInputRow
                key={promptEntry.id}
                promptEntry={promptEntry}
                onUpdate={onUpdatePrompt}
                onRemove={onRemovePrompt}
                canRemove={prompts.length > 1}
                isGenerating={isGenerating}
                hasApiKey={hasApiKey}
                index={index}
                showShortPromptInput={false} // No short prompt input here either by default
              />
            ))}
             <Button 
                type="button" 
                variant="outline" 
                className="w-full mt-3"
                onClick={() => onAddPrompt('modal')}
                disabled={!hasApiKey || isGenerating}
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Prompt
            </Button>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isGenerating}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PromptEditorModal; 