import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
	port: process.env.PORT || 3000,
	apiUrl: process.env.API_URL || 'http://localhost:8000',
	nodeEnv: process.env.NODE_ENV || 'development',
}

export default config
