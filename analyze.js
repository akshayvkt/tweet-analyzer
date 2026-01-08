/**
 * Tweet Analysis & Report Generation
 *
 * Reads fetched data and generates markdown reports
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const REPORTS_DIR = './reports';

/**
 * Formats a number with K/M suffix
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Formats a date string to readable format
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculates aggregate stats from tweets
 */
function calculateStats(tweets) {
  if (tweets.length === 0) {
    return null;
  }

  // Filter to original tweets only (no RTs, no replies)
  const originalTweets = tweets.filter(t => !t.hasRetweetedTweet && !t.isReply);

  const sum = (arr, key) => arr.reduce((s, t) => s + (t[key] || 0), 0);
  const avg = (arr, key) => arr.length > 0 ? sum(arr, key) / arr.length : 0;

  // Date range
  const dates = tweets.map(t => new Date(t.createdAt)).sort((a, b) => a - b);
  const oldestDate = dates[0];
  const newestDate = dates[dates.length - 1];

  return {
    totalTweets: tweets.length,
    originalTweets: originalTweets.length,
    retweets: tweets.filter(t => t.hasRetweetedTweet).length,
    replies: tweets.filter(t => t.isReply).length,
    quoteTweets: tweets.filter(t => t.hasQuotedTweet && !t.hasRetweetedTweet).length,

    dateRange: {
      oldest: oldestDate,
      newest: newestDate,
      daysCovered: Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24)),
    },

    // Averages (on original tweets only)
    avgLikes: Math.round(avg(originalTweets, 'likeCount')),
    avgRetweets: Math.round(avg(originalTweets, 'retweetCount')),
    avgReplies: Math.round(avg(originalTweets, 'replyCount')),
    avgQuotes: Math.round(avg(originalTweets, 'quoteCount')),
    avgViews: Math.round(avg(originalTweets, 'viewCount')),
    avgBookmarks: Math.round(avg(originalTweets, 'bookmarkCount')),

    // Totals
    totalLikes: sum(originalTweets, 'likeCount'),
    totalViews: sum(originalTweets, 'viewCount'),

    // Tweets with links
    tweetsWithLinks: originalTweets.filter(t => t.urls && t.urls.length > 0).length,
    tweetsWithMentions: originalTweets.filter(t => t.mentions && t.mentions.length > 0).length,
  };
}

/**
 * Gets top N tweets by a specific metric
 */
function getTopTweets(tweets, metric, n = 50) {
  // Filter to original tweets only
  const originalTweets = tweets.filter(t => !t.hasRetweetedTweet && !t.isReply);

  return originalTweets
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, n);
}

/**
 * Formats a single tweet for the report
 */
function formatTweetForReport(tweet, rank) {
  const metrics = [
    `${formatNumber(tweet.likeCount)} likes`,
    `${formatNumber(tweet.retweetCount)} RTs`,
    `${formatNumber(tweet.viewCount)} views`,
    `${formatNumber(tweet.bookmarkCount)} saves`,
  ].join(' | ');

  // Clean up tweet text (escape markdown, truncate if very long)
  let text = tweet.text
    .replace(/\n/g, '\n> ')  // Keep newlines in blockquote
    .trim();

  // Add quoted tweet context if exists
  let quotedContext = '';
  if (tweet.hasQuotedTweet && tweet.quotedTweet) {
    quotedContext = `\n> *Quoting @${tweet.quotedTweet.authorUsername}*`;
  }

  return `### #${rank} — ${metrics}
> ${text}${quotedContext}

**URL:** ${tweet.url}
**Posted:** ${formatDate(tweet.createdAt)}
${tweet.urls?.length > 0 ? `**Links:** ${tweet.urls.map(u => u.expandedUrl).join(', ')}` : ''}
${tweet.mentions?.length > 0 ? `**Mentions:** ${tweet.mentions.map(m => '@' + m.username).join(', ')}` : ''}

---
`;
}

