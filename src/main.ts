import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { config } from './config/env'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	// Enable CORS
	app.enableCors()

	// Set up global validation pipe
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: true,
		}),
	)

	// Start the server
	await app.listen(config.port)
	console.log(`Application is running on: http://localhost:${config.port}`)
}

bootstrap()
