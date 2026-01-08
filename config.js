/**
 * Tweet Analyzer Configuration
 */

// API Configuration
export const API_BASE_URL = 'https://api.twitterapi.io';
export const API_KEY = process.env.STONKX_TWITTERAPI_KEY;

// Rate limiting - With 1M+ credits, QPS limit is 10 (can do 10 req/sec)
// Being conservative with 5 req/sec to be safe
export const DELAY_BETWEEN_PAGES_MS = 200;  // 200ms between requests (~5/sec)
export const DELAY_BETWEEN_USERS_MS = 1000;  // 1s between different users
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 10000;  // 10s before retry

// Accounts to analyze (ordered by tweet count, smallest first)
export const ACCOUNTS = [
  'sharifshameem',  // ~2.8k tweets, best F/P ratio (23:1)
  'EXM7777',        // ~4.7k tweets
  'vasuman',        // ~5.4k tweets, 0→34k in 8 months
  'skirano',        // ~8k tweets
  'mattshumer_',    // ~9.6k tweets
  'signulll',       // ~12.5k tweets
];

// Validate API key on import
if (!API_KEY) {
  console.error('ERROR: STONKX_TWITTERAPI_KEY environment variable is not set');
  console.error('Run: export STONKX_TWITTERAPI_KEY="your-api-key"');
  process.exit(1);
}
