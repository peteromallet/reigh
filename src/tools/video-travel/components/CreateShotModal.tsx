import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface CreateShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (shotName: string) => Promise<void>; // onSubmit now only takes shotName
  isLoading?: boolean; // To disable button during submission
}

const CreateShotModal: React.FC<CreateShotModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [shotName, setShotName] = useState('');

  const handleSubmit = async () => {
    if (!shotName.trim()) {
      // Basic validation, or rely on parent/hook to toast
      alert('Shot name cannot be empty.'); 
      return;
    }
    await onSubmit(shotName.trim());
    setShotName(''); // Reset input after submission
    // onClose(); // Parent can decide to close based on submission success/failure if needed
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Shot</DialogTitle>
          <DialogDescription>
            Enter a name for your new shot. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shot-name" className="text-right">
              Name
            </Label>
            <Input 
              id="shot-name" 
              value={shotName} 
              onChange={(e) => setShotName(e.target.value)} 
              className="col-span-3" 
              placeholder="My Awesome Shot"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || !shotName.trim()}>
            {isLoading ? 'Creating...' : 'Save Shot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShotModal; 