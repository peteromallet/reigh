import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PromptEntry, PromptInputRow, PromptInputRowProps } from '@/components/ImageGenerationForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, AlertTriangle, Wand2Icon, Edit, PackagePlus, ArrowUp } from 'lucide-react';
import { PromptGenerationControls, GenerationControlValues as PGC_GenerationControlValues } from '@/components/PromptGenerationControls';
import { BulkEditControls, BulkEditParams as BEC_BulkEditParams, BulkEditControlValues as BEC_BulkEditControlValues } from '@/components/BulkEditControls';
import { useAIInteractionService } from '@/hooks/useAIInteractionService';
import { AIPromptItem, GeneratePromptsParams, EditPromptParams, AIModelType } from '@/types/ai';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Debounce utility function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}

const PROMPT_EDITOR_MODAL_CONTROLS_KEY = 'artfulPaneCraftPromptEditorControlsSettings';

// Use aliased types for internal state if they were named the same
interface GenerationControlValues extends PGC_GenerationControlValues {}
interface BulkEditControlValues extends BEC_BulkEditControlValues {}

interface PersistedEditorControlsSettings {
  generationSettings?: GenerationControlValues;
  bulkEditSettings?: BulkEditControlValues;
  activeTab?: EditorMode;
}

interface PromptToEditState {
  id: string;
  originalText: string;
  instructions: string;
  modelType: AIModelType;
}

export interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: PromptEntry[];
  onSave: (updatedPrompts: PromptEntry[]) => void;
  onAutoSavePrompts: (updatedPrompts: PromptEntry[]) => void;
  generatePromptId: () => string;
  apiKey?: string;
}

