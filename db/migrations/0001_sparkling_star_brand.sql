ALTER TABLE "generations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "tasks" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shot_generations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shots" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shots" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "dependant_on" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "aspect_ratio" text;