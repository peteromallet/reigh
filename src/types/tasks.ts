import { taskStatusEnum } from '../../db/schema/enums'; // Updated path to import from enums.ts

// TaskStatus type derived from the enum values in the schema
export type TaskStatus = typeof taskStatusEnum.enumValues[number];

// Task interface based on the schema in db/schema/schema.ts
export interface Task {
  id: string; // uuid
  taskType: string;
  params: Record<string, any>; // jsonb
  status: TaskStatus;
  dependantOn?: string[]; // uuid[], optional
  outputLocation?: string; // text, optional
  createdAt: string; // timestamp (represented as string in JSON)
  updatedAt?: string; // timestamp (represented as string in JSON), optional on creation
  projectId: string; // uuid
} 