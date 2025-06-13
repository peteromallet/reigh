
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Task, TaskStatus } from '@/types/tasks'; // Assuming Task and TaskStatus types will be defined here or imported appropriately
import { useProject } from "@/shared/contexts/ProjectContext"; // To get selectedProjectId

const TASKS_QUERY_KEY = 'tasks';

// Types for API responses and request bodies
// Ensure these align with your server-side definitions and Task type in @/types/tasks.ts

interface ListTasksParams {
  projectId: string | null | undefined;
  status?: TaskStatus | TaskStatus[];
}

// Hook to list tasks
export const useListTasks = (params: ListTasksParams) => {
  const { projectId, status } = params;
  
  return useQuery<Task[], Error>({
    queryKey: [TASKS_QUERY_KEY, projectId, status],
    queryFn: async () => {
      console.log('[useListTasks] Fetching tasks for projectId:', projectId, 'status:', status);
      if (!projectId) {
        // Return an empty array or throw an error if projectId is not available
        // This prevents calling the API with undefined projectId
        console.log('[useListTasks] No projectId, returning empty array');
        return []; 
      }
      try {
        const response = await axios.get('/api/tasks', {
          params: {
            projectId,
            status, // Server will handle if status is single or array
          },
        });
        const tasks = response.data;
        console.log('[useListTasks] Received tasks:', tasks);
        // Ensure we always return an array
        return Array.isArray(tasks) ? tasks : [];
      } catch (error) {
        console.error('[useListTasks] Error fetching tasks:', error);
        return []; // Return empty array on error to prevent iteration issues
      }
    },
    enabled: !!projectId, // Only run the query if projectId is available
  });
};

// Interface for the task creation payload
interface CreateTaskPayload {
  project_id: string;
  task_type: string;
  params: Record<string, any>;
  status?: TaskStatus;
}

// Hook to create a new task via API
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, CreateTaskPayload>({
    mutationFn: async (taskPayload) => {
      console.log('[useCreateTask] Creating task:', taskPayload);
      const { data } = await axios.post('/api/tasks', taskPayload);
      console.log('[useCreateTask] Task created:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[useCreateTask] Task creation successful, invalidating queries for projectId:', data.projectId);
      // When a new task is created, invalidate the tasks query to refetch the list
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, data.projectId] });
    },
    onError: (error) => {
      console.error('[useCreateTask] Task creation failed:', error);
    }
  });
};

// Types for API responses and request bodies for cancel operations
interface CancelTaskResponse extends Task { }

interface CancelAllPendingTasksResponse {
  message: string;
  cancelledCount: number;
}

// Hook to cancel a task
export const useCancelTask = () => {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useProject();

  return useMutation<Task, Error, string>({
    mutationFn: async (taskId) => {
      console.log('[useCancelTask] Cancelling task:', taskId);
      const response = await axios.patch(`/api/tasks/${taskId}/cancel`); // Endpoint might need to change if not generic for status update
      console.log('[useCancelTask] Task cancelled:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[useCancelTask] Task cancellation successful, invalidating queries for projectId:', selectedProjectId);
      // Invalidate and refetch tasks list for the current project
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId] });
      // Also invalidate specific status lists if they are cached separately
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Pending']] });
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Cancelled']] });
    },
    onError: (error) => {
      console.error('[useCancelTask] Task cancellation failed:', error);
    }
  });
};

// Hook to cancel all PENDING tasks for a project
// Note: The backend sets the status to "Failed" now.
export const useCancelAllPendingTasks = () => {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useProject(); // To invalidate queries for the current project

  return useMutation<CancelAllPendingTasksResponse, Error, { projectId: string }>({
    mutationFn: async ({ projectId }) => {
      console.log('[useCancelAllPendingTasks] Cancelling all pending tasks for projectId:', projectId);
      if (!projectId) {
        throw new Error("Project ID is required to cancel all pending tasks.");
      }
      const response = await axios.post('/api/tasks/cancel-pending', { projectId });
      console.log('[useCancelAllPendingTasks] All pending tasks cancelled:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[useCancelAllPendingTasks] All pending tasks cancellation successful, invalidating queries for projectId:', selectedProjectId);
      // Invalidate and refetch tasks list for the current project to reflect the changes
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Pending']] });
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Cancelled']] });
    },
    onError: (error) => {
      console.error('[useCancelAllPendingTasks] All pending tasks cancellation failed:', error);
    }
  });
}; 
