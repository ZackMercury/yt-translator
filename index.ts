#!/usr/bin/env ts-node

import axios from "axios";
import ytdl from "ytdl-core";
import fs from "fs";
import ffmpeg from 'fluent-ffmpeg';
import Configstore from "configstore";
import readline from "readline";
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

console.log("You must ensure you have ffmpeg installed on your system.");
console.log("In case you don't, you can get it here: https://ffmpeg.org/download.html");

const config = new Configstore("yt-translator", {});

const videoURL = process.argv[2];
let apiKey = config.get('apiKey');

const downloadYoutubeVideoAsync = (
  videoURL: string,
  params: ytdl.downloadOptions,
  output: string
) => new Promise<Buffer>((resolve, reject) => {
  ytdl(videoURL, params)
    .on("progress", (size, downloaded, total) => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Downloading ${Math.round(downloaded / total * 100)}%`);
      
      if (downloaded === total) {
        // stream has ended
        
        const file = fs.readFileSync("./temp.mp3");
        resolve(file);
        process.stdout.write('\n');
      }
    })
    .on("error", reject)
    .on("close", reject)
    .pipe(fs.createWriteStream(output));
});

const hardcodeSubtitlesToVideo = (
  pathToVideo: string,
  subtitles: string,
  output: string,
) => new Promise ((resolve, reject) => {
  const subtitlePath = "./subtitles.srt";

  fs.writeFileSync(subtitlePath, subtitles);

  const video = ffmpeg(pathToVideo)
    .videoCodec('libx264')
    .audioCodec('libmp3lame')
    .outputOptions(
        `-vf subtitles=${subtitlePath}`
    )
    .on('error', function(err) {
        reject(err);
    })
    .save(output)
    .on('end', function() {
      fs.rmSync(subtitlePath);
      resolve(null);
    })
});


const translateYouTubeVideo = async (videoURL: string) => {

  const videoInfo = await ytdl.getInfo(videoURL);
  console.log(`You are trying to translate "${videoInfo.videoDetails.title}"`);

  const pathToAudio = "./temp.mp3";

  const file = await downloadYoutubeVideoAsync(videoURL, {
    quality: "highestaudio",
    filter: "audioonly",
  }, pathToAudio);

  const formData = new FormData()
  formData.append('file', new File([file], "temp.mp3"));
  formData.append('model', "whisper-1");
  formData.append("response_format", "srt");

  try {
    const translation = await axios.post("https://api.openai.com/v1/audio/translations", formData, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": 'multipart/form-data',
      }
    });

    // download video
    const pathToVideo = './video.mp4';

    await downloadYoutubeVideoAsync(videoURL, {
      quality: "highest",
      filter: "audioandvideo"
    }, pathToVideo);

    await hardcodeSubtitlesToVideo(pathToVideo, translation.data, "./subtitledVideo.mp4");

    fs.rmSync(pathToAudio);
    fs.rmSync(pathToVideo);

  } catch (e) {
    let errorMessage = "OpenAI's translation server is unavailable";

    if (e instanceof Error) {
      errorMessage = e.message;
    }

    console.log(errorMessage);
  }

}

if (!apiKey) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('OpenAI API key hasn\'t been found in the config. \nPlease, paste it below with Ctrl+Shift+V and press Enter:\n', (answer) => {
    apiKey = answer;
    config.set('apiKey', answer);
    
    console.log('The key has been saved: ', answer);

    translateYouTubeVideo(videoURL);
    rl.close();
  });
} else {
  translateYouTubeVideo(videoURL);
}