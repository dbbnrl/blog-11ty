#!/usr/bin/env bash
ffmpeg -i "$1" -c:v vp9 -b:v 0 -crf 30 -pass 1 -an -f null /dev/null
ffmpeg -i "$1" -map_metadata -1 -c:v vp9 -b:v 0 -crf 30 -pass 2 -c:a libopus "${1%.*}.webm"
