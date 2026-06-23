const list = [
  '/audio_uploads/Awkward%20Moment%20Anime%20Sound%20Sound%20Effect%20for%20editing.mp3',
  '/audio_uploads/Awkward%20Pause%20(Anime%20Sounds)%20-%20Sound%20Effects%20for%20editing.mp3',
  '/audio_uploads/Morning%20Flower%20-%20Samsung%202013%20Alarm.mp3',
  '/audio_uploads/Oh%20You%20Touch%20My%20Tralala%20(Meme%20Music)%20-%20Sound%20Effect%20for%20editing.mp3',
  '/audio_uploads/Risada%20do%20pelud%C3%A3o%E2%A7%B8atumalaca.mp3',
  '/audio_uploads/Super%20Mario%20Bros.%20-%20Mushroom%20Sound%20Effect%20cut.mp3',
  '/audio_uploads/Suspense%20Sound%20Effect%20-%20(Free%20Meme%20Sound).mp3',
  '/audio_uploads/Titan%20Staring%20With%20Silent%20Hill%20Music%20%5BEXTENDED%20VERSION%5D.mp3',
  "/audio_uploads/Zelda%20Majora's%20mask%20-%20Clock%20tower%20bell%20sound.mp3",
  '/audio_uploads/audio-1780756024137-51340171.mp3',
  '/audio_uploads/fart-meme-sound.mp3',
  '/audio_uploads/frog-laughing-meme.mp3',
  '/audio_uploads/metal%20pipe%20falling%20sound%20effect.mp3'
];
for(const url of list) {
  try {
    new URL(url, "http://localhost:3000");
  } catch(e) {
    console.error("Failed:", url);
  }
}
console.log("Done");
