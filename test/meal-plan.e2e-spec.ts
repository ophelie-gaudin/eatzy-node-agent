import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { TaskStatusEnum } from '../src/meal-plan/entities/meal-plan.entity'
import * as fs from 'fs'
import * as path from 'path'

describe('MealPlanController (e2e)', () => {
	let app: INestApplication
	const storageDir = path.join(process.cwd(), 'storage')

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleFixture.createNestApplication()
		await app.init()

		// Clear storage directory before tests
		if (fs.existsSync(storageDir)) {
			const files = fs.readdirSync(storageDir)
			for (const file of files) {
				fs.unlinkSync(path.join(storageDir, file))
			}
		}
	})

	afterAll(async () => {
		await app.close()
	})

	describe('Async meal plan generation flow', () => {
		it('should start a meal plan generation task and return 201 Created', async () => {
			// Test meal plan request data
			const mealPlanRequest = {
				daysCount: 1,
				meals: ['breakfast', 'lunch'],
				diet: 'vegetarian',
				excludedIngredients: ['nuts'],
			}

			// Step 1: Start meal plan generation
			const response = await request(app.getHttpServer())
				.post('/meal-plan/async/generate')
				.send(mealPlanRequest)
				.expect(HttpStatus.CREATED)

			// Verify response structure
			expect(response.body).toHaveProperty('task_id')
			expect(response.body).toHaveProperty(
				'status',
				TaskStatusEnum.PENDING,
			)

			// Get task ID for subsequent requests
			const taskId = response.body.task_id

			// Step 2: Poll for task status until it's completed or failed
			let taskStatus
			let maxAttempts = 10 // Set a reasonable number of attempts
			let attempts = 0
			let isCompleted = false

			while (!isCompleted && attempts < maxAttempts) {
				attempts++
				const statusResponse = await request(app.getHttpServer())
					.get(`/meal-plan/async/status/${taskId}`)
					.expect(HttpStatus.OK)

				taskStatus = statusResponse.body

				// Check if task is in a terminal state
				if (
					taskStatus.status === TaskStatusEnum.COMPLETED ||
					taskStatus.status === TaskStatusEnum.FAILED
				) {
					isCompleted = true
				} else {
					// Wait 1 second before next attempt
					await new Promise((resolve) => setTimeout(resolve, 1000))
				}
			}

			// Verify task completed successfully
			expect(taskStatus.status).toBe(TaskStatusEnum.COMPLETED)
			expect(taskStatus.result).toBeDefined()
			expect(taskStatus.result.days).toHaveLength(1)
			expect(taskStatus.result.shopping_list).toBeDefined()
		})

		it('should use long polling to wait for task completion', async () => {
			// Test meal plan request data
			const mealPlanRequest = {
				daysCount: 1,
				meals: ['breakfast'],
				diet: 'vegan',
			}

			// Step 1: Start meal plan generation
			const response = await request(app.getHttpServer())
				.post('/meal-plan/async/generate')
				.send(mealPlanRequest)
				.expect(HttpStatus.CREATED)

			const taskId = response.body.task_id

			// Step 2: Use long polling to wait for completion
			const statusResponse = await request(app.getHttpServer())
				.get(`/meal-plan/async/wait/${taskId}?timeout=20`)
				.expect(HttpStatus.OK)

			const taskStatus = statusResponse.body

			// Verify task completed
			expect(taskStatus.status).toBe(TaskStatusEnum.COMPLETED)
			expect(taskStatus.result).toBeDefined()
			expect(taskStatus.result.days).toHaveLength(1)

			// Verify meal plan structure
			const mealPlan = taskStatus.result
			expect(mealPlan.days[0].meals[0].meal_type).toBe('breakfast')

			// Verify the recipe structure
			const recipe = mealPlan.days[0].meals[0].recipes[0].recipe
			expect(recipe).toHaveProperty('name')
			expect(recipe).toHaveProperty('ingredients')
			expect(recipe).toHaveProperty('steps')

			// For vegan diet, verify we got vegan recipes
			if (mealPlanRequest.diet === 'vegan') {
				expect(recipe.name).toContain('Vegan')
			}
		})

		it('should return 404 for non-existent task', async () => {
			await request(app.getHttpServer())
				.get('/meal-plan/async/status/non-existent-task-id')
				.expect(HttpStatus.NOT_FOUND)
		})
	})
})
