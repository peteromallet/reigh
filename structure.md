# Artful Pane Craft: Developer Onboarding
*(React + Vite Image-Generation Playground)*

## 1. Tech Stack & Ports

### Core Technologies
- **Frontend**: Vite, React, TypeScript
- **Styling**: TailwindCSS, shadcn-ui (UI primitives)
- **State/Routing**: @tanstack/react-query (server state), react-router-dom (client routing)
- **Interactions**: @dnd-kit/core, @dnd-kit/sortable (drag-and-drop)
- **Notifications**: Sonner (custom toaster)
- **Backend & DB**: Supabase (Postgres DB, Storage, typed client), Express.js (Node.js API server)
- **AI**: FAL-AI (image generation API)

### Ports
- Frontend (Vite): `2222`
- Backend (Express): `8085` (default, configurable via process.env.PORT)

## 2. Directory Structure (Top-Level)

| Path | Purpose |
|------|---------|
| `/src/app` | Core app setup (entry, providers, routing shell) |
| `/src/pages` | Top-level page components (Tool Selector, NotFound, etc.) |
| `/src/tools` | Tool-specific modules (Image Generation, Video Travel, Edit Travel) |
| `/src/shared` | Shared components, hooks, utils, contexts, layouts |
| `/src/server` | Backend API server (Express.js); data access, background tasks |
| `/src/server/routes/apiKeys.ts` | API key management endpoint (GET, PUT /api/api-keys) for user API key storage |
| `/src/types` | Shared TS interfaces (incl. Supabase-generated DB types, env.ts) |
| `/src/integrations` | Supabase & FAL-AI client setup |
| `/public` | Static assets (favicons, SVGs, JSON) |
| `/public/data/loras.json` | LoRA models database with filtering support via `lora_type` field |
| `/supabase` | Supabase CLI/config |
| `/dist` | Build output (auto-generated) |
| Config files | vite.config.ts, tailwind.config.ts, tsconfig*.json, ESLint, etc. |
| `drizzle.config.ts` | Drizzle Kit config for **PostgreSQL**. Used for generating production migrations. |
| `drizzle-sqlite.config.ts` | Drizzle Kit config for **SQLite**. Used for generating local development migrations. |
| `/db/schema/schema.ts` | Canonical DB schema (Drizzle ORM, **PostgreSQL-first**). Uses `pg-core` types (`pgTable`, `uuid`, `timestamp`, `jsonb`). |
| `/db/migrations/` | PostgreSQL migration files generated from the canonical schema. |
| `/db/migrations-sqlite/` | SQLite migration files (can be generated for local dev, not committed). |
| `/db/seed.ts` | Seeds the database for development (works with both PG and SQLite). |
| `/src/lib/db/index.ts` | Runtime Data Access Layer. Exports a Drizzle client that **connects to PostgreSQL in production** (`NODE_ENV=production`) and **SQLite locally**. Also re-exports the Supabase JS client for frontend use (e.g., storage). |
| `DEPLOYMENT.md` | Contains detailed instructions for setting up development and production environments, including database migrations and environment variables. |

### DB Workflow (Drizzle ORM - Dual Environment)
1.  **Schema**: `/db/schema/schema.ts` is the single source of truth, written using Drizzle's PostgreSQL (`pg-core`) types.
2.  **Migrations**:
    *   **PostgreSQL (Production)**: `npm run db:generate:pg`
    *   **SQLite (Local)**: `npm run db:generate:sqlite`
3.  **Apply Migrations**:
    *   **PG**: Apply to Supabase using `npm run db:push:pg`. See `DEPLOYMENT.md`.
    *   **SQLite**: The schema is pushed automatically on server start via `npm run start:api`.
4.  **Data Access**:
    *   **Backend (Express API)**: Uses the Drizzle client from `/src/lib/db/index.ts`. This client is environment-aware and connects to the appropriate database (PG in prod, SQLite locally). All database operations (CRUD) should go through this API.
    *   **Frontend (React)**:
        *   For **database operations**, it makes API calls to the Express server (e.g., `fetch('/api/tasks')`). It **does not** use the Supabase JS client for database queries.
        *   For **file storage** or **edge functions**, it can use the Supabase JS client directly.

### 3. Source Code Breakdown

#### 3.1. Core Application (`src/app/`)
- **main.tsx**: Mounts `<App/>`.
- **App.tsx**: Global providers (QueryClient, etc.). Renders AppInternalContent (DND setup, `<AppRoutes/>`, `<Sonner/>`).
- **routes.tsx**: App routing (createBrowserRouter). Root layout (`<Layout/>`) includes `<GlobalHeader/>`, `<Outlet/>`.
- **Layout.tsx**: Main layout: `<GlobalHeader/>`, `<Outlet/>`, `<TasksPane/>`, `<ShotsPane/>`, `<GenerationsPane/>`. Adjusts margins for locked panes.

