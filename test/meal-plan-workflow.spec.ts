import * as request from 'supertest'
import { TaskStatusEnum } from '../src/meal-plan/entities/meal-plan.entity'
import { expect, jest } from '@jest/globals'

/**
 * This test demonstrates the workflow of:
 * 1. Starting a meal plan generation task
 * 2. Polling for task status until it's complete
 * 3. Retrieving the generated meal plan
 *
 * Note: This is not a complete test suite, just a demonstration of the workflow.
 * It requires the API server to be running separately.
 */

// Set a longer timeout for this test suite
jest.setTimeout(120000)

// Update this URL to match your server
const API_URL = 'http://localhost:3000'

describe('Meal Plan Generation Workflow', () => {
	it('should follow the complete meal plan generation flow', async () => {
		// Step 1: Create meal plan request
		const mealPlanRequest = {
			daysCount: 2,
			meals: ['breakfast', 'lunch', 'dinner'],
			diet: 'vegetarian',
		}

		// Step 2: Start meal plan generation task
		console.log('Starting meal plan generation task...')
		const startResponse = await request(API_URL)
			.post('/meal-plan/generate')
			.send(mealPlanRequest)

		// Expect 201 Created response
		expect(startResponse.status).toBe(201)
		expect(startResponse.body).toHaveProperty('task_id')
		expect(startResponse.body).toHaveProperty(
			'status',
			TaskStatusEnum.PENDING,
		)

		const taskId = startResponse.body.task_id
		console.log(`Task started with ID: ${taskId}`)

		// Step 3: Poll for task status until complete
		let isCompleted = false
		let taskStatus
		let attempts = 0
		const maxAttempts = 60 // Increased to 60 attempts (60 seconds with 1 second polling)

		console.log('Polling for task status...')
		while (!isCompleted && attempts < maxAttempts) {
			attempts++

			// Get task status
			const statusResponse = await request(API_URL).get(
				`/meal-plan/status/${taskId}`,
			)

			taskStatus = statusResponse.body
			console.log(
				`Attempt ${attempts}: Task status: ${taskStatus.status}`,
			)

			// Check if task is complete or failed
			if (
				taskStatus.status === TaskStatusEnum.COMPLETED ||
				taskStatus.status === TaskStatusEnum.FAILED
			) {
				isCompleted = true
			} else {
				// Wait 1 second before next poll
				await new Promise((resolve) => setTimeout(resolve, 1000))
			}
		}

		// Step 4: Verify task completed successfully
		expect(isCompleted).toBe(true)
		expect(taskStatus.status).toBe(TaskStatusEnum.COMPLETED)

		// Step 5: Get the generated meal plan from task result
		console.log('Task completed! Retrieving meal plan...')
		const mealPlan = taskStatus.result

		// Verify meal plan structure
		expect(mealPlan).toHaveProperty('days')
		expect(mealPlan).toHaveProperty('shopping_list')
		expect(mealPlan.days).toHaveLength(mealPlanRequest.daysCount)

		// Print some information about the generated meal plan
		console.log(`Generated meal plan with ${mealPlan.days.length} days`)
		console.log(
			`Shopping list contains ${mealPlan.shopping_list.length} items`,
		)

		// Sample one recipe from the meal plan
		const sampleMeal = mealPlan.days[0].meals[0]
		console.log(`Sample meal: ${sampleMeal.meal_type}`)
		console.log(`Sample recipe: ${sampleMeal.recipes[0].recipe.name}`)
	})
})