type EditorMode = 'generate' | 'bulk-edit';

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen, onClose, prompts: initialPrompts, onSave, 
  onAutoSavePrompts,
  generatePromptId,
  apiKey,
}) => {
  const [internalPrompts, setInternalPrompts] = useState<PromptEntry[]>([]);
  const [promptToEdit, setPromptToEdit] = useState<PromptToEditState | null>(null);
  const actualCanUseAI = !!apiKey;
  const [activeTab, setActiveTab] = useState<EditorMode>('generate');
  const [activePromptIdForFullView, setActivePromptIdForFullView] = useState<string | null>(null);
  
  // Scroll state and ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const [generationControlValues, setGenerationControlValues] = useState<GenerationControlValues>({
    overallPromptText: '', specificPromptsText: '', rulesToRememberText: '',
    numberToGenerate: 3, includeExistingContext: false, addSummary: true,
  });
  const [bulkEditControlValues, setBulkEditControlValues] = useState<BulkEditControlValues>({
    editInstructions: '', modelType: 'standard' as AIModelType,
  });

  // Scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (event.currentTarget) {
      setShowScrollToTop(event.currentTarget.scrollTop > 200);
    }
  }, []);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const debouncedAutoSavePrompts = useCallback(
    debounce((promptsToSave: PromptEntry[]) => {
      console.log(`[PromptEditorModal] Auto-saving prompts to parent. Count: ${promptsToSave.length}`, JSON.stringify(promptsToSave.map(p => ({id: p.id, text: p.fullPrompt.substring(0,30)+'...'}))));
      onAutoSavePrompts(promptsToSave);
    }, 1500),
    [onAutoSavePrompts]
  );

  // Effect to initialize modal state (prompts and control settings) when it *first* opens
  useEffect(() => {
    if (isOpen) {
      setShowScrollToTop(false);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      console.log("[PromptEditorModal] Modal is OPENING. Initializing state from props and localStorage.");
      setPromptToEdit(null); // Ensure individual edit modal is not open from a previous interaction
      
      // 1. Set internal prompts from initialPrompts (deep copy)
      console.log(`[PromptEditorModal] Initializing internalPrompts from initialPrompts on open. Current initialPrompts count: ${initialPrompts.length}`);
      setInternalPrompts(initialPrompts.map(p => ({ ...p })));
      
      // 2. Load control settings from localStorage (only on initial open)
      const savedSettingsRaw = localStorage.getItem(PROMPT_EDITOR_MODAL_CONTROLS_KEY);
      if (savedSettingsRaw) {
        console.log("[PromptEditorModal] Found saved control settings in localStorage.");
        try {
          const savedSettings = JSON.parse(savedSettingsRaw) as PersistedEditorControlsSettings;
          if (savedSettings.generationSettings) {
            console.log("[PromptEditorModal] Loading generation settings from localStorage:", savedSettings.generationSettings);
            setGenerationControlValues(prev => ({ ...prev, ...savedSettings.generationSettings, addSummary: savedSettings.generationSettings.addSummary !== undefined ? savedSettings.generationSettings.addSummary : true }));
          }
          if (savedSettings.bulkEditSettings) {
            console.log("[PromptEditorModal] Loading bulk edit settings from localStorage:", savedSettings.bulkEditSettings);
            setBulkEditControlValues(prev => ({ ...prev, ...savedSettings.bulkEditSettings }));
          }
          if (savedSettings.activeTab) {
            console.log("[PromptEditorModal] Loading active tab from localStorage:", savedSettings.activeTab);
            setActiveTab(savedSettings.activeTab);
          }
        } catch (e) { 
          console.error("[PromptEditorModal] Failed to parse control settings from localStorage on open:", e); 
        }
      } else {
        console.log("[PromptEditorModal] No saved control settings found in localStorage on initial open. Defaults will be used (addSummary:true).");
        setGenerationControlValues({
            overallPromptText: '', specificPromptsText: '', rulesToRememberText: '',
            numberToGenerate: 3, includeExistingContext: false, addSummary: true,
        });
      }
      setActivePromptIdForFullView(null);
    }
  }, [isOpen]); 

  // Effect to sync internalPrompts if initialPrompts prop changes WHILE modal is already open.
  // This handles cases where parent form might update prompts for reasons external to this modal's auto-save loop,
  // or to reflect the result of an auto-save without re-initializing control fields.
  useEffect(() => {
    if (isOpen) {
        if (initialPrompts !== internalPrompts) { 
            console.log(`[PromptEditorModal] initialPrompts prop changed while modal is open. Syncing internalPrompts. New count: ${initialPrompts.length}`);
            setInternalPrompts(initialPrompts.map(p => ({ ...p })));
        }
    }
  }, [initialPrompts, isOpen]);

  const debouncedSaveControlSettings = useCallback(
    debounce((settings: PersistedEditorControlsSettings) => {
      localStorage.setItem(PROMPT_EDITOR_MODAL_CONTROLS_KEY, JSON.stringify(settings));
      console.log("[PromptEditorModal] Control settings saved to localStorage (debounced).", JSON.stringify(settings));
    }, 1000),
    []
  );

  useEffect(() => {
    if (isOpen) {
      debouncedSaveControlSettings({
        generationSettings: generationControlValues,
        bulkEditSettings: bulkEditControlValues,
        activeTab: activeTab,
      });
    }
  }, [generationControlValues, bulkEditControlValues, activeTab, isOpen, debouncedSaveControlSettings]);

  const handleGenerationValuesChange = useCallback((values: GenerationControlValues) => setGenerationControlValues(values), []);
  const handleBulkEditValuesChange = useCallback((values: BulkEditControlValues) => setBulkEditControlValues(values), []);

  const { 
    generatePrompts: aiGeneratePrompts, 
    editPromptWithAI: aiEditPrompt, 
    generateSummary: aiGenerateSummary,
    isLoading: isAILoading, 
    isGenerating: isAIGenerating, 
    isEditing: isAIEditing 
  } = useAIInteractionService({ apiKey, generatePromptId });

  const handleFinalSaveAndClose = () => {
    console.log(`[PromptEditorModal] 'Close' button clicked. Saving prompts. Count: ${internalPrompts.length}`, JSON.stringify(internalPrompts.map(p => ({id: p.id, text: p.fullPrompt.substring(0,30)+'...'}))));
    onSave(internalPrompts);
    onAutoSavePrompts(internalPrompts);
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
    setShowScrollToTop(false);
    onClose();
  };

  const handleInternalUpdatePrompt = useCallback((id: string, updates: Partial<Omit<PromptEntry, 'id'>>) => {
    setInternalPrompts(currentPrompts => {
      const newPrompts = currentPrompts.map(p => (p.id === id ? { ...p, ...updates } : p));
      console.log(`[PromptEditorModal] Prompt updated (manual edit). ID: ${id}, Updates: ${JSON.stringify(updates)}. New list count: ${newPrompts.length}`);
      if (isOpen) debouncedAutoSavePrompts(newPrompts);
      return newPrompts;
    });
  }, [isOpen, debouncedAutoSavePrompts]);
  
  const handleInternalRemovePrompt = (id: string) => {
    setInternalPrompts(currentPrompts => {
      const newPrompts = currentPrompts.filter(p => p.id !== id);
      console.log(`[PromptEditorModal] Prompt removed (manual). ID: ${id}. New list count: ${newPrompts.length}`);
      if (isOpen) debouncedAutoSavePrompts(newPrompts);
      return newPrompts;
    });
  };

  const handleInternalAddBlankPrompt = () => {
    const newPromptEntry: PromptEntry = { id: generatePromptId(), fullPrompt: '', shortPrompt: '' };
    setInternalPrompts(currentPrompts => {
      const newPrompts = [...currentPrompts, newPromptEntry];
      console.log(`[PromptEditorModal] Blank prompt added (manual). New prompt ID: ${newPromptEntry.id}. New list count: ${newPrompts.length}`);
      if (isOpen) debouncedAutoSavePrompts(newPrompts);
      return newPrompts;
    });
  };

  const handleGenerateAndAddPrompts = async (params: GeneratePromptsParams) => {
    if (!actualCanUseAI) { toast.error("API Key required for AI generation."); return; }
    console.log("[PromptEditorModal] AI Generation: Attempting to generate prompts. Params:", JSON.stringify(params));
    
    // Store whether summaries were requested initially to decide if we need to auto-generate them later
    const summariesInitiallyRequested = params.addSummaryForNewPrompts;
    
    const rawResults = await aiGeneratePrompts(params);
    console.log("[PromptEditorModal] AI Generation: Raw AI results:", JSON.stringify(rawResults));
    
    const newEntries: PromptEntry[] = rawResults.map(item => ({
      id: item.id,
      fullPrompt: item.text,
      shortPrompt: item.shortText, // This will be populated if summariesInitiallyRequested was true
    }));
    console.log(`[PromptEditorModal] AI Generation: Parsed ${newEntries.length} new PromptEntry items:`, JSON.stringify(newEntries.map(p => ({id: p.id, text: p.fullPrompt.substring(0,30)+'...'}))));
    
    // Add new prompts to the state first
    let newlyAddedPromptIds: string[] = [];
    setInternalPrompts(currentPrompts => {
      newlyAddedPromptIds = newEntries.map(entry => entry.id);
      const newPrompts = [...currentPrompts, ...newEntries];
      console.log(`[PromptEditorModal] AI Generation: Prompts list updated. New list count: ${newPrompts.length}`);
      if (isOpen) debouncedAutoSavePrompts(newPrompts);
      return newPrompts;
    });
    
    toast.success(`${newEntries.length} new prompts generated and added.`);

    // Now, if summaries were NOT initially requested, iterate and generate them for the newly added prompts
    if (!summariesInitiallyRequested && actualCanUseAI) {
      console.log("[PromptEditorModal] Summaries were not initially requested. Attempting to auto-generate for new prompts.");
      for (const newEntry of newEntries) { // Iterate over the JS array of new entries, not the state
        if (!newEntry.shortPrompt || newEntry.shortPrompt.trim() === '') {
          console.log(`[PromptEditorModal] Auto-generating summary for new prompt ID: ${newEntry.id}, Text: "${newEntry.fullPrompt.substring(0,30)}..."`);
          const summaryText = await aiGenerateSummary(newEntry.fullPrompt);
          if (summaryText) {
            console.log(`[PromptEditorModal] Summary generated for ${newEntry.id}: "${summaryText}"`);
            // Update the specific prompt in the state
            setInternalPrompts(currentPrompts => {
              const updatedPrompts = currentPrompts.map(p => 
                p.id === newEntry.id ? { ...p, shortPrompt: summaryText } : p
              );
              // Auto-save after this update too
              if (isOpen) debouncedAutoSavePrompts(updatedPrompts);
              return updatedPrompts;
            });
          } else {
            console.log(`[PromptEditorModal] Failed to generate summary for new prompt ID: ${newEntry.id}`);
          }
        }
      }
    }
  };

  const handleBulkEditPrompts = async (params: BEC_BulkEditParams) => {
    if (!actualCanUseAI || internalPrompts.length === 0) {
        if (internalPrompts.length === 0) toast.error("No prompts to edit.");
        else toast.error("API Key missing, cannot bulk edit.");
        return;
    }
    console.log(`[PromptEditorModal] AI Bulk Edit: Starting. Params: ${JSON.stringify(params)}, Target prompts: ${internalPrompts.length}`);
    let successCount = 0;
    const editedPromptsList = await Promise.all(internalPrompts.map(async (prompt, index) => {
      console.log(`[PromptEditorModal] AI Bulk Edit: Processing prompt #${index + 1} (ID: ${prompt.id}). Original: "${prompt.fullPrompt.substring(0,50)}..."`);
      const result = await aiEditPrompt({
        originalPromptText: prompt.fullPrompt, editInstructions: params.editInstructions, modelType: params.modelType,
      });
      console.log(`[PromptEditorModal] AI Bulk Edit: Raw AI result for prompt #${index + 1} (ID: ${prompt.id}):`, JSON.stringify(result));
      if (result.success && result.newText) {
        successCount++;
        console.log(`[PromptEditorModal] AI Bulk Edit: Prompt #${index + 1} (ID: ${prompt.id}) successfully edited. New text: "${result.newText.substring(0,50)}..."`);
        return { ...prompt, fullPrompt: result.newText, ...(result.newShortText !== undefined && { shortPrompt: result.newShortText }) };
      }
      console.log(`[PromptEditorModal] AI Bulk Edit: Prompt #${index + 1} (ID: ${prompt.id}) edit failed or no changes.`);
      return prompt;
    }));
    console.log(`[PromptEditorModal] AI Bulk Edit: Complete. Successful edits: ${successCount}/${internalPrompts.length}.`);
    setInternalPrompts(editedPromptsList);
    if (isOpen) debouncedAutoSavePrompts(editedPromptsList);
    console.log(`[PromptEditorModal] AI Bulk Edit: Prompts list updated. New list count: ${editedPromptsList.length}`);
    toast.success(`Bulk edit finished. ${successCount} of ${internalPrompts.length} prompts modified by AI.`);
  };

  const openEditWithAIForm = (promptId: string, currentText: string) => {
    setPromptToEdit({ id: promptId, originalText: currentText, instructions: '', modelType: 'standard' });
  };

  const handleConfirmEditWithAI = async () => {
    if (!promptToEdit || !actualCanUseAI) {
        toast.error("API Key is missing or prompt data is invalid. Cannot perform AI edit.");
        return;
    }
    console.log(`[PromptEditorModal] AI Individual Edit: Attempting for prompt ID: ${promptToEdit.id}. Instructions: "${promptToEdit.instructions}", Model: ${promptToEdit.modelType}`);
    const result = await aiEditPrompt({
      originalPromptText: promptToEdit.originalText, editInstructions: promptToEdit.instructions, modelType: promptToEdit.modelType,
    });
    console.log(`[PromptEditorModal] AI Individual Edit: Raw AI result for prompt ID ${promptToEdit.id}:`, JSON.stringify(result));
    if (result.success && result.newText) {
      setInternalPrompts(currentPrompts => {
        const newPrompts = currentPrompts.map(p => (p.id === promptToEdit.id ? { ...p, fullPrompt: result.newText!, ...(result.newShortText !== undefined && { shortPrompt: result.newShortText }) } : p));
        console.log(`[PromptEditorModal] AI Individual Edit: Prompt ID ${promptToEdit.id} updated. New list count: ${newPrompts.length}`);
        if (isOpen) debouncedAutoSavePrompts(newPrompts);
        return newPrompts;
      });
      toast.success("Prompt updated with AI suggestions.");
    } else { 
      toast.error("AI edit failed or returned no changes."); 
      console.log(`[PromptEditorModal] AI Individual Edit: Failed for prompt ID ${promptToEdit.id} or no changes from AI.`);
    }
    setPromptToEdit(null);
  };

  const existingPromptsForAIContext: AIPromptItem[] = internalPrompts.map(p => ({ 
      id: p.id, 
      text: p.fullPrompt, 
      shortText: p.shortPrompt, 
      hidden: false
  }));
  const updatePromptInRow = useCallback((id: string, field: 'fullPrompt' | 'shortPrompt', value: string) => {
    handleInternalUpdatePrompt(id, { [field]: value });
  }, [handleInternalUpdatePrompt]);

  if (!isOpen) return null;

  return (
    <> {/* Fragment to hold main modal and individual edit modal */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          handleFinalSaveAndClose();
        }
      }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center">
              <Edit size={20} className="mr-2" />
              Advanced Prompt Editor
            </DialogTitle>
          </DialogHeader>

          {!actualCanUseAI && (
            <div className="m-6 p-3 mb-0 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded text-sm">
              <p className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" /> AI features (generation/editing) are disabled. An API key is required.</p>
            </div>
          )}

          {/* Combined Scrollable Area */}
          <ScrollArea className="flex-grow" ref={scrollRef} onScroll={handleScroll}>
            <div className="p-6 pt-2">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="generate"><Wand2Icon className="mr-2 h-4 w-4" />Generate Prompts</TabsTrigger>
                  <TabsTrigger value="bulk-edit"><PackagePlus className="mr-2 h-4 w-4" />Bulk Edit Existing</TabsTrigger>
                </TabsList>

                {/* Tab Content */}
                <div className="mt-4 min-h-[200px]">
                  <TabsContent value="generate" className="space-y-4">
                    <PromptGenerationControls
                      initialValues={generationControlValues}
                      onValuesChange={handleGenerationValuesChange}
                      onGenerate={handleGenerateAndAddPrompts}
                      isGenerating={isAIGenerating}
                      hasApiKey={actualCanUseAI}
                      existingPromptsForContext={existingPromptsForAIContext}
                    />
                  </TabsContent>
                  <TabsContent value="bulk-edit" className="space-y-4">
                    <BulkEditControls
                      initialValues={bulkEditControlValues}
                      onValuesChange={handleBulkEditValuesChange}
                      onBulkEdit={handleBulkEditPrompts}
                      isEditing={isAIEditing}
                      hasApiKey={actualCanUseAI}
                      numberOfPromptsToEdit={internalPrompts.length}
                    />
                  </TabsContent>
                </div>
              </Tabs>
              
              {/* Prompts List Section (always visible, below tabs) */}
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold" id="prompts-section">
                    Prompts ({internalPrompts.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleInternalAddBlankPrompt} className="gap-1">
                    <PlusCircle size={16} /> Add Blank
                  </Button>
                </div>
                {internalPrompts.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No prompts yet.</p>
                    <p>Use the controls above to generate new prompts, or add blank ones to start.</p>
                  </div>
                )}
                {internalPrompts.map((prompt, index) => {
                  const handleUpdateForRow: PromptInputRowProps['onUpdate'] = (id, field, value) => {
                    handleInternalUpdatePrompt(id, { [field]: value });
                  };

                  return (
                    <PromptInputRow
                      key={prompt.id}
                      promptEntry={prompt}
                      index={index}
                      onUpdate={handleUpdateForRow}
                      onRemove={() => handleInternalRemovePrompt(prompt.id)}
                      canRemove={internalPrompts.length > 1}
                      isGenerating={isAILoading}
                      hasApiKey={actualCanUseAI}
                      onEditWithAI={actualCanUseAI ? () => openEditWithAIForm(prompt.id, prompt.fullPrompt) : undefined}
                      aiEditButtonIcon={<Wand2Icon className="h-4 w-4" />}
                      onSetActiveForFullView={setActivePromptIdForFullView}
                      isActiveForFullView={activePromptIdForFullView === prompt.id}
                    />
                  );
                })}
              </div>
            </div>
          </ScrollArea>

          {showScrollToTop && (
            <Button
              variant="outline"
              size="icon"
              onClick={scrollToTop}
              className="absolute bottom-24 right-6 z-50 rounded-full shadow-lg"
              aria-label="Scroll to top"
            >
              <ArrowUp size={20} />
            </Button>
          )}

          <DialogFooter className="p-6 pt-3 border-t mt-auto">
            <div className="flex w-full justify-between items-center">
              <div className="text-xs text-muted-foreground min-h-[16px]">
                {isAILoading && "AI is thinking..."}
                {isAIEditing && "AI is editing..."}
                {isAIGenerating && "AI is generating..."}
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => {
                      if (scrollRef.current) scrollRef.current.scrollTop = 0;
                      setShowScrollToTop(false);
                      onClose();
                  }}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleFinalSaveAndClose}>
                  Save & Close Prompts
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual AI Edit Dialog */}
      {promptToEdit && actualCanUseAI && (
        <Dialog open={promptToEdit !== null} onOpenChange={(open) => { if (!open) setPromptToEdit(null); }}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Edit Prompt with AI</DialogTitle>
              <DialogDescription>
                Refine the selected prompt using AI. Your original prompt will be shown for reference.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="ai-edit-original">Original Prompt</Label>
                <Textarea
                  id="ai-edit-original"
                  value={promptToEdit.originalText}
                  readOnly
                  className="h-28 bg-muted/30 border-muted/50 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-edit-instructions">Your Editing Instructions</Label>
                <Textarea
                  id="ai-edit-instructions"
                  value={promptToEdit.instructions}
                  onChange={(e) => setPromptToEdit(prev => prev ? { ...prev, instructions: e.target.value } : null)}
                  placeholder="e.g., 'Make this more poetic', 'Shorten to one sentence', 'Translate to French'"
                  className="min-h-[100px]"
                  autoFocus
                />
              </div>
              {/* 
              Future enhancement: Could add modelType selector here if needed.
              Current modelType: {promptToEdit.modelType} 
              */}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPromptToEdit(null)}>Cancel</Button>
              <Button onClick={handleConfirmEditWithAI} disabled={isAIEditing || !promptToEdit.instructions.trim()}>
                {isAIEditing ? (
                  <>
                    <Wand2Icon className="mr-2 h-4 w-4 animate-pulse" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Wand2Icon className="mr-2 h-4 w-4" />
                    Apply AI Edit
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PromptEditorModal; 