#!/bin/bash

# Store inside filebot directory in prefs.properties the username / password for OpenSubtitles - 200 subs a day by default
FB_EXEC=filebot
LOG_LOCATION=filebot-subs-$$.log
SUBS_LANG="es","en"
IFS=","
# Bash array - needs a substitution with a string like ==> ("path/to/files/1" "/path/to/files/2" ...)
INPUT_ARRAY=($1)
COUNT=${#INPUT_ARRAY[@]}
echo "Input Array: ${INPUT_ARRAY[*]}"

TMPDIR=/tmp/$RANDOM

mkdir $TMPDIR

for ((i = 0; i < ${#INPUT_ARRAY[@]}; i++))
do
  INPUT_PATH="${INPUT_ARRAY[$i]}"
  for LNG in $SUBS_LANG
  do
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
    eval $RM_COPIED_CMD

  done

done