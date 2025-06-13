import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index'; // Use the environment-aware DB client
import { generations } from '../../../db/schema/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// List all generations for a specific project
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const generationsList = await db.select().from(generations)
      .where(eq(generations.projectId, projectId as string));

    res.json(generationsList);
  } catch (error) {
    console.error('[API Error] Error fetching generations:', error);
    res.status(500).json({ message: 'Failed to fetch generations.' });
  }
});

// Create a new generation
router.post('/', async (req, res) => {
  try {
    const { tasks, params, location, type, projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const newGeneration = {
      id: uuidv4(),
      tasks: tasks || [],
      params: params || {},
      location: location || null,
      type: type || null,
      projectId: projectId,
    };

    await db.insert(generations).values(newGeneration);

    res.status(201).json(newGeneration);
  } catch (error) {
    console.error('[API Error] Error creating generation:', error);
    res.status(500).json({ message: 'Failed to create generation.' });
  }
});

// Get a specific generation by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const generation = await db.select().from(generations).where(eq(generations.id, id));

    if (!generation || generation.length === 0) {
      return res.status(404).json({ message: 'Generation not found' });
    }

    res.json(generation[0]);
  } catch (error) {
    console.error('[API Error] Error fetching generation:', error);
    res.status(500).json({ message: 'Failed to fetch generation.' });
  }
});

// Update an existing generation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tasks, params, location, type, projectId } = req.body;

    const existingGeneration = await db.select().from(generations).where(eq(generations.id, id));

    if (!existingGeneration || existingGeneration.length === 0) {
      return res.status(404).json({ message: 'Generation not found' });
    }

    const updatedGeneration = {
      tasks: tasks || existingGeneration[0].tasks,
      params: params || existingGeneration[0].params,
      location: location || existingGeneration[0].location,
      type: type || existingGeneration[0].type,
      projectId: projectId || existingGeneration[0].projectId,
    };

    await db.update(generations)
      .set(updatedGeneration)
      .where(eq(generations.id, id));

    res.json({ message: 'Generation updated successfully.' });
  } catch (error) {
    console.error('[API Error] Error updating generation:', error);
    res.status(500).json({ message: 'Failed to update generation.' });
  }
});

// Delete a generation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingGeneration = await db.select().from(generations).where(eq(generations.id, id));

    if (!existingGeneration || existingGeneration.length === 0) {
      return res.status(404).json({ message: 'Generation not found' });
    }

    await db.delete(generations).where(eq(generations.id, id));

    res.json({ message: 'Generation deleted successfully.' });
  } catch (error) {
    console.error('[API Error] Error deleting generation:', error);
    res.status(500).json({ message: 'Failed to delete generation.' });
  }
});

export default router;
