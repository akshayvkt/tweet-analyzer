/**
 * Generate top 20 tweets file for all accounts
 */

import fs from 'fs';

const accounts = ['skirano', 'sawyerhood', 'mattshumer_', 'vasuman', 'sharifshameem'];
let output = '# Top 20 Tweets by Account\n\n';
output += `Generated: ${new Date().toISOString().split('T')[0]}\n\n`;

accounts.forEach(username => {
  const dataPath = `data/${username}/tweets.json`;
  if (!fs.existsSync(dataPath)) {
    output += `## @${username}\n\nNo data found.\n\n`;
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // Filter to original tweets only (not replies, not RTs)
  const originals = data.tweets.filter(t =>
    !t.isReply && !t.hasRetweetedTweet
  );

  // Sort by likes descending
  const top20 = originals
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 20);

  output += '---\n\n';
  output += `## @${username}\n\n`;
  output += `Total tweets: ${data.tweets.length} | Originals: ${originals.length}\n\n`;

  top20.forEach((t, i) => {
    const likes = (t.likeCount || 0).toLocaleString();
    const rts = (t.retweetCount || 0).toLocaleString();
    const views = (t.viewCount || 0).toLocaleString();
    const saves = (t.bookmarkCount || 0).toLocaleString();

    output += `### #${i + 1} — ${likes} likes | ${rts} RTs | ${views} views | ${saves} saves\n\n`;
    output += `> ${t.text.replace(/\n/g, '\n> ')}\n\n`;
    output += `URL: ${t.url}\n`;
    output += `Posted: ${t.createdAt}\n\n`;
  });
});

fs.writeFileSync('reports/top20_all_accounts.md', output);
console.log('Created: reports/top20_all_accounts.md');
console.log('File size:', (fs.statSync('reports/top20_all_accounts.md').size / 1024).toFixed(1) + ' KB');
