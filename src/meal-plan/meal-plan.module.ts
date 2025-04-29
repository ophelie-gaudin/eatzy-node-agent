import { Module } from '@nestjs/common'
import { MealPlanController, MEAL_PLAN_SERVICE } from './meal-plan.controller'
import { MealPlanService } from './meal-plan.service'

@Module({
	controllers: [MealPlanController],
	providers: [
		{
			provide: MEAL_PLAN_SERVICE,
			useClass: MealPlanService,
		},
	],
	exports: [MEAL_PLAN_SERVICE],
})
export class MealPlanModule {}
