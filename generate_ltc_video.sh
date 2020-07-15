#!/bin/bash


ffmpeg -f lavfi -i color=size=1280x720:duration=300:rate=30:color=white\
 -i LTC_00_58_00_00__5mins_30.wav\
 -vf drawtext="fontfile=Inconsolata-Bold.ttf: fontsize=200: fontcolor=black: x=(w-text_w)/2: y=((h-text_h)/2): timecode='00\:58\:00\:00': rate=30"\
 -c:a libfdk_aac -b:a 320k -c:v h264_nvenc -rc-lookahead 0\
 LTC-30fps.mp4