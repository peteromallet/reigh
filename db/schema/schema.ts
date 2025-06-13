// Temporarily empty schema for Drizzle Kit to initialize the migrations folder.

import { pgTable, text, timestamp, jsonb, pgEnum, uuid, index, primaryKey, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const taskStatusEnum = pgEnum('task_status', ['Pending', 'Queued', 'In Progress', 'Complete', 'Failed', 'Cancelled']);

// --- Canonical Schema for PostgreSQL ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email'),
  apiKeys: jsonb('api_keys'), // Store API keys as JSONB object
});

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  aspectRatio: text('aspect_ratio'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Type for updating projects, allowing optional fields
export type ProjectUpdate = {
  name?: string;
  aspectRatio?: string;
};

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskType: text('task_type').notNull(),
  params: jsonb('params').notNull(),
  status: taskStatusEnum('status').default('Pending').notNull(),
  dependantOn: text('dependant_on'),
  outputLocation: text('output_location'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  generationProcessedAt: timestamp('generation_processed_at', { withTimezone: true }),
}, (table) => ({
  // Indexes for better query performance
  statusCreatedIdx: index('idx_status_created').on(table.status, table.createdAt),
  dependantOnIdx: index('idx_dependant_on').on(table.dependantOn),
  projectStatusIdx: index('idx_project_status').on(table.projectId, table.status),
}));

export const generations = pgTable('generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tasks: jsonb('tasks'), // Storing array as JSONB
  params: jsonb('params'),
  location: text('location'),
  type: text('type'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
});

export const shots = pgTable('shots', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
});

export const shotGenerations = pgTable('shot_generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  shotId: uuid('shot_id').notNull().references(() => shots.id, { onDelete: 'cascade' }),
  generationId: uuid('generation_id').notNull().references(() => generations.id, { onDelete: 'cascade' }),
  position: integer('position').default(0).notNull(),
});

export const resources = pgTable('resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'lora'
  metadata: jsonb('metadata').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  resources: many(resources),
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

export const resourcesRelations = relations(resources, ({ one }) => ({
  user: one(users, {
    fields: [resources.userId],
    references: [users.id],
  }),
}));

// console.log('Canonical schema loaded.'); // Removed noisy console log 