##### Environment (`VITE_APP_ENV`):
- Controls tool visibility on ToolSelectorPage.tsx (dev, local, web). Default: dev.
- Set in .env.local (root), restart Vite server after changes.
- `VITE_API_TARGET_URL`: Vite proxy target & client-side base URL for assets.
- Visibility logic: ToolSelectorPage.tsx filters tools array based on tool.environments (array of AppEnv from src/types/env.ts) matching VITE_APP_ENV. Modify environments array in ToolSelectorPage.tsx to change visibility.

#### 3.2. Top-Level Pages (`src/pages/`)
- **ToolSelectorPage.tsx**: App entry. Grid of available tools.
- **NotFoundPage.tsx**: 404 errors.
- **ShotsPage.tsx**: Lists project shots (ShotListDisplay). Manages selected shot's images (ShotImageManager).
- **GenerationsPage.tsx**: Paginated gallery of project's generated media.

#### 3.3. Tool Modules (`src/tools/`)

##### Image Generation (`src/tools/image-generation/`)
- **pages/ImageGenerationToolPage.tsx**: Main UI. Fetches generations via API. Hosts `ImageGenerationForm`. Creates new image generation jobs by POSTing to `/api/tasks`. Handles upscale (via Supabase function), delete, and optimistic updates.
- **components/ImageGenerationForm.tsx**: Multi-step form (prompts, LoRAs, controls, start image). localStorage state.
- **components/BulkEditControls.tsx**, **components/PromptGenerationControls.tsx**: Helper toolbars.
- **hooks/useGenerations.ts**: useListGenerations (GET /api/generations), placeholders for delete/upscale.

##### Video Travel (`src/tools/video-travel/`)
- **pages/VideoTravelToolPage.tsx**: Main UI. Lists project shots (ShotListDisplay). Creates new shots (API). Hosts ShotEditor. Manages LoRA state and filtering for "Wan 2.1 14b" models.
- **components/ShotEditor.tsx**: Main shot editing. VideoOutputsGallery now positioned above main content area for better visibility. Orchestrates BatchSettingsForm, ShotImageManager. Includes LoRA selector UI with strength controls. Features OpenAI API key validation for prompt enhancement, disabling generate button and showing clickable warning when enhance prompt is enabled but no API key is set.
- **components/BatchSettingsForm.tsx**: Form for batch video gen settings (prompts, frames, etc.). Includes "Enhance prompt" checkbox that requires OpenAI API key for AI-powered prompt improvement.
- **components/VideoOutputsGallery.tsx**: Displays generated videos for a shot (pagination, lightbox). Updated to show 3 videos per row consistently across screen sizes.
- **components/SimpleVideoPlayer.tsx**: Clean video player with speed controls (-2x, -1x, 1x, 2x). Replaces complex HoverScrubVideo functionality in lightbox for simplified playback experience.
- **components/VideoLightbox.tsx**: Modal video player using SimpleVideoPlayer for clean viewing experience.
- **components/TaskDetailsModal.tsx**: Dialog for detailed task parameters (fetches by generation ID). Features "Use These Settings" button that extracts and applies generation parameters (prompt, negative prompt, steps, frames, context, resolution) to BatchSettingsForm. Automatically deduplicates repeated prompts and handles expanded parameter arrays.
- **components/VideoShotDisplay.tsx**: Displays shot's images & name. Allows selection. Inline name edit, delete (API). Used by ShotListDisplay.
- **components/ShotListDisplay.tsx**: Renders list of shots using VideoShotDisplay.
- **components/SortableImageItem.tsx**: Renders sortable/deletable image item for ShotImageManager.
- **components/CreateShotModal.tsx**: Dialog to create new shots.

##### Edit Travel (`src/tools/edit-travel/`)
- **pages/EditTravelToolPage.tsx**: Main UI for image editing with text. Upload input image. Creates new image editing jobs by POSTing to `/api/tasks`. Displays results in ImageGallery.
- **components/EditTravelForm.tsx**: Form for managing prompts, input file, generation mode, and other settings for the Edit Travel tool.

#### 3.4. Shared Elements (`src/shared/`)

