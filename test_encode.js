const fs = require('fs');
const files = fs.readdirSync('public/audio_uploads');
const audioFiles = files.filter(f => f.match(/\.(mp3|wav|ogg|aac|m4a)$/i));
const fileUrls = audioFiles.map(f => '/audio_uploads/' + encodeURIComponent(f));
console.log(fileUrls);
