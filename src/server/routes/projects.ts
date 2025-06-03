import express, { Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db'; // Adjusted path from @/lib/db
import { projects as projectsTable } from '../../../db/schema/schema';
import { eq, asc, desc, and } from 'drizzle-orm';

const projectsRouter = express.Router();
const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000'; // As per RFC

// Define an asyncHandler to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// GET /api/projects
projectsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    let fetchedData = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      userId: projectsTable.userId,
      aspectRatio: projectsTable.aspectRatio, // Include aspectRatio in fetched data
      // Optionally include createdAt, updatedAt if needed
    })
      .from(projectsTable)
      .where(eq(projectsTable.userId, DUMMY_USER_ID))
      .orderBy(asc(projectsTable.name));

    // RFC: If no projects exist, create and return a default one
    if (fetchedData.length === 0) {
      const defaultProjectName = 'Default Project';
      const newDefaultProject = await db.insert(projectsTable).values({
        name: defaultProjectName,
        userId: DUMMY_USER_ID,
        aspectRatio: '16:9', // Default aspect ratio for the default project
      }).returning({
        id: projectsTable.id,
        name: projectsTable.name,
        userId: projectsTable.userId,
        aspectRatio: projectsTable.aspectRatio, // Return aspectRatio for default project
      });
      fetchedData = newDefaultProject;
    }

    res.status(200).json(fetchedData);
  } catch (error) {
    console.error('[API Error Fetching Projects]', error);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
}));

// POST /api/projects
projectsRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  let projectNameFromRequest: string | undefined;
  let aspectRatioFromRequest: string | undefined;
  try {
    const { name, aspectRatio } = req.body;
    projectNameFromRequest = name;
    aspectRatioFromRequest = aspectRatio;

    if (!projectNameFromRequest || typeof projectNameFromRequest !== 'string' || !projectNameFromRequest.trim()) {
      return res.status(400).json({ message: 'Project name is required and must be a non-empty string' });
    }
    const trimmedProjectName = projectNameFromRequest.trim();

    if (!aspectRatioFromRequest || typeof aspectRatioFromRequest !== 'string' || !aspectRatioFromRequest.trim()) {
      // For now, let's make aspect ratio optional on the backend, 
      // or set a default if not provided, though the frontend should always send it.
      // If it becomes strictly required, this check can be enforced.
      // return res.status(400).json({ message: 'Aspect ratio is required and must be a non-empty string' });
    }

    const newProjects = await db.insert(projectsTable).values({
      name: trimmedProjectName,
      userId: DUMMY_USER_ID,
      aspectRatio: aspectRatioFromRequest, // Save aspectRatio
    }).returning({
      id: projectsTable.id,
      name: projectsTable.name,
      userId: projectsTable.userId,
      aspectRatio: projectsTable.aspectRatio, // Return aspectRatio in response
    });

    if (!newProjects || newProjects.length === 0) {
      console.error('[API Error Creating Project]', 'Insert operation did not return the new project.');
      return res.status(500).json({ message: 'Failed to create project after insert' });
    }

    // .returning() returns an array, so pick the first element.
    const createdProject = {
      id: newProjects[0].id,
      name: newProjects[0].name,
      user_id: newProjects[0].userId, // Ensure key matches client expectation
      aspectRatio: newProjects[0].aspectRatio,
    };

    res.status(201).json(createdProject);
  } catch (error: any) {
    console.error('[API Error Creating Project]', error);
    if (error.code === '23505') { // Unique violation example
      const nameForError = (typeof projectNameFromRequest === 'string' && projectNameFromRequest.trim())
        ? projectNameFromRequest.trim()
        : 'the given name';
      return res.status(409).json({ message: `Project with name "${nameForError}" already exists.` });
    }
    res.status(500).json({ message: 'Failed to create project' });
  }
}));

// A very simple synchronous test route
projectsRouter.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({ message: 'pong' });
});

// Keep the POST test route as is
projectsRouter.post('/ping', (req: Request, res: Response) => {
  res.status(201).json({ message: 'pong post' });
});

export default projectsRouter; 