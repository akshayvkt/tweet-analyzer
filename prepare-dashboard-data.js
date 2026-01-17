/**
 * Prepare combined tweet data for dashboard
 */

import fs from 'fs';

const accounts = ['skirano', 'sawyerhood', 'mattshumer_', 'vasuman', 'sharifshameem', 'EXM7777', 'zarazhangrui'];
const allTweets = [];

/**
 * Determine tweet type based on flags
 */
function getTweetType(tweet) {
  if (tweet.hasRetweetedTweet) return 'retweet';
  if (tweet.isReply) return 'reply';
  if (tweet.hasQuotedTweet) return 'quote';
  return 'original';
}

accounts.forEach(username => {
  const dataPath = `data/${username}/tweets.json`;
  if (!fs.existsSync(dataPath)) return;

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // Include all tweets with type field
  data.tweets.forEach(t => {
    const type = getTweetType(t);

    allTweets.push({
      author: username,
      text: t.text,
      url: t.url,
      date: t.createdAt,
      likes: t.likeCount || 0,
      rts: t.retweetCount || 0,
      views: t.viewCount || 0,
      saves: t.bookmarkCount || 0,
      replies: t.replyCount || 0,
      quotes: t.quoteCount || 0,
      type: type,
      // For replies, extract who they're replying to from mentions
      replyTo: t.isReply && t.mentions?.length > 0 ? t.mentions[0].username : null,
      // For quote tweets, include quoted tweet info
      quotedText: t.quotedTweet?.text || null,
      quotedAuthor: t.quotedTweet?.authorUsername || null
    });
  });
});

// Sort by likes descending
allTweets.sort((a, b) => b.likes - a.likes);

// Count by type
const typeCounts = allTweets.reduce((acc, t) => {
  acc[t.type] = (acc[t.type] || 0) + 1;
  return acc;
}, {});

console.log('Total tweets:', allTweets.length);
console.log('By type:', typeCounts);
fs.writeFileSync('data/all_tweets.json', JSON.stringify(allTweets, null, 2));
console.log('Saved to data/all_tweets.json');
