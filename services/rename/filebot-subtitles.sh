#!/bin/bash

# Comma separated paths to fetch subtitles for
INPUT_PATHS=$1
LOG_PATH=$2

# Store inside filebot directory in prefs.properties the username / password for OpenSubtitles - 200 subs a day by default
FB_EXEC=filebot
LOG_LOCATION=$LOG_PATH/filebot-subs-$$.log
SUBS_LANG="es-spa","en-eng"
IFS=","

IFS=',' read -ra INPUT_ARRAY <<< "$INPUT_PATHS"
COUNT=${#INPUT_ARRAY[@]}

TMPDIR=/tmp/$RANDOM
mkdir $TMPDIR

for ((i = 0; i < ${#INPUT_ARRAY[@]}; i++))
do
  INPUT_PATH="${INPUT_ARRAY[$i]}"
  for LNG in $SUBS_LANG
  do
    echo "Fetching subtitles for language $LNG"
    TWO_CODE_LANG=$( echo "$LNG" | awk -F '-' '{print $1}')
    THREE_CODE_LANG=$( echo "$LNG" | awk -F '-' '{print $2}')

    FETCH_SUBS_CMD="$FB_EXEC -get-subtitles \"$INPUT_PATH\" --lang $TWO_CODE_LANG --output srt --encoding utf8 -non-strict --log-file \"$LOG_LOCATION\""

    echo "Command executed:" >> $LOG_LOCATION
    echo "$FETCH_SUBS_CMD" >> $LOG_LOCATION
    eval $FETCH_SUBS_CMD

    # 3-letter language code to 2-letter language code copy
    COPY_IN_CMD="cp \"$INPUT_PATH\"/*.$THREE_CODE_LANG.srt $TMPDIR"
    COPY_BACK_CMD="cp $TMPDIR/*.$TWO_CODE_LANG.srt \"$INPUT_PATH\""
    RM_COPIED_CMD="rm $TMPDIR/*.srt"

    echo "Executing $COPY_IN_CMD"
    eval $COPY_IN_CMD

    RENAME_CMD="rename 's/\.$THREE_CODE_LANG\.srt/\.$TWO_CODE_LANG.srt/' $TMPDIR/*.$THREE_CODE_LANG.srt"
    echo "Executing $RENAME_CMD"
    eval $RENAME_CMD

    echo "Executing $COPY_BACK_CMD"
    eval $COPY_BACK_CMD

    echo "Deleting temporary subs $RM_COPIED_CMD"
    set +e
    eval $RM_COPIED_CMD
    set -e
  done

done