##### Components
- **GlobalHeader.tsx**: Site-wide header (branding, project selector/settings, new project '+', global settings). Content offset by locked panes.
- **ShotsPane/**:
  - `ShotsPane.tsx`: Left slide-out panel for shots
  - `ShotGroup.tsx`: Droppable area in shot
  - `NewGroupDropZone.tsx`: Drop target for new shot from file
- **GenerationsPane/GenerationsPane.tsx**: Bottom slide-up panel (browsing project's generated media, paginated)
- **TasksPane/**:
  - `TasksPane.tsx`: Right slide-out panel for tasks
  - `TaskList.tsx`: Lists tasks, filters, real-time updates via WebSocket
  - `TaskItem.tsx**: Displays task details, cancel button
- **ui/**: 50+ re-exports/variants of shadcn components
- **loading.tsx**: Wes Anderson-inspired loading indicators
- **DraggableImage.tsx**: Makes gallery images draggable
- **ImageGallery.tsx**: Displays generated images; supports delete, upscale, "apply settings", drag-to-shot
- **ImageDragPreview.tsx**: Renders the visual preview for single or multiple images being dragged from the ShotImageManager
- **SettingsModal.tsx**: Modal for API key entry/saving to database (uses useApiKeys hook). Replaces localStorage-based approach
- **PromptEditorModal.tsx**: Modal for bulk prompt editing, AI-assisted generation/refinement
- **LoraSelectorModal.tsx**: Browse/select LoRA models. Supports filtering by `lora_type` (e.g., "Flux.dev", "Wan 2.1 14b")
- **CreateProjectModal.tsx**: Dialog to create new project (uses ProjectContext.addNewProject)
- **ProjectSettingsModal.tsx**: Dialog to update project name/aspect ratio (uses ProjectContext.updateProject)
- **FileInput.tsx**: Reusable file input (image/video) with drag-and-drop, preview
- **MediaLightbox.tsx**: Reusable lightbox for images/videos. Keyboard/button navigation
- **ShotImageManager.tsx**: Manages images in a shot (D&D reorder, delete via callbacks). Used by ShotEditor, ShotsPage.tsx
- **HoverScrubVideo.tsx**: Wrapper for useVideoScrubbing (hover-play, scrub, progress, rate overlay). Reused by VideoOutputItem, MediaLightbox

##### Hooks
- **useGenerations.ts**: CRUD for generations:
  - `useListAllGenerations`: GET all generations for a project
  - `useDeleteGeneration`: DELETE a single generation
  - `useCreateGeneration`: POST a new simple generation record
- **useApiKeys.ts**: Manages user API keys stored in database:
  - `useApiKeys`: Fetches/updates API keys from database via react-query. Replaces localStorage-based approach
  - `getApiKey`: Helper to retrieve specific API key values
  - `saveApiKeys`: Updates API keys in database with optimistic updates
- **useShots.ts**: CRUD for shots & shot_generations:
  - `useCreateShot`: POST /api/shots
  - `useListShots`: GET /api/shots?projectId= (API returns shots with ordered images: GenerationRow[])
  - `useAddImageToShot`: POST /api/shots/shot_generations
  - `useDeleteShot`: DELETE /api/shots/:shotId
  - `useUpdateShotName`: PUT /api/shots/:shotId
  - `useRemoveImageFromShot`: DELETE /api/shots/:shot_id/generations/:generation_id. Optimistic updates
  - `useUpdateShotImageOrder`: PUT /api/shots/:shotId/generations/order (payload: { orderedGenerationIds: string[] }). Optimistic updates
  - `useHandleExternalImageDrop`: Handles external image drop: upload, POST /api/generations, link to shot (creates shot if new)
- **useTasks.ts**: Task management:
  - `useListTasks`: GET /api/tasks?projectId=&status=
  - `useCreateTask`: POST /api/tasks (used to create any new background job).
  - `useCancelTask`: PATCH /api/tasks/:taskId/cancel
  - `useUpdateTaskStatus`: PATCH /api/tasks/:taskId/status. For 'travel_stitch' completion, backend taskProcessingService.ts creates generation/shot_generation
- **useCancelAllPendingTasks**: POST /api/tasks/cancel-pending
- **usePersistentState.ts**: Generic hook to persist component state to `localStorage`.
- **useWebSocket.ts**: Manages WebSocket. Listens for messages (e.g., TASK_COMPLETED, TASKS_STATUS_UPDATE), invalidates react-query caches for real-time UI
- **useSlidingPane.ts**: Manages state for hover-to-open, lockable side panels
- **useLastAffectedShot.ts**: For LastAffectedShotContext
- **use-mobile.tsx**: Media query helper
- **use-toast.ts**: Sonner toast wrapper
- **useAIInteractionService.ts**: AI prompt editing abstraction
- **usePaneAwareModalStyle.ts**: Calculates and returns a style object to correctly position modals within the main content area, accounting for locked side panes.

##### Contexts
- **LastAffectedShotContext.tsx**: Remembers last modified shot
- **ProjectContext.tsx**: Manages selected project ID (localStorage). Fetches projects (GET /api/projects). API creates "Default Project" if none. Provides addNewProject (POST /api/projects), updateProject (PUT /api/projects/:id) & loading states
- **PanesContext.tsx**: Manages shared state (dimensions, lock states) for ShotsPane, TasksPane, GenerationsPane

##### Library (`lib/`)
- **imageUploader.ts**: Uploads to Supabase storage
- **utils.ts**: General utilities
- **imageCropper.ts**: Crops images to supported aspect ratios
- **aspectRatios.ts**: Defines aspect ratios (e.g., "16:9" -> "902x508"). Single source for project/server dimensions. Parsing/matching helpers
- **steerableMotion.ts**: Video generation API (POST /api/steerable-motion). Includes prompt enhancement via OpenAI API when enhance_prompt=true and openai_api_key is provided.