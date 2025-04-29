import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
} from '@nestjs/common'
import { MealPlanService } from './meal-plan.service'
import { MealPlanRequestDto } from './dto/meal-plan-request.dto'
import {
	TaskResponse,
	TaskStatus,
	TaskStatusEnum,
} from './entities/meal-plan.entity'

// Create a token for the service
export const MEAL_PLAN_SERVICE = 'MEAL_PLAN_SERVICE'

@Controller('meal-plan')
export class MealPlanController {
	constructor(
		@Inject(MEAL_PLAN_SERVICE)
		private readonly mealPlanService: MealPlanService,
	) {
		console.log('MealPlanController constructor called')
		console.log('mealPlanService:', this.mealPlanService)
	}

	@Post('generate')
	async startMealPlanGeneration(
		@Body() mealPlanRequest: MealPlanRequestDto,
	): Promise<TaskResponse> {
		console.log('startMealPlanGeneration called with:', mealPlanRequest)
		console.log('mealPlanService available:', !!this.mealPlanService)

		if (!this.mealPlanService) {
			throw new Error('MealPlanService is not available')
		}

		return this.mealPlanService.startMealPlanGeneration(mealPlanRequest)
	}

	@Get('status/:taskId')
	async getMealPlanStatus(
		@Param('taskId') taskId: string,
	): Promise<TaskStatus> {
		return this.mealPlanService.getTaskStatus(taskId)
	}

	@Get('wait/:taskId')
	async waitForMealPlan(
		@Param('taskId') taskId: string,
		@Query('targetStatus') targetStatus?: TaskStatusEnum,
		@Query('timeout') timeout: number = 30,
	): Promise<TaskStatus> {
		return this.mealPlanService.waitForTaskCompletion(
			taskId,
			targetStatus,
			timeout,
		)
	}
}
