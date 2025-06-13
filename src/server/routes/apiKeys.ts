import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index'; // Use the environment-aware DB client
import { users } from '../../../db/schema/schema';

const router = express.Router();

// Get API keys for a user
router.get('/', async (req, res) => {
  try {
    const dummyUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    const user = await db.select({
      id: users.id,
      apiKeys: users.apiKeys,
    }).from(users).where(eq(users.id, dummyUserId)).limit(1);

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const apiKeys = user[0].apiKeys || {};
    res.json(apiKeys);
  } catch (error) {
    console.error('[API Error] Error fetching API keys:', error);
    res.status(500).json({ message: 'Failed to fetch API keys.' });
  }
});

// Update API keys for a user
router.post('/', async (req, res) => {
  try {
    const dummyUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const { newKeys } = req.body;

    if (!newKeys || typeof newKeys !== 'object') {
      return res.status(400).json({ message: 'Invalid API keys format' });
    }

    // Fetch the user to ensure they exist
    const existingUser = await db.select().from(users).where(eq(users.id, dummyUserId));
    if (!existingUser || existingUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user's API keys
    await db.update(users)
      .set({ apiKeys: newKeys })
      .where(eq(users.id, dummyUserId));

    res.json({ message: 'API keys updated successfully', apiKeys: newKeys });
  } catch (error) {
    console.error('[API Error] Error updating API keys:', error);
    res.status(500).json({ message: 'Failed to update API keys.' });
  }
});

export default router;
