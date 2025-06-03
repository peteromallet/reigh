# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/53458e2e-282b-40eb-bc90-8a67cdc12e9a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/53458e2e-282b-40eb-bc90-8a67cdc12e9a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE (Local Development Setup)**

To work locally using your own IDE, follow these steps. This project supports both a local SQLite database for development (recommended for first-time setup) and a remote Supabase (PostgreSQL) database.

**Quick Start with Local SQLite Database:**

1.  **Clone the Repository:**
    ```sh
    # Replace <YOUR_GIT_URL> with the actual Git URL from GitHub
    git clone <YOUR_GIT_URL>
    cd <YOUR_PROJECT_NAME> 
    ```

2.  **Install Dependencies:**
    ```sh
    npm i
    ```

3.  **Configure Environment for Local SQLite:**
    *   Create a file named `.env.local` in the root of your project.
    *   Add the following line to it:
        ```env
        APP_ENV=local
        ```
    This tells the application to use the local SQLite database (defaulting to `./local.db`). You can also specify `DATABASE_URL_SQLITE=./your_custom_name.db` in this file if you prefer a different name or path.

4.  **Set Up and Seed the Local SQLite Database:**
    *   The project includes a manual SQL file (`db/migrations-sqlite/0000_manual_initial_schema.sql`) that defines the table structure for the local SQLite database.
    *   The database tables and initial seed data are created by running the main seed script. This script will execute the necessary SQL to create your tables if the database file (`local.db`) or tables don\'t exist.
    *   Run the following command in your terminal:
        ```sh
        npm run db:seed:sqlite
        ```
    *   This command will:
        *   Create the `./local.db` file (or the path specified by `DATABASE_URL_SQLITE`).
        *   Create all necessary tables (users, projects, tasks, etc.) using the DDL definitions from `db/migrations-sqlite/0000_manual_initial_schema.sql`.
        *   Populate the database with initial seed data.
    *   If this step is successful, you should see `[Seed] Database seeding completed successfully.` in your terminal.

5.  **Start the Development Server:**
    ```sh
    npm run dev
    ```
    Your application should now be running (usually at `http://localhost:2222/`) and using the local SQLite database. Check the terminal output for `[DB] Connecting to SQLite at ./local.db via Drizzle...`.

_Note on Local SQLite Migrations:_
The primary schema definition (`db/schema/schema.ts`) is PostgreSQL-first. Drizzle Kit's automatic migration generation for SQLite (`npm run db:generate:sqlite`) currently has difficulties directly translating this schema for SQLite migrations. Therefore, the initial SQLite database setup relies on the `npm run db:seed:sqlite` script executing the manual DDL found in `db/migrations-sqlite/0000_manual_initial_schema.sql`.
If you update `db/schema/schema.ts` and need to reflect these changes in your local SQLite database:
  1. Generate the PostgreSQL migration to see the SQL changes: `npm run db:generate:pg`.
  2. Manually adapt the relevant `ALTER TABLE`, `CREATE TABLE`, etc., SQL from the new PostgreSQL migration file into SQLite-compatible syntax.
  3. Update `db/migrations-sqlite/0000_manual_initial_schema.sql` (if it's still effectively your full schema) or create a new manual SQLite migration script and adjust your local setup workflow accordingly.
  4. For a full schema reset, delete `local.db` and re-run `npm run db:seed:sqlite`.

**Connecting to Supabase (PostgreSQL) Locally (Alternative):**

If you wish to connect your local development environment to your remote Supabase PostgreSQL database:
1.  Update your `.env.local` file:
    ```env
    APP_ENV=web
    SUPABASE_DATABASE_URL="your_supabase_connection_string_here"
    
    # These are needed if your application directly uses the Supabase JS client (e.g., for Auth, Storage)
    VITE_SUPABASE_URL="your_supabase_project_url_from_dashboard"
    VITE_SUPABASE_ANON_KEY="your_supabase_anon_key_from_dashboard"
    ```
2.  Ensure your Supabase database schema is up-to-date. You would typically use Drizzle Kit's PostgreSQL migration commands:
    ```sh
    # Generate new migrations from db/schema/schema.ts if you made changes
    npm run db:generate:pg  
    # Apply these migrations to your Supabase instance (e.g., via Supabase dashboard SQL editor or Supabase CLI)
    ```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Environment Variables

This project uses environment variables to configure database connections and other services. Create a `.env.local` file in the root of your project for local development.

-   **`APP_ENV`**: (Optional) Controls the application environment and database backend.
    -   Set to `web` to use PostgreSQL (Supabase). Requires `SUPABASE_DATABASE_URL`.
    -   Set to `local` (or leave unset, as `local` is the default) to use a local SQLite database. Uses `DATABASE_URL_SQLITE` or defaults to `./local.db`.

-   **`SUPABASE_DATABASE_URL`**: (Required if `APP_ENV=web`)
    The full connection string for your Supabase PostgreSQL database. This is primarily used by Drizzle ORM (server-side or during build/migration steps).
    -   Example: `postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT_REF].db.supabase.co:5432/postgres`

-   **`DATABASE_URL_SQLITE`**: (Optional, defaults to `./local.db` if `APP_ENV` is not `web`)
    The path to your local SQLite database file. Used by Drizzle ORM.
    -   Example: `file:./my_local_dev.db` or simply `./local.db`

-   **`VITE_SUPABASE_URL`**: (Required if using Supabase client features like Auth, Storage, Functions client-side)
    The URL for your Supabase project. **Must be prefixed with `VITE_`** to be exposed to the client-side Vite application.
    -   Find this in your Supabase project dashboard (Settings > API > Project URL).
    -   Example: `https://yourprojectref.supabase.co`

-   **`VITE_SUPABASE_ANON_KEY`**: (Required if using Supabase client features client-side)
    The anonymous public key for your Supabase project. **Must be prefixed with `VITE_`** to be exposed to the client-side Vite application.
    -   Find this in your Supabase project dashboard (Settings > API > Project API keys > anon public).
    -   Example: `eyYourAnonKey...`

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/53458e2e-282b-40eb-bc90-8a67cdc12e9a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
