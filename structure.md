# Project Structure & High-Level Overview

> **Project name**: *Artful Pane Craft* (React + Vite image-generation playground)

---

## 1. Tech Stack

• **Vite + React + TypeScript** – front-end bundling & framework  
• **TailwindCSS + shadcn-ui** – styling & component primitives  
• **@tanstack/react-query** – server-state caching  
• **react-router-dom** – client-side routing  
• **Sonner & custom toaster** – notifications  
• **Supabase** – Postgres DB, storage buckets & typed client  
• **FAL-AI cloud API** – image generation backend

---

## 2. Directory Layout (top-level)

| Path | Purpose |
|------|---------|
| `/src` | **All application code** (React components, hooks, utils) |
| `/public` | Static assets (favicons, placeholder SVG, JSON, etc.) |
| `/supabase` | CLI/config for connecting to the Supabase project |
| `/dist` | Build output (auto-generated) |
| Config files | `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, ESLint, etc. |

---

## 3. Source Code Breakdown

### 3.1 Entrypoint & Core Shell

```
src/main.tsx   – mounts <App/> to #root
src/App.tsx    – global providers:
                 • React-Query client
                 • Tooltip / Toaster context
                 • React-Router <BrowserRouter>
                 Routes: "/"" → <Index/>, fallback → <NotFound/>
```

### 3.2 Pages

• **`pages/Index.tsx`** – the main experience.  
  – Fetches previously saved generations from Supabase on load.  
  – Hosts `ImageGenerationForm`, progress indicator, and `ImageGallery`.  
  – `handleGenerate` orchestrates the whole flow: loops through prompts, calls FAL-AI via `fal.subscribe`, tracks progress, persists every generated image + rich metadata to the `generations` table, and updates UI state.  
  – Cancellation, error handling, and local placeholder support are all here.

• **`pages/NotFound.tsx`** – simple 404 fallback.

### 3.3 Major Feature Components

| File | Responsibility |
|------|---------------|
| `components/ImageGenerationForm.tsx` | Multi-step form that collects prompts, LoRA models, strength sliders, starting image, etc.  Persists its state to `localStorage` for convenience.  Exposes an imperative `applySettings` method (via `forwardRef`) so the gallery can push settings back into the form. |
| `components/ImageGallery.tsx` | Responsive masonry-like gallery that displays previously generated images.  Can delete items (Supabase row + UI), open images fullscreen, or "apply settings" back to the form. |
| `components/PromptEditorModal.tsx` | Bulk prompt creation/editing in a modal (uses `useAIInteractionService` for AI-assisted editing & summaries). |
| `components/LoraSelectorModal.tsx` | Allows browsing a JSON catalogue of LoRA models and selecting them with individual strengths. |
| `components/SettingsModal.tsx` | Lets the user enter & save API keys (Fal + OpenAI) into `localStorage`. |
| `components/BulkEditControls.tsx`, `PromptGenerationControls.tsx` | Helper toolbars sitting on top of the prompt modal for batch operations. |

### 3.4 UI Primitives (`components/ui/`)

Nearly 50+ small files – re-exports/variants of shadcn components (Button, Card, Dialog, Tabs, etc.).  They provide a consistent design system and are largely framework-agnostic.

### 3.5 Hooks

• **`hooks/useAIInteractionService.ts`** – Thin abstraction (currently mocked) around AI services for generating/editing/summarising prompts. Tracks loading states and expects an API key.  
• `hooks/use-mobile.tsx`, `hooks/use-toast.ts` – misc helpers.

### 3.6 Utilities

| File | Notes |
|------|-------|
| `utils/imageCropper.ts` | Crops an uploaded image to the closest supported aspect ratio (square, 16:9, etc.) & returns a new `File` plus the enum required by the Fal API. |
| `utils/imageUploader.ts` | Uploads a `File` to the Supabase `image_uploads` bucket and returns its public URL. |
| `lib/utils.ts` | A tiny helper with classic no-op utilities (not critical). |

### 3.7 Integrations

• **Supabase** – `integrations/supabase/` provides a generated `types.ts` (database schema) and a typed `client.ts` that is imported across the app.  
• **Fal-AI** – Directly imported from `@fal-ai/client` inside `pages/Index.tsx`; configuration is done via `fal.config({ credentials })` using the user-supplied API key.

---

## 4. High-Level Data Flow

1. **User fills the form** (`ImageGenerationForm`).  
   – Prompts, LoRAs, starting image (optional) and control strengths are gathered.  
   – Form serialises its current settings to `localStorage` on each change.
2. **Generate pressed** → `Index.handleGenerate()`  
   1. Upload starting image (if any) to Supabase Storage (`utils/imageUploader.ts`).
   2. For **each prompt** and **imagesPerPrompt**:  
      • Call `fal.subscribe("fal-ai/flux-general")` with assembled parameters.  
      • Display live progress via state + toasts.  
      • Receive images + metadata; persist to Supabase `generations` table.  
   3. Final toast summarises success / partial failures.
3. **Gallery** automatically re-renders because `generatedImages` state is updated.  
   – Delete triggers Supabase `DELETE` and state update.  
   – "Apply settings" pushes metadata back into the form via `applySettings` ref.

---

## 5. Persistence Layers

• **LocalStorage** – remembers form preferences and API keys per browser.  
• **Supabase database** – table `generations` stores: `id`, `image_url`, `prompt`, `seed`, `metadata (JSONB)`, `created_at`.  
• **Supabase storage** – bucket `image_uploads` stores optional user-uploaded starting images.

---

## 6. Build / Development Scripts

```
npm i        # install deps
npm run dev  # Vite dev server (hot reload)
npm run build
npm run preview
```

---

## 7. Extension Ideas (TODO)

• Replace mocked AI hooks with real OpenAI calls.  
• Add auth layer so each user sees only their generations.  
• Paginate / lazy-load gallery.  
• Unit tests for utilities & hooks.

---

*Generated automatically – update when the project structure changes.* 