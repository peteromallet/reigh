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
      if (!projectId) {
        // Return an empty array or throw an error if projectId is not available
        // This prevents calling the API with undefined projectId
        return []; 
      }
      const response = await axios.get('/api/tasks', {
        params: {
          projectId,
          status, // Server will handle if status is single or array
        },
      });
      return response.data;
    },
    enabled: !!projectId, // Only run the query if projectId is available
  });
};

// Hook to cancel a task
export const useCancelTask = () => {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useProject();

  return useMutation<Task, Error, string>({ // Second type arg is Error, third is taskId (string)
    mutationFn: async (taskId: string) => {
      const response = await axios.patch(`/api/tasks/${taskId}/cancel`);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch tasks list for the current project to reflect the change
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId] });
      
      // Optionally, optimistically update the specific task in the cache
      // queryClient.setQueryData([TASKS_QUERY_KEY, selectedProjectId], (oldData?: Task[]) =>
      //   oldData ? oldData.map(task => task.id === data.id ? data : task) : []
      // );
    },
    // onError: (error) => {
    //   // Handle error, e.g., show a toast notification
    //   console.error("Error cancelling task:", error);
    // }
  });
};

// Hook to cancel all pending tasks for a project
interface CancelAllPendingTasksResponse {
  message: string;
  cancelledCount: number;
}

export const useCancelAllPendingTasks = () => {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useProject(); // To invalidate queries for the current project

  return useMutation<CancelAllPendingTasksResponse, Error, { projectId: string }>({
    mutationFn: async ({ projectId }) => {
      if (!projectId) {
        throw new Error("Project ID is required to cancel all pending tasks.");
      }
      const response = await axios.post('/api/tasks/cancel-pending', { projectId });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch tasks list for the current project to reflect the changes
      // We can invalidate all queries related to tasks for this project or be more specific
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId] });
      // Potentially invalidate queries with specific statuses too if they are separate
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Pending']] });
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, selectedProjectId, ['Cancelled']] });
    },
    // onError: (error) => { // Handled by caller using toast for now
    //   console.error("Error cancelling all pending tasks:", error);
    // }
  });
}; 