# Eatzy Node API

A NestJS-based API for generating meal plans asynchronously. This API provides functionality to create personalized meal plans based on dietary preferences using a task-based approach for handling long-running operations.

## Features

-   Asynchronous meal plan generation with task-based processing
-   AI-powered recipe generation using OpenAI API
-   Detailed recipes with ingredients and step-by-step instructions
-   Shopping list generation for meal plans with smart consolidation
-   Long polling support for checking task status
-   Supabase database integration for persistent storage
-   Detailed task status tracking for real-time progress monitoring

## Getting Started

### Prerequisites

-   Node.js 18 or higher
-   pnpm (or npm/yarn)
-   OpenAI API key
-   Supabase account and project

### Installation

```bash
# Install dependencies
pnpm install
```

### Configuration

Create a `.env` file in the root directory with:

```
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the placeholder values with your actual API keys and URLs.

### Supabase Setup

Your Supabase project needs a `meals_plans` table with the following structure:

-   `id`: BIGINT (Primary Key)
-   `created_at`: TIMESTAMP WITH TIME ZONE
-   `plan`: JSONB (stores the meal plan data)
-   `portions_count`: BIGINT
-   `created_by`: UUID
-   `status`: TEXT (for tracking task status)
-   `error`: TEXT (for storing error messages)
-   `usage`: JSONB (for API usage statistics)

### Running the Application

```bash
# Build the application
pnpm build

# Start the server
pnpm start

# Development mode with automatic rebuilding
pnpm dev
```

The API will be available at `http://localhost:3000`

### Testing

```bash
# Run the API workflow test (server must be running)
pnpm test:api

# Run unit tests with Jest
pnpm test

# Run tests with coverage
pnpm test:cov
```

## API Endpoints

### Generate Meal Plan

**Endpoint:** `POST /meal-plan/generate`

**Request:**

```json
{
	"daysCount": 2,
	"meals": ["breakfast", "lunch", "dinner"],
	"diet": "vegetarian",
	"excludedIngredients": ["nuts", "shellfish"]
}
```

**Response:**

```json
{
	"task_id": "12345-abcde-67890",
	"status": "pending"
}
```

### Check Task Status

**Endpoint:** `GET /meal-plan/status/:taskId`

**Response:**

```json
{
	"id": "12345-abcde-67890",
	"status": "in_progress_plan",
	"created_at": "2023-05-01T12:00:00.000Z",
	"result": null,
	"error": null,
	"usage": {...}
}
```

Status can be one of:

-   `pending`: Task has been created but processing hasn't started
-   `in_progress_plan`: Task is actively generating the meal plan
-   `in_progress_shopping`: Task is generating the shopping list
-   `completed`: Task has finished successfully
-   `failed`: Task encountered an error during processing

### Wait for Task Completion (Long Polling)

**Endpoint:** `GET /meal-plan/wait/:taskId?timeout=30&targetStatus=completed`

**Query Parameters:**

-   `timeout`: Maximum time to wait in seconds (default: 30)
-   `targetStatus`: Optional status to wait for

**Response:** Same format as Check Task Status

## Asynchronous Workflow

The recommended workflow for generating meal plans is:

1. Submit a meal plan request using `POST /meal-plan/generate`
2. Receive a task ID in the response
3. Poll the task status using `GET /meal-plan/status/:taskId` until it's completed
4. When the task status is `completed`, retrieve the meal plan from the `result` field

Alternatively, you can use the long polling endpoint to wait for completion in a single request:
`GET /meal-plan/wait/:taskId`

## AI Integration

The meal plan generation uses OpenAI's GPT-4 model to:

-   Create personalized meal plans based on dietary preferences
-   Generate detailed recipes with ingredients and instructions
-   Consolidate shopping lists with proper unit conversions

## Project Structure

```
src/
├── config/           # Configuration files
│   └── supabase.ts   # Supabase client configuration
├── meal-plan/        # Meal plan module
│   ├── dto/          # Data Transfer Objects
│   ├── entities/     # Entity definitions
│   ├── meal-plan.controller.ts
│   ├── meal-plan.module.ts
│   └── meal-plan.service.ts
├── app.module.ts     # Main application module
└── main.ts           # Application entry point
```

## License

ISC
