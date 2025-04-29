import {
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	Min,
} from 'class-validator'
import { Transform } from 'class-transformer'

enum DietType {
	STANDARD = 'standard',
	VEGETARIAN = 'vegetarian',
	VEGAN = 'vegan',
	KETO = 'keto',
	PALEO = 'paleo',
	GLUTEN_FREE = 'gluten-free',
	DAIRY_FREE = 'dairy-free',
}

enum MealType {
	BREAKFAST = 'breakfast',
	LUNCH = 'lunch',
	DINNER = 'dinner',
	SNACK = 'snack',
}

export class MealPlanRequestDto {
	@IsInt()
	@IsPositive()
	@Min(1)
	daysCount: number

	@IsArray()
	@IsEnum(MealType, { each: true })
	meals: MealType[]

	@IsString()
	@IsEnum(DietType)
	diet: DietType

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@Transform(({ value }) =>
		Array.isArray(value) ? value : value ? [value] : [],
	)
	excludedIngredients?: string[]
}
