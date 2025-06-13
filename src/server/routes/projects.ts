import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index'; // Use the environment-aware DB client
import { projects, users } from '../../../db/schema/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// List all projects for a user (with dummy user support for local dev)
router.get('/', async (req, res) => {
  try {
    const dummyUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    const projectsList = await db.select({
      id: projects.id,
      name: projects.name,
      userId: projects.userId,
      aspectRatio: projects.aspectRatio,
      createdAt: projects.createdAt,
    }).from(projects).where(eq(projects.userId, dummyUserId));

    res.json(projectsList);
  } catch (error) {
    console.error('[API Error] Error fetching projects:', error);
    res.status(500).json({ message: 'Failed to fetch projects.' });
  }
});

// Get a specific project by ID
router.get('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const dummyUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const project = await db.select().from(projects)
      .where(eq(projects.id, projectId))

    if (!project || project.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project[0]);
  } catch (error) {
    console.error('[API Error] Error fetching project:', error);
    res.status(500).json({ message: 'Failed to fetch project.' });
  }
});

// Create a new project
router.post('/', async (req, res) => {
  try {
    const { name, aspectRatio } = req.body;
    const dummyUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const newProjectId = uuidv4();

    await db.insert(projects).values({
      id: newProjectId,
      name,
      userId: dummyUserId,
      aspectRatio: aspectRatio || '16:9', // Default aspect ratio
    });

    res.status(201).json({ id: newProjectId, message: 'Project created successfully' });
  } catch (error) {
    console.error('[API Error] Error creating project:', error);
    res.status(500).json({ message: 'Failed to create project.' });
  }
});

// Update an existing project
router.put('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { name, aspectRatio } = req.body;

    if (!name && !aspectRatio) {
      return res.status(400).json({ message: 'Project name or aspect ratio is required for update' });
    }

    // Prepare update object
    const updateObject: { name?: string; aspectRatio?: string } = {};
    if (name) updateObject.name = name;
    if (aspectRatio) updateObject.aspectRatio = aspectRatio;

    await db.update(projects)
      .set(updateObject)
      .where(eq(projects.id, projectId));

    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    console.error('[API Error] Error updating project:', error);
    res.status(500).json({ message: 'Failed to update project.' });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;

    await db.delete(projects).where(eq(projects.id, projectId));

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('[API Error] Error deleting project:', error);
    res.status(500).json({ message: 'Failed to delete project.' });
  }
});

export default router;
