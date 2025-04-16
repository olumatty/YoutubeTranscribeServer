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
- **Authentication**: JWT-based authentication with cookie support
- **File Upload**: Multer integration for handling file uploads
- **CORS**: Configurable CORS handling
- **Input Validation**: Zod schema validation
- **Cloud Storage**: Backblaze B2 integration for file storage
- **SMS Integration**: Africa's Talking SMS service support
- **Testing**: Vitest-based testing infrastructure with Supertest for API testing

## Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- PostgreSQL database
- Backblaze B2 account (for file storage)
- Africa's Talking account (for SMS services)

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

Copy the example environment file to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file with your specific configuration:

```
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/your_database

# Server
PORT=8000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Backblaze B2 Storage
B2_APPLICATION_KEY_ID=your_backblaze_app_key_id
B2_APPLICATION_KEY=your_backblaze_app_key
B2_BUCKET_ID=your_backblaze_bucket_id
B2_BUCKET_NAME=your_backblaze_bucket_name

# SMS (Or any other SMS provider)
AT_API_KEY=your_africastalking_api_key
AT_USERNAME=your_africastalking_username
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
├── helpers/            # Helper functions and utilities
├── middlewares/        # Express middlewares
├── migrations/         # Database migrations
├── routes/             # API routes
├── schemas/            # Zod validation schemas
├── scripts/            # Utility scripts
├── services/           # Business logic
├── tests/              # Test files
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── .env                # Environment variables (not committed)
├── .env.example        # Example environment variables
├── .env.test           # Test environment variables
├── .gitignore          # Git ignore file
├── drizzle.config.ts   # Drizzle ORM configuration
├── index.ts            # Application entry point
├── nodemon.json        # Nodemon configuration
├── package.json        # Project dependencies
├── README.md           # Project documentation
├── tsconfig.json       # TypeScript configuration
└── vitest.config.ts    # Vitest test configuration
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
- **`npm test`**: Run all tests
- **`npm run test:watch`**: Run tests in watch mode

## Key Features

### Authentication

- JWT-based authentication with cookie support
- Secure password hashing with bcrypt
- Configurable token expiration

### File Upload

- Multer integration for handling file uploads
- Backblaze B2 cloud storage integration
- Configurable file size limits and types

### SMS Integration

- Africa's Talking SMS service integration
- Configurable SMS templates and settings

### Security

- CORS configuration
- Input validation with Zod
- Centralized error handling
- Secure cookie handling

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

### Adding new environment variables

1. Add the new variables to `.env.example`
2. Update the environment configuration in `config/env.ts`
3. Add the new variables to your `.env` file

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

## Testing

The project includes a comprehensive testing setup using Vitest and Supertest:

1. **Unit Tests**: Test individual components and functions
2. **Integration Tests**: Test API endpoints and database interactions
3. **Environment**: Separate test environment with its own configuration

To run tests:

```bash
# Copy the example env to your test env
cp .env.example .env.test

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

Test files should be placed in the `tests/` directory with the `.test.ts` extension.
