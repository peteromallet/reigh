# Project Restructuring Plan: Tool-Based Architecture

**1. Goals**

*   Introduce a main tool selector page as the application's entry point.
*   Modularize the codebase by organizing features into distinct "tool" sections.
*   Isolate common UI elements (like the bottom shots tray) for reuse across tools.
*   Establish a scalable project structure for adding new tools in the future.

**2. Proposed Directory Structure**

```
/src
├── app/                  # Core application setup, routing, global providers
│   ├── App.tsx
│   ├── main.tsx
│   └── routes.tsx        # Centralized route definitions
├── pages/                # Top-level page components (e.g., Tool Selector)
│   └── ToolSelectorPage.tsx
├── tools/                # Parent directory for all distinct tools
│   ├── image-generation/ # Specific tool module
│   │   ├── components/     # Components specific to image generation
│   │   │   ├── ImageGenerationForm.tsx
│   │   │   └── ImageGallery.tsx
│   │   ├── hooks/          # Hooks specific to image generation
│   │   ├── pages/          # Pages for this tool
│   │   │   └── ImageGenerationToolPage.tsx
│   │   └── utils/          # Utilities specific to image generation
│   ├── video-travel/     # Another specific tool module
│   │   ├── components/
│   │   │   └── VideoEditLayout.tsx
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   └── VideoTravelToolPage.tsx
│   │   └── utils/
│   └── [another-tool]/   # Placeholder for future tools
├── shared/               # Components, hooks, utils shared across tools
│   ├── components/
│   │   ├── ShotsPane/
│   │   │   ├── ShotsPane.tsx
│   │   │   ├── ShotGroup.tsx
│   │   │   └── NewGroupDropZone.tsx
│   │   └── ui/             # Existing shadcn-ui primitives
│   │   └── DraggableImage.tsx # If used by more than one tool's gallery
│   ├── hooks/
│   │   ├── useShots.ts
│   │   ├── useLastAffectedShot.ts # (Context or hook)
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── contexts/           # Global/shared contexts
│   ├── layouts/            # Reusable page layout components
│   └── lib/                # General utilities (cn, etc.)
├── integrations/         # Supabase, FAL-AI (as is)
├── types/                # Global TS types (as is, or split if some are tool-specific)
/public/                  # (as is)
/supabase/                # (as is)
```

**3. Phase-by-Phase Implementation Plan**

**Phase 1: Setup Core Structure & Main Menu**

1.  **Create new directories:**
    *   `src/app/`
    *   `src/pages/`
    *   `src/tools/`
    *   `src/tools/image-generation/` (with `components`, `hooks`, `pages`, `utils` subdirs)
    *   `src/tools/video-travel/` (with `components`, `hooks`, `pages`, `utils` subdirs)
    *   `src/shared/` (with `components`, `hooks`, `contexts`, `layouts`, `lib` subdirs)
    *   `src/shared/components/ShotsPane/`
2.  **Move core app files:**
    *   `src/main.tsx` -> `src/app/main.tsx`
    *   `src/App.tsx` -> `src/app/App.tsx`
3.  **Create `ToolSelectorPage.tsx`:**
    *   Path: `src/pages/ToolSelectorPage.tsx`
    *   Content: A page with a 4-column grid layout.
    *   Initial items:
        *   "Generate Images with Structure" (links to `/tools/image-generation`)
        *   "Travel Between Images" (links to `/tools/video-travel`)
        *   (Add placeholder items if needed to fill the 4-column grid initially)
4.  **Update `src/app/main.tsx`:** Adjust import path for `App.tsx`.
5.  **Create `src/app/routes.tsx`:**
    *   Define application routes here.
    *   Set `/` to render `<ToolSelectorPage />`.
    *   Add routes for `/tools/image-generation` and `/tools/video-travel` (placeholders for now).
6.  **Modify `src/app/App.tsx`:**
    *   Import routes from `src/app/routes.tsx` and use them with `<BrowserRouter>`.
    *   Move `useLastAffectedShot` context definition to `src/shared/contexts/LastAffectedShotContext.tsx` and its hook to `src/shared/hooks/useLastAffectedShot.ts`. Update `App.tsx` to use the provider from the new location.

**Phase 2: Relocate Image Generation Tool**

1.  **Move Page:**
    *   `pages/Index.tsx` -> `src/tools/image-generation/pages/ImageGenerationToolPage.tsx`
2.  **Move Components:**
    *   `src/components/ImageGenerationForm.tsx` -> `src/tools/image-generation/components/ImageGenerationForm.tsx`
    *   `src/components/ImageGallery.tsx` -> `src/tools/image-generation/components/ImageGallery.tsx`
    *   `src/components/DraggableImage.tsx` -> `src/shared/components/DraggableImage.tsx` (assuming it might be reusable, otherwise to `image-generation/components/`)
    *   `src/components/PromptEditorModal.tsx` -> `src/tools/image-generation/components/PromptEditorModal.tsx` (if specific) or `src/shared/components/` (if generic)
    *   `src/components/LoraSelectorModal.tsx` -> `src/tools/image-generation/components/LoraSelectorModal.tsx`
    *   `src/components/BulkEditControls.tsx`, `src/components/PromptGenerationControls.tsx` -> `src/tools/image-generation/components/`
