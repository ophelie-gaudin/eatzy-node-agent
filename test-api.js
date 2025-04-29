const http = require('http')

const API_BASE_URL = 'http://localhost:3000'
const MEAL_PLAN_ENDPOINT = '/meal-plan/generate'
const STATUS_ENDPOINT = '/meal-plan/status'
const WAIT_ENDPOINT = '/meal-plan/wait'

async function makeRequest(method, path, data = null) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'localhost',
			port: 3000,
			path,
			method,
			headers: {
				'Content-Type': 'application/json',
			},
		}

		const req = http.request(options, (res) => {
			let responseData = ''

			res.on('data', (chunk) => {
				responseData += chunk
			})

			res.on('end', () => {
				try {
					const parsedData = responseData
						? JSON.parse(responseData)
						: {}
					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						data: parsedData,
					})
				} catch (err) {
					console.error('Error parsing response:', err.message)
					console.error('Raw response:', responseData)
					reject(err)
				}
			})
		})

		req.on('error', (error) => {
			console.error('Request error:', error.message)
			reject(error)
		})

		if (data) {
			req.write(JSON.stringify(data))
		}

		req.end()
	})
}

async function testMealPlanGeneration() {
	console.log('\n=== Testing Meal Plan Generation API ===\n')

	try {
		// Step 1: Start meal plan generation
		console.log('1. Requesting meal plan generation...')
		const mealPlanRequest = {
			daysCount: 2,
			meals: ['breakfast', 'lunch', 'dinner'],
			diet: 'vegetarian',
			excludedIngredients: ['nuts', 'shellfish'],
		}

		const generateResponse = await makeRequest(
			'POST',
			MEAL_PLAN_ENDPOINT,
			mealPlanRequest,
		)

		console.log(`   Status code: ${generateResponse.statusCode}`)

		if (generateResponse.statusCode === 500) {
			console.error('   Server returned Internal Server Error:')
			console.error(JSON.stringify(generateResponse.data, null, 2))
			return
		}

		if (
			generateResponse.statusCode !== 200 &&
			generateResponse.statusCode !== 201
		) {
			console.error(
				`   Unexpected status code: ${generateResponse.statusCode}`,
			)
			console.error(JSON.stringify(generateResponse.data, null, 2))
			return
		}

		const taskId = generateResponse.data.task_id
		console.log(`   Task ID: ${taskId}`)
		console.assert(taskId, 'Expected task_id in response')
		console.assert(
			generateResponse.data.status === 'pending',
			'Expected initial status to be pending',
		)

		// Step 2: Check status
		console.log('\n2. Checking task status...')
		const statusResponse = await makeRequest(
			'GET',
			`${STATUS_ENDPOINT}/${taskId}`,
		)

		console.log(`   Status code: ${statusResponse.statusCode}`)
		if (statusResponse.statusCode !== 200) {
			console.error(
				`   Unexpected status code: ${statusResponse.statusCode}`,
			)
			console.error(JSON.stringify(statusResponse.data, null, 2))
			return
		}

		console.log(`   Task status: ${statusResponse.data.status}`)
		console.assert(
			statusResponse.data.id === taskId,
			'Task ID should match',
		)

		// Step 3: Poll until completion or failure
		console.log('\n3. Polling for task completion...')

		const MAX_POLLING_ATTEMPTS = 30
		const POLLING_INTERVAL = 5000 // 2 seconds
		let attempts = 0
		let taskCompleted = false
		let finalResponse = null

		while (!taskCompleted && attempts < MAX_POLLING_ATTEMPTS) {
			attempts++
			console.log(
				`   Polling attempt ${attempts}/${MAX_POLLING_ATTEMPTS}...`,
			)

			const pollResponse = await makeRequest(
				'GET',
				`${STATUS_ENDPOINT}/${taskId}`,
			)

			if (pollResponse.statusCode !== 200) {
				console.error(
					`   Error checking status: ${pollResponse.statusCode}`,
				)
				console.error(JSON.stringify(pollResponse.data, null, 2))
				return
			}

			console.log(`   Current status: ${pollResponse.data.status}`)

			// Check if task has reached terminal state
			if (
				pollResponse.data.status === 'completed' ||
				pollResponse.data.status === 'failed'
			) {
				taskCompleted = true
				finalResponse = pollResponse
				console.log(
					`   Task reached terminal state: ${pollResponse.data.status}`,
				)
			} else {
				// Wait before next poll
				console.log(
					`   Waiting ${
						POLLING_INTERVAL / 1000
					} seconds before next poll...`,
				)
				await new Promise((resolve) =>
					setTimeout(resolve, POLLING_INTERVAL),
				)
			}
		}

		if (!taskCompleted) {
			console.log(
				`   Reached maximum polling attempts (${MAX_POLLING_ATTEMPTS})`,
			)
			console.log('   Trying the wait endpoint as final attempt...')

			// Try the wait endpoint for one last check
			finalResponse = await makeRequest(
				'GET',
				`${WAIT_ENDPOINT}/${taskId}?timeout=5`,
			)
		}

		// Process the final task state
		if (!finalResponse) {
			console.error('   No response received during polling')
			return
		}

		console.log(`   Final status: ${finalResponse.data.status}`)

		if (finalResponse.data.status === 'completed') {
			console.log('   Meal plan generation completed successfully!')
			console.log(
				`   Generated ${finalResponse.data.result.days.length} days of meals`,
			)

			// Print first day as example
			const firstDay = finalResponse.data.result.days[0]
			console.log('\n=== Sample Day ===')
			console.log(`Date: ${firstDay.date}`)
			console.log(`Meals: ${firstDay.meals.length}`)

			console.log('\n=== Shopping List ===')
			console.log(
				`Items: ${finalResponse.data.result.shopping_list.length}`,
			)
		} else if (finalResponse.data.status === 'failed') {
			console.error('   Task failed!')
			if (finalResponse.data.error) {
				console.error(`   Error: ${finalResponse.data.error}`)
			}
		} else {
			console.log(
				`   Task did not complete: ${finalResponse.data.status}`,
			)
		}

		console.log('\n=== Test completed ===')
	} catch (error) {
		console.error('\nTest failed with error:', error.message)
		if (error.stack) console.error(error.stack)
	}
}

// Check if server is reachable before starting test
async function checkServerAndRunTest() {
	try {
		console.log('Checking if API server is running...')
		const rootResponse = await makeRequest('GET', '/')

		// Even if it's a 404, the server is running
		if (rootResponse.statusCode === 404) {
			console.log('API server is running. Starting test...')
			await testMealPlanGeneration()
		} else {
			console.log(
				`API server returned unexpected status: ${rootResponse.statusCode}`,
			)
		}
	} catch (error) {
		console.error('Failed to connect to API server:', error.message)
		console.error(
			'Please make sure the API server is running at http://localhost:3000',
		)
		process.exit(1)
	}
}

checkServerAndRunTest()
