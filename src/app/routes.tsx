import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ToolSelectorPage from '@/pages/ToolSelectorPage';
// Placeholder imports for tool pages - these will be updated in later phases
import ImageGenerationToolPage from '@/tools/image-generation/pages/ImageGenerationToolPage';
import VideoTravelToolPage from '@/tools/video-travel/pages/VideoTravelToolPage';
import NotFoundPage from '@/pages/NotFoundPage'; // Assuming NotFoundPage will be moved here or created
import { LastAffectedShotProvider } from '@/shared/contexts/LastAffectedShotContext';
import EditTravelToolPage from '@/tools/edit-travel/pages/EditTravelToolPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <ToolSelectorPage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: '/tools/image-generation',
    element: <ImageGenerationToolPage />,
  },
  {
    path: '/tools/video-travel',
    element: <VideoTravelToolPage />,
  },
  {
    path: '/tools/edit-travel',
    element: <EditTravelToolPage />,
  },
  // It's good practice to have a catch-all for 404s if not handled by errorElement at parent routes
  // However, the errorElement on the root path should cover unmatched routes.
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
} 