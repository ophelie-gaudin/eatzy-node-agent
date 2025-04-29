export interface Ingredient {
	label: string
	quantity: number
	unit: string
}

export interface Recipe {
	name: string
	ingredients: Ingredient[]
	steps: Record<string, string>
}

export interface RecipeItem {
	recipe_type: 'collation' | 'starter' | 'main' | 'dessert'
	recipe: Recipe
}

export interface Meal {
	meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
	recipes: RecipeItem[]
}

export interface Day {
	date: string
	meals: Meal[]
}

export interface MealPlanRequest {
	daysCount: number
	meals: string[]
	diet: string
	excludedIngredients?: string[]
}

export interface MealPlanResponse {
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

export interface TaskResponse {
	task_id: string
	status: TaskStatusEnum
}

export interface TaskStatus {
	id: string
	status: TaskStatusEnum
	created_at: string
	result?: {
		days: Day[]
		shopping_list: Ingredient[]
	}
	error?: string
}
