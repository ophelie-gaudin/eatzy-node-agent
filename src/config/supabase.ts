import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.warn(
		'⚠️ Supabase URL or Anon Key not found in environment variables',
	)
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
	auth: {
		persistSession: false,
	},
})
