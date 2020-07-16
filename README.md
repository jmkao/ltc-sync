# ltc-sync
Automate stream audio/video sync delay detection using LTC timecode audio and OCR. This is an automated replacement for A/V sync videos like the Twitch bouncing ball.

## Usage

1. The broadcaster measuring A/V sync should download **LTC-30fps.mp4** onto a portable/moveable device capable of playing back video.
1. Plug the audio output of the device into the input audio path being tested.
1. Begin Broadcasting
1. Begin playing the movie
1. Position the display of the device so that it fills the frame of the camera being tested
1. Maintain this position to get 5-20 seconds of clear video and audio
1. Extract a segment of the broadcast recording that contains only the test video and audio
1. Analyze the video using `node app.js -i <video filename>`

5 samples are taken by default, and can be controlled with the `-n <num_samples>` argument.

## Theory of Operation

While the inclusion of timecode metadata in input sources is commonplace in professional A/V productions, timecode is uncommonly produced or consumed in common live stream broadcast chains, such as UVC video combined with separate audio interfaces broadcast using OBS to Twitch or YouTube.

**LTC-30fps.mp4** contains SMTPE visual timecode and LTC audio timecode at 30 fps / no drop frame that are synchronized together.

Playing back the video through the A/V broadcasting chain and recording the output at the client side results in a video that represents the client experience and A/V sync.

This program will read in that client-side recording, decode the LTC audio time code, sample the video, and run OCR on sample frames associated with specific known points in the LTC audio time code. It will then compute the difference between the LTC time code and the visual time code at a particular location and recommend a delay amount intended to be inputted with the convention used by the OBS Advanced Audio Properties to the audio channel.

## Dependencies

* An executable **ffmpeg** binary must be in the path of the shell used to run this program
* An executable **ltcdump** binary (from [ltc-tools](https://github.com/x42/ltc-tools)) must be in the path of the shell used to run this program
* NodeJS library dependencies (which are all pure JavaScript) listed in `package.json` must be installed using `npm install` prior to running `app.js`