3.  **Move Hooks (if specific):**
    *   Review hooks used by `ImageGenerationToolPage.tsx` and its components. If a hook is solely used for image generation, move it to `src/tools/image-generation/hooks/`.
    *   `src/hooks/useAIInteractionService.ts` -> `src/tools/image-generation/hooks/useAIInteractionService.ts` (if only used here, otherwise `src/shared/hooks/`)
4.  **Move Utilities:**
    *   `src/utils/imageCropper.ts` -> `src/tools/image-generation/utils/imageCropper.ts` (if specific to generation's needs) or `src/shared/lib/imageCropper.ts` (if generic).
    *   `src/utils/imageUploader.ts` -> `src/shared/lib/imageUploader.ts` (likely shared).
5.  **Update `src/app/routes.tsx`:**
    *   Point `/tools/image-generation` to `<ImageGenerationToolPage />`.
6.  **Update all import paths** within the moved files and files that reference them.

**Phase 3: Relocate Video Travel Tool**

1.  **Create Page:**
    *   `src/tools/video-travel/pages/VideoTravelToolPage.tsx`. This page will import and use `VideoEditLayout.tsx`.
2.  **Move Components:**
    *   `src/components/VideoEditLayout.tsx` -> `src/tools/video-travel/components/VideoEditLayout.tsx`.
3.  **Move Hooks/Utils (if any specific to this tool emerge).**
4.  **Update `src/app/routes.tsx`:**
    *   Point `/tools/video-travel` to `<VideoTravelToolPage />`.
5.  **Update all import paths.**

**Phase 4: Isolate Common/Shared Elements**

1.  **Shots System:**
    *   Move `components/ShotsPane.tsx` -> `src/shared/components/ShotsPane/ShotsPane.tsx`
    *   Move `components/ShotGroup.tsx` -> `src/shared/components/ShotsPane/ShotGroup.tsx`
    *   Move `components/NewGroupDropZone.tsx` -> `src/shared/components/ShotsPane/NewGroupDropZone.tsx`
    *   Move `hooks/useShots.ts` -> `src/shared/hooks/useShots.ts`
2.  **UI Primitives:**
    *   Move `src/components/ui/` -> `src/shared/components/ui/`
3.  **General Hooks:**
    *   `src/hooks/use-mobile.tsx` -> `src/shared/hooks/use-mobile.tsx`
    *   `src/hooks/use-toast.ts` -> `src/shared/hooks/use-toast.ts`
4.  **General Utilities:**
    *   `src/lib/utils.ts` -> `src/shared/lib/utils.ts`
5.  **Settings Modal:**
    *   `src/components/SettingsModal.tsx` -> `src/shared/components/SettingsModal.tsx` (as API keys are likely global)
6.  **Tool Integration:**
    *   Each tool's main page (`ImageGenerationToolPage.tsx`, `VideoTravelToolPage.tsx`) will decide if it needs to render shared components like `<ShotsPane />`. This can be direct inclusion or controlled via a layout component.
    *   The `DndContext` in `App.tsx` might need to be evaluated if drag-and-drop interactions are solely within one tool or remain global. If `ShotsPane` is the primary DND target and is global, `DndContext` can remain in `App.tsx`.
7.  **Update all import paths** across the codebase.

**Phase 5: Routing and Navigation**

1.  Ensure all navigation links (e.g., in a potential Navbar, or from the `ToolSelectorPage`) point to the correct new routes.
2.  Update any programmatic navigation (`navigate(...)` calls).
3.  Handle `NotFound.tsx` (currently `pages/NotFound.tsx`):
    *   Move to `src/pages/NotFoundPage.tsx` or `src/app/NotFoundPage.tsx`.
    *   Ensure it's correctly wired up as the fallback route in `src/app/routes.tsx`.

**Phase 6: Refinement & Clean-up**

1.  **Remove old directories:** `/components` (top-level), `/hooks` (top-level), `src/components` (old), `src/hooks` (old), `src/utils` (old `src/utils`), `pages` (old top-level for `Index.tsx`).
2.  **Review `localStorage` usage:** Keys like `imageFormState` might need to be namespaced if other tools also need form state persistence (e.g., `imageGeneration_imageFormState`).
3.  **Test thoroughly:**
    *   Navigation between tool selector and tools.
    *   Functionality of each tool.
    *   Shared components (ShotsPane) behavior within each tool that uses them.
    *   Drag-and-drop functionality.
4.  **Update `structure.md`** to reflect the new project organization.

**7. Considerations & Future Work**

*   **Styling:** Ensure TailwindCSS paths and configurations are updated if component locations change significantly relative to `tailwind.config.js`.
*   **State Management:** For more complex shared state between tools (beyond `useShots` or simple contexts), consider a more robust solution like Zustand or Jotai, integrated at the `src/shared/` level.
*   **Lazy Loading:** Implement route-based code splitting (lazy loading) for each tool's module in `src/app/routes.tsx` to improve initial load time.
*   **Data Fetching:** `react-query` instances and cache keys might need careful review to ensure no unintended cache sharing or conflicts arise if tools have similar data needs but different contexts. 