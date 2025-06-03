import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm'; // sql might not be needed if not used directly
import { randomUUID } from 'node:crypto';

// --- SQLite Adapted Schema ---

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Store UUIDs as text
});

export const projects = sqliteTable('projects', {
  id: text('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: text('name').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  aspectRatio: text('aspect_ratio'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').$defaultFn(() => randomUUID()).primaryKey(),
  taskType: text('task_type').notNull(),
  params: text('params').notNull(), // Store JSON as text
  status: text('status').default('Pending').notNull(), // pgEnum becomes text
  dependantOn: text('dependant_on'), // Store array as JSON string
  outputLocation: text('output_location'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
});

export const generations = sqliteTable('generations', {
  id: text('id').$defaultFn(() => randomUUID()).primaryKey(),
  tasks: text('tasks'), // Store array as JSON string
  location: text('location'),
  type: text('type'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
});

export const shots = sqliteTable('shots', {
  id: text('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
});

export const shotGenerations = sqliteTable('shot_generations', {
  id: text('id').$defaultFn(() => randomUUID()).primaryKey(),
  shotId: text('shot_id').notNull().references(() => shots.id, { onDelete: 'cascade' }),
  generationId: text('generation_id').notNull().references(() => generations.id, { onDelete: 'cascade' }),
  position: integer('position').default(0).notNull(),
});

// --- Relations (should largely remain compatible if field names are consistent) ---

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
  generations: many(generations),
  shots: many(shots),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export const generationsRelations = relations(generations, ({ one, many }) => ({
  project: one(projects, {
    fields: [generations.projectId],
    references: [projects.id],
  }),
  shotGenerations: many(shotGenerations),
}));

export const shotsRelations = relations(shots, ({ one, many }) => ({
  project: one(projects, {
    fields: [shots.projectId],
    references: [projects.id],
  }),
  shotGenerations: many(shotGenerations),
}));

export const shotGenerationsRelations = relations(shotGenerations, ({ one }) => ({
  shot: one(shots, {
    fields: [shotGenerations.shotId],
    references: [shots.id],
  }),
  generation: one(generations, {
    fields: [shotGenerations.generationId],
    references: [generations.id],
  }),
})); 