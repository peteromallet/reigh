import React, { useState, useMemo } from 'react';
import { useListTasks, useCancelAllPendingTasks } from '@/shared/hooks/useTasks';
import { useProject } from '@/shared/contexts/ProjectContext';
import TaskItem from './TaskItem';
import { TaskStatus, Task } from '@/types/tasks';
import { taskStatusEnum } from '../../../../db/schema/enums'; // Corrected relative path
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { useToast } from '@/shared/hooks/use-toast'; // For user feedback

const TaskList: React.FC = () => {
  const { selectedProjectId } = useProject();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('Pending');
  const { toast } = useToast(); // Initialize toast

  const { data: tasks, isLoading, error, refetch } = useListTasks({
    projectId: selectedProjectId,
    status: statusFilter === 'All' ? undefined : [statusFilter],
  });

  const cancelAllPendingMutation = useCancelAllPendingTasks();

  const pendingTasksCount = useMemo(() => {
    if (!tasks) return 0;
    // If current filter is 'Pending', we can use tasks.length directly if it's accurate
    // Otherwise, or to be safe, filter all tasks to find pending ones for the count.
    // This count is for the button's disabled state, not for the displayed list.
    // For an accurate count of all pending tasks irrespective of current filter:
    // We would need to fetch all tasks or have a specific hook for just pending tasks count.
    // For simplicity, let's assume 'tasks' reflects the current filter.
    // If statusFilter is 'Pending', tasks are pending tasks. If 'All', we need to filter.
    if (statusFilter === 'Pending') return tasks.length;
    if (statusFilter === 'All') return tasks.filter(t => t.status === 'Pending').length;
    return 0; // Not showing pending tasks, so button might be less relevant or show 0
  }, [tasks, statusFilter]);
  
  // More accurate pending tasks count by filtering the *currently fetched* tasks if filter is 'All'
  // or by relying on the length if filter is 'Pending'.
  // This relies on `tasks` variable containing the data based on `statusFilter`.
  const actualPendingTasksInView = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => task.status === 'Pending');
  }, [tasks]);

  const handleFilterChange = (value: string) => {
    setStatusFilter(value as TaskStatus | 'All');
  };

  const handleCancelAllPending = () => {
    if (!selectedProjectId) {
      toast({ title: 'Error', description: 'No project selected.', variant: 'destructive' });
      return;
    }
    cancelAllPendingMutation.mutate({ projectId: selectedProjectId }, {
      onSuccess: (data) => {
        toast({
          title: 'Tasks Cancellation Initiated',
          description: data.message || `Attempting to cancel all pending tasks.`,
          variant: 'default'
        });
        refetch(); // Refetch the current list
      },
      onError: (error) => {
        toast({
          title: 'Cancellation Failed',
          description: error.message || 'Could not cancel all pending tasks.',
          variant: 'destructive'
        });
      }
    });
  };

  const availableStatuses: (TaskStatus | 'All')[] = ['All', ...taskStatusEnum.enumValues];

  return (
    <div className="p-4 h-full flex flex-col text-zinc-200">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Tasks</h3>
          {/* Display this button only if there are pending tasks based on the current view or a more specific check */}
          {actualPendingTasksInView.length > 0 && (
             <Button 
                variant="destructive"
                size="sm"
                onClick={handleCancelAllPending}
                disabled={cancelAllPendingMutation.isPending || isLoading}
             >
                {cancelAllPendingMutation.isPending ? 'Cancelling All...' : `Cancel All Pending (${actualPendingTasksInView.length})`}
             </Button>
          )}
        </div>
        <div className="flex gap-2 items-center">
            <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px] bg-zinc-700 border-zinc-600">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-700 text-zinc-200 border-zinc-600">
                    {availableStatuses.map(status => (
                        <SelectItem key={status} value={status} className="hover:bg-zinc-600">
                            {status}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="bg-zinc-700 border-zinc-600 hover:bg-zinc-600">
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-zinc-400">Loading tasks...</p>}
      {error && <p className="text-red-500">Error loading tasks: {error.message}</p>}
      
      {!isLoading && !error && tasks?.length === 0 && (
        <p className="text-zinc-400">No tasks found for the selected criteria.</p>
      )}

      {!isLoading && !error && tasks && tasks.length > 0 && (
        <ScrollArea className="flex-grow pr-3">
            {tasks.map((task: Task) => (
                <TaskItem key={task.id} task={task} />
            ))}
        </ScrollArea>
      )}
    </div>
  );
};

export default TaskList; 