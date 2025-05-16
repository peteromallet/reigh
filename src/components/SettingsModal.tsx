
import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SettingsModalProps {
  currentFalApiKey: string;
  onSaveApiKeys: (falApiKey: string, openaiApiKey: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  currentFalApiKey,
  onSaveApiKeys,
}) => {
  const [falApiKey, setFalApiKey] = useState<string>(currentFalApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  // Load OpenAI API key from sessionStorage if it exists
  useEffect(() => {
    const storedOpenaiKey = sessionStorage.getItem('openai_api_key') || "";
    if (storedOpenaiKey) {
      setOpenaiApiKey(storedOpenaiKey);
    }
  }, []);

  const handleSave = () => {
    // Save the API keys and close the modal
    onSaveApiKeys(falApiKey, openaiApiKey);
    setIsOpen(false);
    toast.success("Settings saved successfully");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 rounded-full"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys for image generation services.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fal-api-key">Fal.ai API Key</Label>
            <Input
              id="fal-api-key"
              type="text"
              value={falApiKey}
              onChange={(e) => setFalApiKey(e.target.value)}
              placeholder="Enter your Fal.ai API key"
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Used for image generation with Fal.ai services.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">OpenAI API Key (not used yet)</Label>
            <Input
              id="openai-api-key"
              type="text"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Will be used for future AI features.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
