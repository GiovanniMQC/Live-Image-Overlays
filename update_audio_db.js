const fs = require('fs');

// We have the current audio_db.json
const currentDbPath = './audio_db.json';
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

// We can get the old db from git log! Let's get it by running git log and parsing the content at a specific commit.
const { execSync } = require('child_process');

try {
  // We know that commit 7a545fe8da803b51bad232a59915637e014e0f6b had the trims and names.
  // And c71541a40aca8cb2b2b6155183ef6e8dfeae5074 had "Ahh Echo" and removed chicocarvalho/ze.
  // Actually, we can just get the version from the last commit before they lost it. Let's see the git history.
  const gitLog = execSync('git log --format="%H" audio_db.json').toString().trim().split('\n');
  
  let oldDbMap = new Map();
  
  // Go through recent commits to build a map of URL -> { name, icon, trimStart, trimEnd }
  // We go backwards (oldest to newest) to get the latest metadata for each URL.
  for (let i = gitLog.length - 1; i >= 0; i--) {
    const commit = gitLog[i];
    try {
      const fileContent = execSync(`git show ${commit}:audio_db.json`).toString();
      const oldDb = JSON.parse(fileContent);
      for (const item of oldDb) {
        // Normalize URL because space encoding might differ
        let normUrl = item.url.replace(/%20/g, ' ').replace(/\s+/g, ' ');
        oldDbMap.set(normUrl, {
          name: item.name,
          icon: item.icon,
          trimStart: item.trimStart,
          trimEnd: item.trimEnd,
          pinned: item.pinned
        });
      }
    } catch(e) {
      // Ignored if file was bad JSON or something
    }
  }

  // Now apply to current DB
  let updatedCount = 0;
  for (const item of currentDb) {
    let normUrl = item.url.replace(/%20/g, ' ').replace(/\s+/g, ' ');
    if (oldDbMap.has(normUrl)) {
      const oldItem = oldDbMap.get(normUrl);
      
      // Don't overwrite if it's already an edited one? Wait, current db has default "🎵" icons!
      // So we should just restore.
      if (oldItem.icon !== '🎵' || oldItem.name !== item.name) {
        item.name = oldItem.name;
        item.icon = oldItem.icon;
        if (oldItem.trimStart !== undefined) item.trimStart = oldItem.trimStart;
        if (oldItem.trimEnd !== undefined) item.trimEnd = oldItem.trimEnd;
        if (oldItem.pinned !== undefined) item.pinned = oldItem.pinned;
        updatedCount++;
      }
    }
  }

  fs.writeFileSync(currentDbPath, JSON.stringify(currentDb, null, 2) + '\n');
  console.log(`Updated ${updatedCount} items in audio_db.json successfully!`);
} catch (e) {
  console.error(e);
}
