/**
 * Tweet Fetching Functions
 *
 * Fetches user profiles and tweets from TwitterAPI.io
 * Writes to disk incrementally to avoid data loss on crash
 */

import fs from 'fs';
import path from 'path';
import {
  API_BASE_URL,
  API_KEY,
  DELAY_BETWEEN_PAGES_MS,
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from './config.js';

/**
 * Delay helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches user profile information
 *
 * @param {string} username - Twitter username (without @)
 * @returns {object} Trimmed profile data
 */
export async function fetchUserProfile(username) {
  console.log(`[Profile] Fetching profile for @${username}...`);

  const url = new URL(`${API_BASE_URL}/twitter/user/info`);
  url.searchParams.append('userName', username);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch profile for @${username}: ${response.status} - ${errorText}`);
  }

  const response_data = await response.json();

  // API wraps response in a 'data' object
  const data = response_data.data || response_data;

  // Return only the fields we care about
  const profile = {
    userName: data.userName,
    id: data.id,
    name: data.name,
    followers: data.followers,
    following: data.following,
    statusesCount: data.statusesCount,
    createdAt: data.createdAt,
    isBlueVerified: data.isBlueVerified,
    description: data.description,
    // Metadata
    fetchedAt: new Date().toISOString(),
  };

  console.log(`[Profile] @${username}: ${(profile.followers || 0).toLocaleString()} followers, ${(profile.statusesCount || 0).toLocaleString()} tweets`);

  return profile;
}

/**
 * Trims a raw tweet to only the fields we need
 */
function trimTweet(tweet) {
  return {
    // Core identification
    id: tweet.id,
    text: tweet.text,
    url: tweet.url,
    createdAt: tweet.createdAt,

    // All engagement metrics (raw)
    likeCount: tweet.likeCount || 0,
    retweetCount: tweet.retweetCount || 0,
    replyCount: tweet.replyCount || 0,
    quoteCount: tweet.quoteCount || 0,
    viewCount: tweet.viewCount || 0,
    bookmarkCount: tweet.bookmarkCount || 0,

    // Tweet type detection
    isReply: tweet.isReply || false,
    hasQuotedTweet: !!tweet.quoted_tweet,
    hasRetweetedTweet: !!tweet.retweeted_tweet,

    // Quoted tweet info (if exists)
    quotedTweet: tweet.quoted_tweet ? {
      id: tweet.quoted_tweet.id,
      text: tweet.quoted_tweet.text,
      authorUsername: tweet.quoted_tweet.author?.userName,
    } : null,

    // Retweeted tweet info (if exists)
    retweetedTweet: tweet.retweeted_tweet ? {
      id: tweet.retweeted_tweet.id,
      text: tweet.retweeted_tweet.text,
      authorUsername: tweet.retweeted_tweet.author?.userName,
    } : null,

    // Entities we care about
    urls: tweet.entities?.urls?.map(u => ({
      displayUrl: u.display_url,
      expandedUrl: u.expanded_url,
    })) || [],

    mentions: tweet.entities?.user_mentions?.map(m => ({
      username: m.screen_name,
      name: m.name,
    })) || [],
  };
}

/**
 * Fetches ALL tweets for a user using advanced_search (better historical coverage)
 * Writes to file incrementally after each page to prevent data loss
 *
 * @param {string} username - Twitter username (without @)
 * @param {string} outputPath - Path to write tweets.json (writes after each page)
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {array} Array of trimmed tweet objects
 */
export async function fetchAllTweets(username, outputPath, onProgress = null) {
  console.log(`[Tweets] Fetching all tweets for @${username} using advanced_search...`);
  console.log(`[Tweets] Saving incrementally to: ${outputPath}`);

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const allTweets = [];
  let hasNextPage = true;
  let nextCursor = '';
  let pageNum = 0;
  let retryCount = 0;
  let emptyPageStreak = 0;  // Track consecutive empty pages
  const MAX_EMPTY_PAGES = 3; // Stop after 3 consecutive empty pages

  while (hasNextPage) {
    pageNum++;

    try {
      // Build URL using advanced_search with from:username query
      const query = encodeURIComponent(`from:${username}`);
      const url = new URL(`${API_BASE_URL}/twitter/tweet/advanced_search`);
      url.searchParams.append('query', `from:${username}`);
      url.searchParams.append('queryType', 'Latest');
      if (nextCursor) {
        url.searchParams.append('cursor', nextCursor);
      }

      // Fetch page
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const response_data = await response.json();

      // Extract tweets - advanced_search returns tweets at top level
      const pageTweets = response_data.tweets || [];

      // IMPORTANT: Filter to only include tweets actually from this user
      // The advanced_search API does fuzzy matching, so it may return tweets from
      // users with similar names (e.g., "skirano" matches "Skriniar" footballer tweets)
      const userTweets = pageTweets.filter(tweet => {
        // Check if tweet URL belongs to this user (case-insensitive)
        const urlMatch = tweet.url?.match(/x\.com\/([^\/]+)\/status/i);
        if (!urlMatch) return false;
        return urlMatch[1].toLowerCase() === username.toLowerCase();
      });

      const filtered = pageTweets.length - userTweets.length;
      if (filtered > 0) {
        console.log(`[Tweets] Filtered out ${filtered} tweets not from @${username}`);
      }

      const trimmedTweets = userTweets.map(trimTweet);
      allTweets.push(...trimmedTweets);

      // Get pagination info - at top level
      const apiHasNextPage = response_data.has_next_page ?? false;
      const apiNextCursor = response_data.next_cursor ?? '';

      // Debug logging for pagination
      if (pageTweets.length === 0 || !apiHasNextPage) {
        console.log(`[Tweets] DEBUG Page ${pageNum}: tweets=${pageTweets.length}, has_next_page=${apiHasNextPage}, cursor="${apiNextCursor ? apiNextCursor.substring(0, 20) + '...' : 'none'}"`);
      }

      // Track empty pages
      if (pageTweets.length === 0) {
        emptyPageStreak++;
        console.log(`[Tweets] Empty page streak: ${emptyPageStreak}/${MAX_EMPTY_PAGES}`);
      } else {
        emptyPageStreak = 0;
      }

      // Decide whether to continue - be more aggressive about continuing
      // Continue if: API says there's more, OR we have a cursor AND haven't hit max empty pages
      if (apiHasNextPage) {
        hasNextPage = true;
        nextCursor = apiNextCursor;
      } else if (apiNextCursor && emptyPageStreak < MAX_EMPTY_PAGES) {
        // API says no more pages, but we have a cursor - try it anyway
        console.log(`[Tweets] API says no more pages, but cursor exists - continuing...`);
        hasNextPage = true;
        nextCursor = apiNextCursor;
      } else if (emptyPageStreak >= MAX_EMPTY_PAGES) {
        console.log(`[Tweets] Stopping: ${MAX_EMPTY_PAGES} consecutive empty pages`);
        hasNextPage = false;
      } else {
        hasNextPage = false;
        nextCursor = '';
      }

      // Write to file after each page (incremental save)
      const saveData = {
        username,
        totalTweets: allTweets.length,
        lastPage: pageNum,
        hasMorePages: hasNextPage,
        lastCursor: nextCursor ? nextCursor.substring(0, 50) : null,
        emptyPageStreak,
        lastUpdated: new Date().toISOString(),
        tweets: allTweets,
      };
      fs.writeFileSync(outputPath, JSON.stringify(saveData, null, 2));

      // Progress update
      const msg = `[Tweets] @${username}: Page ${pageNum} - ${pageTweets.length} tweets (total: ${allTweets.length}) [saved]`;
      console.log(msg);
      if (onProgress) {
        onProgress({ page: pageNum, pageTweets: pageTweets.length, totalTweets: allTweets.length });
      }

      // Reset retry count on success
      retryCount = 0;

      // Rate limiting delay before next page
      if (hasNextPage) {
        await sleep(DELAY_BETWEEN_PAGES_MS);
      }

    } catch (error) {
      console.error(`[Tweets] Error on page ${pageNum}: ${error.message}`);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`[Tweets] Retrying page ${pageNum} (attempt ${retryCount}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS);
        // Don't increment pageNum, retry same page
        continue;
      }

      // Max retries exceeded - but we still have saved data!
      console.error(`[Tweets] Failed after ${MAX_RETRIES} retries. Stopping pagination.`);
      console.log(`[Tweets] Partial data saved: ${allTweets.length} tweets`);
      hasNextPage = false;
    }
  }

  console.log(`[Tweets] @${username}: Done! Fetched ${allTweets.length} tweets across ${pageNum} pages`);

  return allTweets;
}
