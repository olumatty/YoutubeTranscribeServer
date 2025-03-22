# My NodeJS Server Template

A robust, production-ready Node.js server template with Express, TypeScript, PostgreSQL, Drizzle ORM, and CRON job support.

## Features

- **TypeScript**: Type-safe code for enhanced developer experience
- **Express**: Fast, unopinionated web framework
- **PostgreSQL**: Reliable and powerful SQL database
- **Drizzle ORM**: Lightweight, type-safe SQL query builder
- **CRON Jobs**: Built-in scheduling system
- **Modular Architecture**: Well-organized code structure for scalability
- **Environment Configuration**: Support for different environments (development, staging, production)
- **Error Handling**: Centralized error management

## Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- PostgreSQL database

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/my-node-server-template.git
cd my-node-server-template
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```
# Server Configuration
PORT=8000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
```

For different environments, you can create:

- `.env.staging` for staging environment
- `.env.production` for production environment

### 4. Set up the database

Make sure your PostgreSQL database is running. Then:

```bash
# Generate migration files based on your schema
npm run db:generate

# Apply migrations to your database
npm run db:migrate
```

### 5. Start the development server

```bash
npm run dev
```

Your server will be running at http://localhost:8000 (or the PORT you specified in your .env file).

## Project Structure

```
my-node-server-template/
├── config/             # Configuration files
├── constants/          # Application constants
├── controllers/        # API route controllers
├── cron/               # Scheduled jobs
├── db/                 # Database models and connection
├── middlewares/        # Express middlewares
├── migrations/         # Database migrations
├── routes/             # API routes
├── scripts/            # Utility scripts
├── services/           # Business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── .env                # Environment variables (not committed)
├── .gitignore          # Git ignore file
├── drizzle.config.ts   # Drizzle ORM configuration
├── index.ts            # Application entry point
├── nodemon.json        # Nodemon configuration
├── package.json        # Project dependencies
├── README.md           # Project documentation
└── tsconfig.json       # TypeScript configuration
```

## Available Scripts

- **`npm start`**: Build and start the production server
- **`npm run dev`**: Start the development server with hot-reload
- **`npm run build`**: Build the TypeScript project
- **`npm run db:check`**: Check database schema
- **`npm run db:drop`**: Drop a database table
- **`npm run db:generate`**: Generate migration files
- **`npm run db:migrate`**: Apply migrations to the database
- **`npm run db:studio`**: Launch Drizzle Studio (database GUI)

## API Endpoints

The template includes a sample API endpoint:

- **GET /users**: Retrieve all users

## Database Schema

The template includes a sample users table with the following schema:

```typescript
export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull().default('regular'),
  preferences: jsonb('preferences').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Adding New Features

### Creating a new route

1. Create a controller in the `controllers` directory
2. Create a route file in the `routes` directory
3. Import and use the route in `index.ts`

### Creating a new database model

1. Add your model to `db/schema.ts`
2. Generate and apply migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

### Adding a CRON job

Add your scheduled job in the `cron` directory and import it in your application.

## Production Deployment

1. Build the project:

   ```bash
   npm run build
   ```

2. Set the NODE_ENV to 'production' in your environment:

   ```
   NODE_ENV=production
   ```

3. Start the server:
   ```bash
   npm start
   ```

## License

ISC
