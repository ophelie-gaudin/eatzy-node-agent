import { Injectable, NotFoundException } from '@nestjs/common'
import { MealPlanRequestDto } from './dto/meal-plan-request.dto'
import {
	Day,
	Ingredient,
	MealPlan,
	TaskResponse,
	TaskStatus,
	TaskStatusEnum,
} from './entities/meal-plan.entity'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import { supabase } from '../config/supabase'

dotenv.config()

@Injectable()
export class MealPlanService {
	private readonly storageDir: string
	private readonly openai: OpenAI

	constructor() {
		this.storageDir = path.join(process.cwd(), 'storage')
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		})

		// Create storage directory if it doesn't exist (keeping for backward compatibility)
		if (!fs.existsSync(this.storageDir)) {
			fs.mkdirSync(this.storageDir, { recursive: true })
		}

		console.log(
			`MealPlanService initialized. Storage directory: ${this.storageDir}`,
		)
		if (!process.env.OPENAI_API_KEY) {
			console.warn(
				'WARNING: OPENAI_API_KEY environment variable is not set',
			)
		}
	}

	async startMealPlanGeneration(
		request: MealPlanRequestDto,
	): Promise<TaskResponse> {
		const taskId = uuidv4()
		console.log(`Starting new meal plan generation task: ${taskId}`)

		// Initialize task status
		const status: TaskStatus = {
			id: taskId,
			status: TaskStatusEnum.PENDING,
			created_at: new Date().toISOString(),
		}

		// Save to Supabase
		await this.saveTaskStatus(taskId, status)
		console.log(`Task ${taskId} initialized with status: ${status.status}`)

		// Start background task
		console.log(
			`Spawning background task for meal plan generation: ${taskId}`,
		)
		setTimeout(() => {
			this.generateMealPlanBackground(taskId, request)
		}, 0)

		return {
			task_id: taskId,
			status: TaskStatusEnum.PENDING,
		}
	}

	private async generateMealPlanBackground(
		taskId: string,
		request: MealPlanRequestDto,
	): Promise<void> {
		try {
			console.log(`Background task started for task_id: ${taskId}`)

			// Update status to in progress plan
			const status = await this.getTaskStatus(taskId)
			status.status = TaskStatusEnum.IN_PROGRESS_PLAN
			status.usage = {}
			await this.saveTaskStatus(taskId, status)
			console.log(`Task ${taskId} status updated to: ${status.status}`)

			// Generate meal plan
			console.log(`Task ${taskId}: Starting meal plan generation`)
			const { mealPlan, usageStats } = await this.generateMealPlan(
				request,
			)
			console.log(`Task ${taskId}: Meal plan generation completed`)

			// Store meal plan usage statistics
			if (status.usage) {
				status.usage.meal_plan = usageStats
			}

			// Update status to in progress shopping
			status.status = TaskStatusEnum.IN_PROGRESS_SHOPPING
			await this.saveTaskStatus(taskId, status)
			console.log(`Task ${taskId} status updated to: ${status.status}`)

			// Generate shopping list
			console.log(`Task ${taskId}: Starting shopping list generation`)
			const { shoppingList, shoppingListUsage } =
				await this.generateShoppingList(mealPlan)
			console.log(
				`Task ${taskId}: Shopping list generation completed with ${shoppingList.length} items`,
			)

			// Store shopping list usage statistics
			if (status.usage) {
				status.usage.shopping_list = shoppingListUsage
			}

			// Update task with result
			status.status = TaskStatusEnum.COMPLETED
			status.result = {
				days: mealPlan.days,
				shopping_list: shoppingList,
			}
			await this.saveTaskStatus(taskId, status)
			console.log(`Task ${taskId} completed successfully`)
		} catch (error) {
			// Update task with error
			console.error(`Task ${taskId} failed with error:`, error)
			const status = await this.getTaskStatus(taskId)
			status.status = TaskStatusEnum.FAILED
			status.error = error.message
			await this.saveTaskStatus(taskId, status)
		}
	}

	async getTaskStatus(taskId: string): Promise<TaskStatus> {
		try {
			// Convert UUID to bigint for querying
			const numericId = parseInt(
				taskId.replace(/-/g, '').substring(0, 15),
				16,
			)

			// Fetch from Supabase
			const { data, error } = await supabase
				.from('meals_plans')
				.select('*')
				.eq('id', numericId)
				.single()

			if (error) {
				console.error(
					'Error fetching task status from Supabase:',
					error,
				)
				throw new NotFoundException(`Task ${taskId} not found`)
			}

			if (!data) {
				throw new NotFoundException(`Task ${taskId} not found`)
			}

			// Map the data from your table structure to TaskStatus
			const taskStatus: TaskStatus = {
				id: taskId,
				status: data.status || TaskStatusEnum.PENDING,
				created_at: data.created_at,
				error: data.error,
				usage: data.usage,
				result: data.plan,
			}

			return taskStatus
		} catch (error) {
			console.error(`Error getting task status: ${error.message}`)
			throw new NotFoundException(`Task ${taskId} not found`)
		}
	}

	async waitForTaskCompletion(
		taskId: string,
		targetStatus?: TaskStatusEnum,
		timeout: number = 30,
	): Promise<TaskStatus> {
		const endTime = Date.now() + timeout * 1000
		const pollInterval = 1000 // 1 second

		while (Date.now() < endTime) {
			try {
				const status = await this.getTaskStatus(taskId)

				// Check if we've reached target status
				if (targetStatus && status.status === targetStatus) {
					return status
				}

				// Check for terminal states
				if (
					status.status === TaskStatusEnum.COMPLETED ||
					status.status === TaskStatusEnum.FAILED
				) {
					return status
				}

				// Wait before polling again
				await new Promise((resolve) =>
					setTimeout(resolve, pollInterval),
				)
			} catch (error) {
				if (error instanceof NotFoundException) {
					// If task not found, wait and try again
					await new Promise((resolve) =>
						setTimeout(resolve, pollInterval),
					)
				} else {
					throw error
				}
			}
		}

		// If we reach here, we've timed out - return current status
		return this.getTaskStatus(taskId)
	}

	private async saveTaskStatus(
		taskId: string,
		status: TaskStatus,
	): Promise<void> {
		try {
			// Map our TaskStatus to the existing meals_plans table structure
			const mealPlanRecord = {
				id: parseInt(taskId.replace(/-/g, '').substring(0, 15), 16), // Convert UUID to bigint
				status: status.status,
				error: status.error,
				usage: status.usage,
				// Only set plan when the meal plan is completed
				plan:
					status.status === TaskStatusEnum.COMPLETED
						? status.result
						: null,
				created_at: status.created_at,
			}

			// Upsert to Supabase
			const { error } = await supabase
				.from('meals_plans') // Note the table name is 'meals_plans', not 'meal_plans'
				.upsert(mealPlanRecord)
				.select()

			if (error) {
				console.error('Error saving task status to Supabase:', error)
				throw new Error(`Failed to save task status: ${error.message}`)
			}

			console.log(`Task status saved to Supabase for task: ${taskId}`)
		} catch (error) {
			console.error(`Error saving task status: ${error.message}`)
			throw error
		}
	}

	private async generateMealPlan(
		request: MealPlanRequestDto,
	): Promise<{ mealPlan: MealPlan; usageStats: any }> {
		console.log(
			`Generating meal plan for: ${request.diet} diet with ${request.daysCount} days`,
		)
		console.log(`Requested meals: ${request.meals}`)
		if (request.excludedIngredients) {
			console.log(`Excluded ingredients: ${request.excludedIngredients}`)
		}

		const systemMessage = `You are a professional chef and nutritionist. Your task is to generate a detailed meal plan based on the user's requirements.
		The meal plan should follow this format:
		{
			"days": [
				{
					"date": "YYYY-MM-DD",
					"meals": [
						{
							"meal_type": "breakfast" | "dinner" | "lunch" | "snack",
							"recipes": [
								{
									"recipe_type": "collation" | "starter" | "main" | "dessert",
									"recipe": {
										"name": string,
										"ingredients": [
											{
												"label": string,
												"quantity": number,
												"unit": string
											}
										],
										"steps": {
											"1": string,
											"2": string,
											...
										}
									}
								}
							]
						}
					]
				}
			]
		}`

		const userMessage = `Based on the following input, generate a detailed meal plan:

Input JSON:
\`\`\`json
${JSON.stringify(request, null, 2)}
\`\`\`

For each day, provide ONLY ASKED MEALS and respect these rules:
- Lunch and dinner should include three recipes each: a starter, a main course, and a dessert
- Breakfast and snacks should include one recipe each
- All recipes should include a list of ingredients with quantities and units
- All recipes should include step-by-step instructions
- The meal plan should be nutritionally balanced and follow any dietary restrictions specified in the input
- IMPORTANT: Return ONLY the JSON object with the meal plan, do not include any markdown code blocks or additional text.`

		console.log('Sending request to OpenAI for meal plan generation')
		const startTime = Date.now()

		try {
			const response = await this.openai.chat.completions.create({
				model: 'gpt-4.1-nano',
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: userMessage },
				],
				temperature: 0.7,
				max_tokens: 32768,
				response_format: { type: 'json_object' },
			})

			const elapsedTime = (Date.now() - startTime) / 1000
			console.log(
				`Received response from OpenAI in ${elapsedTime.toFixed(
					2,
				)} seconds`,
			)

			// Store usage statistics
			console.log(
				'Meal plan generation usage statistics:',
				response.usage,
			)

			// Store the usage statistics to pass back to the caller
			const usageStats = response.usage
				? {
						prompt_tokens: response.usage.prompt_tokens,
						completion_tokens: response.usage.completion_tokens,
						total_tokens: response.usage.total_tokens,
				  }
				: undefined

			const content = response.choices[0].message.content
			if (!content) {
				throw new Error('Empty response from OpenAI')
			}

			console.log('Parsing meal plan from response')

			// Parse the JSON response
			let mealPlanData
			try {
				mealPlanData = JSON.parse(content)
			} catch (error) {
				console.error('Failed to parse the JSON response:', error)
				throw new Error(
					`Failed to parse meal plan JSON: ${error.message}`,
				)
			}

			// Add dates to meal plan if not already provided
			if (mealPlanData.days) {
				for (let i = 0; i < mealPlanData.days.length; i++) {
					const day = mealPlanData.days[i]
					if (!day.date) {
						const date = new Date()
						date.setDate(date.getDate() + i)
						day.date = date.toISOString().split('T')[0]
					}
				}
			}

			console.log(
				`Successfully parsed meal plan with ${mealPlanData.days.length} days`,
			)
			return { mealPlan: mealPlanData, usageStats }
		} catch (error) {
			console.error('Error generating meal plan:', error)
			throw new Error(`Failed to generate meal plan: ${error.message}`)
		}
	}

	private async generateShoppingList(
		mealPlan: MealPlan,
	): Promise<{ shoppingList: Ingredient[]; shoppingListUsage: any }> {
		console.log('Starting shopping list generation...')

		// Extract all ingredients from the meal plan
		const allIngredients = []
		for (const day of mealPlan.days) {
			for (const meal of day.meals) {
				for (const recipe of meal.recipes) {
					allIngredients.push(...recipe.recipe.ingredients)
				}
			}
		}

		console.log(`Found ${allIngredients.length} ingredients in meal plan`)
		if (allIngredients.length === 0) {
			console.warn('No ingredients found in meal plan')
			return { shoppingList: [], shoppingListUsage: undefined }
		}

		const systemMessage = `You are a professional chef. Your task is to generate a consolidated shopping list from the provided ingredients.
		The shopping list should follow this format:
		{
			"shopping_list": [
				{
					"label": string,
					"quantity": number,
					"unit": string
				}
			]
		}
		
		Rules for the shopping list:
		1. Combine similar ingredients and sum their quantities
		2. Use consistent units (e.g., convert all weights to grams, all volumes to milliliters)
		3. Round quantities to reasonable numbers
		4. Remove any duplicate entries
		5. Sort ingredients alphabetically
		6. IMPORTANT: Return ONLY the JSON object with the shopping_list array, do not include any markdown code blocks or additional text.`

		const userMessage = `Generate a consolidated shopping list from these ingredients:
\`\`\`json
${JSON.stringify(allIngredients)}
\`\`\``

		console.log('Sending request to OpenAI for shopping list generation')
		const startTime = Date.now()

		try {
			const response = await this.openai.chat.completions.create({
				model: 'gpt-4.1-nano',
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: userMessage },
				],
				temperature: 0.7,
				max_tokens: 32768,
				response_format: { type: 'json_object' },
			})

			const elapsedTime = (Date.now() - startTime) / 1000
			console.log(
				`Received response from OpenAI in ${elapsedTime.toFixed(
					2,
				)} seconds`,
			)

			const content = response.choices[0].message.content
			if (!content) {
				throw new Error('Empty response from OpenAI')
			}

			console.log('Parsing shopping list from response')

			// Extract JSON from the response
			let shoppingList
			let shoppingListUsage = response.usage
				? {
						prompt_tokens: response.usage.prompt_tokens,
						completion_tokens: response.usage.completion_tokens,
						total_tokens: response.usage.total_tokens,
				  }
				: undefined
			try {
				// Try direct parsing first
				shoppingList = JSON.parse(content)
				console.log('Successfully parsed JSON response')
			} catch (error) {
				console.error('Failed to parse the JSON response:', error)
				throw new Error(
					`Failed to parse shopping list JSON: ${error.message}`,
				)
			}

			if (Array.isArray(shoppingList)) {
				console.log(
					`Successfully parsed shopping list with ${shoppingList.length} items`,
				)
				return {
					shoppingList: shoppingList,
					shoppingListUsage: shoppingListUsage,
				}
			} else if (
				shoppingList &&
				typeof shoppingList === 'object' &&
				Array.isArray(shoppingList.shopping_list)
			) {
				console.log(
					`Successfully parsed shopping list with ${shoppingList.shopping_list.length} items`,
				)
				return {
					shoppingList: shoppingList.shopping_list,
					shoppingListUsage,
				}
			} else {
				console.warn(
					`Unexpected shopping list format: ${typeof shoppingList}`,
				)
				return { shoppingList: [], shoppingListUsage }
			}
		} catch (error) {
			console.error('Error generating shopping list:', error)
			// Return empty list on failure, don't fail the whole task
			return { shoppingList: [], shoppingListUsage: undefined }
		}
	}
}
