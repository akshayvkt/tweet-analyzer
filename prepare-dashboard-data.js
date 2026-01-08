/**
 * Prepare combined tweet data for dashboard
 */

import fs from 'fs';

const accounts = ['skirano', 'sawyerhood', 'mattshumer_', 'vasuman', 'sharifshameem'];
const allTweets = [];

accounts.forEach(username => {
  const dataPath = `data/${username}/tweets.json`;
  if (!fs.existsSync(dataPath)) return;

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // Only include original tweets (not replies, not RTs)
  const originals = data.tweets.filter(t => !t.isReply && !t.hasRetweetedTweet);

  originals.forEach(t => {
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
      quotes: t.quoteCount || 0
    });
  });
});

// Sort by likes descending
allTweets.sort((a, b) => b.likes - a.likes);

console.log('Total original tweets:', allTweets.length);
fs.writeFileSync('data/all_tweets.json', JSON.stringify(allTweets, null, 2));
console.log('Saved to data/all_tweets.json');
