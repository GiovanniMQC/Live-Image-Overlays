const { execSync } = require('child_process');

async function main() {
  try {
    // 1. Get the current audio list from the server
    const response = await fetch('http://localhost:3000/api/audio-list');
    if (!response.ok) {
        console.error("Server not responding at port 3000");
        return;
    }
    const currentList = await response.json();
    
    // 2. Read git history to build a map of URL -> { name, icon, trimStart, trimEnd, pinned }
    const gitLog = execSync('git log --format="%H" audio_db.json').toString().trim().split('\n');
    let oldDbMap = new Map();
    
    // Go backwards (oldest to newest) to get the latest metadata
    for (let i = gitLog.length - 1; i >= 0; i--) {
      const commit = gitLog[i];
      try {
        const fileContent = execSync(`git show ${commit}:audio_db.json`).toString();
        const oldDb = JSON.parse(fileContent);
        for (const item of oldDb) {
          let normUrl = item.url.replace(/%20/g, ' ').replace(/\s+/g, ' ');
          oldDbMap.set(normUrl, {
            name: item.name,
            icon: item.icon,
            trimStart: item.trimStart,
            trimEnd: item.trimEnd,
            pinned: item.pinned
          });
        }
      } catch(e) {}
    }
    
    // 3. Update the server for each item that has custom metadata
    let updatedCount = 0;
    for (const item of currentList) {
      let normUrl = item.url.replace(/%20/g, ' ').replace(/\s+/g, ' ');
      if (oldDbMap.has(normUrl)) {
        const oldItem = oldDbMap.get(normUrl);
        // Compare to see if we need an update
        if (oldItem.icon !== '🎵' || oldItem.name !== item.name) {
          const updateData = {
            name: oldItem.name,
            icon: oldItem.icon,
          };
          if (oldItem.trimStart !== undefined) updateData.trimStart = oldItem.trimStart;
          if (oldItem.trimEnd !== undefined) updateData.trimEnd = oldItem.trimEnd;
          if (oldItem.pinned !== undefined) updateData.pinned = oldItem.pinned;
          
          console.log(`Updating ${item.id} (${item.url}) ->`, updateData);
          
          await fetch(`http://localhost:3000/api/audio-update/${item.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          
          updatedCount++;
        }
      }
    }
    console.log(`Successfully sent ${updatedCount} updates to the server.`);
  } catch(e) {
    console.error(e);
  }
}
main();
