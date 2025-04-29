import { Module } from '@nestjs/common'
import { MealPlanModule } from './meal-plan/meal-plan.module'

@Module({
	imports: [MealPlanModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