/**
 * Generates a markdown report for a user
 */
export async function generateReport(username) {
  console.log(`[Report] Generating report for @${username}...`);

  // Read data files
  const profilePath = path.join(DATA_DIR, username, 'profile.json');
  const tweetsPath = path.join(DATA_DIR, username, 'tweets.json');

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile not found: ${profilePath}`);
  }
  if (!fs.existsSync(tweetsPath)) {
    throw new Error(`Tweets not found: ${tweetsPath}`);
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  const tweetsData = JSON.parse(fs.readFileSync(tweetsPath, 'utf-8'));
  const tweets = tweetsData.tweets;

  // Calculate stats
  const stats = calculateStats(tweets);

  // Get top tweets by likes
  const topByLikes = getTopTweets(tweets, 'likeCount', 50);

  // Get top tweets by bookmarks (often indicates "save for later" value)
  const topByBookmarks = getTopTweets(tweets, 'bookmarkCount', 20);

  // Get top tweets by views
  const topByViews = getTopTweets(tweets, 'viewCount', 20);

  // Build the report
  const report = `# @${username} Tweet Analysis

*Generated: ${new Date().toISOString()}*

---

## Profile

| Metric | Value |
|--------|-------|
| Followers | ${formatNumber(profile.followers)} |
| Following | ${formatNumber(profile.following)} |
| Total Tweets | ${formatNumber(profile.statusesCount)} |
| Account Created | ${formatDate(profile.createdAt)} |
| Blue Verified | ${profile.isBlueVerified ? 'Yes' : 'No'} |

**Bio:** ${profile.description || 'N/A'}

---

## Stats (from ${formatNumber(stats.totalTweets)} fetched tweets)

| Metric | Value |
|--------|-------|
| Original Tweets | ${formatNumber(stats.originalTweets)} |
| Retweets | ${formatNumber(stats.retweets)} |
| Quote Tweets | ${formatNumber(stats.quoteTweets)} |
| Replies | ${formatNumber(stats.replies)} |
| Date Range | ${formatDate(stats.dateRange.oldest)} → ${formatDate(stats.dateRange.newest)} (${stats.dateRange.daysCovered} days) |

### Engagement Averages (Original Tweets Only)

| Metric | Average |
|--------|---------|
| Likes | ${formatNumber(stats.avgLikes)} |
| Retweets | ${formatNumber(stats.avgRetweets)} |
| Replies | ${formatNumber(stats.avgReplies)} |
| Quotes | ${formatNumber(stats.avgQuotes)} |
| Views | ${formatNumber(stats.avgViews)} |
| Bookmarks | ${formatNumber(stats.avgBookmarks)} |

### Content Patterns

| Pattern | Count | % of Original |
|---------|-------|---------------|
| Tweets with Links | ${stats.tweetsWithLinks} | ${Math.round(stats.tweetsWithLinks / stats.originalTweets * 100)}% |
| Tweets with Mentions | ${stats.tweetsWithMentions} | ${Math.round(stats.tweetsWithMentions / stats.originalTweets * 100)}% |

---

## Top 50 Tweets by Likes

${topByLikes.map((t, i) => formatTweetForReport(t, i + 1)).join('\n')}

---

## Top 20 Tweets by Bookmarks (High-Value Content)

${topByBookmarks.map((t, i) => formatTweetForReport(t, i + 1)).join('\n')}

---

## Top 20 Tweets by Views (Viral Reach)

${topByViews.map((t, i) => formatTweetForReport(t, i + 1)).join('\n')}
`;

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Write report
  const reportPath = path.join(REPORTS_DIR, `${username}.md`);
  fs.writeFileSync(reportPath, report);

  console.log(`[Report] Saved to: ${reportPath}`);
  console.log(`[Report] Stats: ${stats.originalTweets} original tweets, avg ${formatNumber(stats.avgLikes)} likes`);

  return { reportPath, stats };
}
