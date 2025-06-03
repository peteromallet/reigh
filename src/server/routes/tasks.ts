import express, { Request, Response, Router } from 'express';
import { db } from '@/lib/db'; // Adjusted path assuming db is exported from here
import { tasks as tasksSchema } from '../../../db/schema/schema'; // Adjusted path to schema
// import { NewTask } from '../../../db/schema/schema'; // Removed NewTask import
import { sql } from 'drizzle-orm';
// import { Static, Type } from '@sinclair/typebox'; // Removed optional TypeBox import

const router: Router = express.Router();

interface TaskRequestBody {
  project_id: string;
  task_type: string;
  params: Record<string, any>; // Or a more specific TypeBox schema
  status?: string; // Keep as string, will cast to enum type if schema requires
  dependant_on?: string[]; // Optional, snake_case from client
  output_location?: string; // Optional, snake_case from client
}

router.post('/', async (req: Request, res: Response) => {
  const {
    project_id,
    task_type,
    params,
    status = 'Pending',
    dependant_on, // snake_case from client
    output_location // snake_case from client
  } = req.body as TaskRequestBody; // Cast req.body here

  if (!project_id || !task_type || !params) {
    return res.status(400).json({ message: 'Missing required fields: project_id, task_type, params' });
  }

  try {
    // Construct data for Drizzle insert using camelCase schema field names
    const taskInsertData: any = {
      projectId: project_id,
      taskType: task_type,
      params: params, 
      status: status, // Drizzle will map to enum if column is enum
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add optional fields if they were provided in the request body
    if (dependant_on !== undefined) {
      taskInsertData.dependantOn = dependant_on; // camelCase for Drizzle schema field
    }
    if (output_location !== undefined) {
      taskInsertData.outputLocation = output_location; // camelCase for Drizzle schema field
    }

    const insertedTasks = await db
      .insert(tasksSchema)
      .values(taskInsertData) // Drizzle should infer the type or use 'any' if structure is correct
      .returning();

    if (insertedTasks.length === 0) {
      console.error('[API /api/tasks] Task insertion failed, no data returned.');
      return res.status(500).json({ message: 'Task creation failed at database level.' });
    }

    const createdTask = insertedTasks[0];
    console.log('[API /api/tasks] Task created successfully:', createdTask);
    return res.status(201).json(createdTask);

  } catch (error: any) {
    console.error('[API /api/tasks] Error creating task:', error);
    if (error.message.includes('violates not-null constraint') || error.message.includes('CHECK constraint')) {
        return res.status(400).json({ message: `Database constraint violation: ${error.message}` });
    }
    return res.status(500).json({ message: 'Internal server error while creating task', error: error.message });
  }
});

export default router; 