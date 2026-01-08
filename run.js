#!/usr/bin/env node

/**
 * Tweet Analyzer CLI
 *
 * Usage:
 *   node run.js @sharifshameem          # Fetch + analyze one account
 *   node run.js --all                   # Fetch + analyze all 6 accounts
 *   node run.js @sharifshameem --fetch-only    # Just fetch, no report
 *   node run.js @sharifshameem --report-only   # Just generate report (from existing data)
 */

import fs from 'fs';
import path from 'path';
import { ACCOUNTS, DELAY_BETWEEN_USERS_MS } from './config.js';
import { fetchUserProfile, fetchAllTweets } from './fetch.js';
import { generateReport } from './analyze.js';

const DATA_DIR = './data';

/**
 * Delay helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single user: fetch profile, fetch tweets, generate report
 */
async function processUser(username, options = {}) {
  const { fetchOnly = false, reportOnly = false } = options;

  console.log('\n' + '='.repeat(60));
  console.log(`Processing @${username}`);
  console.log('='.repeat(60));

  const userDir = path.join(DATA_DIR, username);
  const profilePath = path.join(userDir, 'profile.json');
  const tweetsPath = path.join(userDir, 'tweets.json');

  // Ensure user directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Skip fetching if report-only mode
  if (!reportOnly) {
    // Fetch profile
    console.log('\n--- Fetching Profile ---');
    const profile = await fetchUserProfile(username);
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    console.log(`[Profile] Saved to: ${profilePath}`);

    // Fetch all tweets (saves incrementally)
    console.log('\n--- Fetching Tweets ---');
    await fetchAllTweets(username, tweetsPath);
  }

  // Skip report if fetch-only mode
  if (!fetchOnly) {
    console.log('\n--- Generating Report ---');
    await generateReport(username);
  }

  console.log(`\n✓ Done with @${username}`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const fetchOnly = args.includes('--fetch-only');
  const reportOnly = args.includes('--report-only');
  const runAll = args.includes('--all');

  // Remove flags from args to get usernames
  const usernames = args
    .filter(arg => !arg.startsWith('--'))
    .map(arg => arg.replace(/^@/, '')); // Remove @ prefix if present

  // Determine which accounts to process
  let accountsToProcess = [];

  if (runAll) {
    accountsToProcess = ACCOUNTS;
    console.log(`\nProcessing all ${ACCOUNTS.length} accounts...`);
  } else if (usernames.length > 0) {
    accountsToProcess = usernames;
  } else {
    // Show usage
    console.log(`
Tweet Analyzer — Fetch and analyze tweets from successful accounts

Usage:
  node run.js @username              Fetch + analyze one account
  node run.js @user1 @user2          Fetch + analyze multiple accounts
  node run.js --all                  Fetch + analyze all ${ACCOUNTS.length} configured accounts
  node run.js @username --fetch-only Just fetch data, no report
  node run.js @username --report-only Generate report from existing data

Configured accounts:
${ACCOUNTS.map(a => `  - @${a}`).join('\n')}
    `);
    process.exit(0);
  }

  // Track results
  const results = {
    success: [],
    failed: [],
  };

  const startTime = Date.now();

  // Process each account
  for (let i = 0; i < accountsToProcess.length; i++) {
    const username = accountsToProcess[i];

    try {
      await processUser(username, { fetchOnly, reportOnly });
      results.success.push(username);
    } catch (error) {
      console.error(`\n✗ Error processing @${username}: ${error.message}`);
      results.failed.push({ username, error: error.message });
    }

    // Delay between users (except for last one)
    if (i < accountsToProcess.length - 1 && !reportOnly) {
      console.log(`\nWaiting ${DELAY_BETWEEN_USERS_MS / 1000}s before next account...`);
      await sleep(DELAY_BETWEEN_USERS_MS);
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Time elapsed: ${elapsed} minutes`);
  console.log(`Success: ${results.success.length} accounts`);
  results.success.forEach(u => console.log(`  ✓ @${u}`));

  if (results.failed.length > 0) {
    console.log(`Failed: ${results.failed.length} accounts`);
    results.failed.forEach(f => console.log(`  ✗ @${f.username}: ${f.error}`));
  }

  console.log('\nData saved in: ./data/{username}/');
  console.log('Reports saved in: ./reports/{username}.md');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
