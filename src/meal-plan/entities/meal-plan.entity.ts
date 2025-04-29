export class Ingredient {
	label: string
	quantity: number
	unit: string
}

export class Recipe {
	name: string
	ingredients: Ingredient[]
	steps: Record<string, string>
}

export class RecipeItem {
	recipe_type: 'collation' | 'starter' | 'main' | 'dessert'
	recipe: Recipe
}

export class Meal {
	meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
	recipes: RecipeItem[]
}

export class Day {
	date: string
	meals: Meal[]
}

export class MealPlan {
	days: Day[]
	shopping_list: Ingredient[]
}

export enum TaskStatusEnum {
	PENDING = 'pending',
	IN_PROGRESS_PLAN = 'in_progress_plan',
	IN_PROGRESS_SHOPPING = 'in_progress_shopping',
	COMPLETED = 'completed',
	FAILED = 'failed',
}

export class TaskResponse {
	task_id: string
	status: TaskStatusEnum
}

export class TaskStatus {
	id: string
	status: TaskStatusEnum
	created_at: string
	result?: {
		days: Day[]
		shopping_list: Ingredient[]
	}
	error?: string
	usage?: {
		meal_plan?: {
			prompt_tokens: number
			completion_tokens: number
			total_tokens: number
		}
		shopping_list?: {
			prompt_tokens: number
			completion_tokens: number
			total_tokens: number
		}
	}
}
