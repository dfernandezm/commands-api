#!/bin/bash

# Comma separated paths to rename
INPUT_PATHS=$1
OUTPUT=$2
LOG_PATH=$3
XBMC_HOST=$4

FB_EXEC=filebot
LOG_LOCATION=$LOG_PATH/filebot-rename.$$.log
ACTION=move
AMC_SCRIPT_PATH=fn:amc


IFS=',' read -ra INPUT_ARRAY <<< "$INPUT_PATHS"

#INPUT_ARRAY=($INPUT_PATH)
#LANGS_ARRAY=(en)
#AMC_SCRIPT_PATH=/opt/software/filebot/scripts/amc.groovy

COUNT=${#INPUT_ARRAY[@]}

TITLE_ESCAPED="{t.replaceAll(/[é]/,'e').replaceAll(/[á]/,'a').replaceAll(/[í]/,'i').replaceAll(/[ó]/,'o').replaceAll(/[ú]/,'u')}"

for ((i = 0; i < ${#INPUT_ARRAY[@]}; i++))
do
  INPUT_PATH="${INPUT_ARRAY[$i]}"
  CONTENT_LANG=en
  FILEBOT_AMC_CMD="$FB_EXEC -script $AMC_SCRIPT_PATH --output \"$OUTPUT\" -no-xattr --log-file $LOG_LOCATION --action $ACTION -non-strict \"$INPUT_PATH\" --def clean=y --conflict auto --def skipExtract=y --lang $CONTENT_LANG"
  FILEBOT_AMC_CMD="$FILEBOT_AMC_CMD --def unsorted=y --def \"seriesFormat=TV Shows/{n.upperInitial()}/{episode.special ? 'Specials':'Season '+s}/{n.upperInitial()} {episode.special ? '0xSpecial '+special.pad(2) : sxe.pad(2)} $TITLE_ESCAPED\" \"movieFormat=Movies/{n} ({y})/{n}\""
  let c=$COUNT-1

  if [ "$i" -eq "$c" ]; then
     FILEBOT_AMC_CMD="$FILEBOT_AMC_CMD --def xbmc=$XBMC_HOST"
  fi

  echo "Command executed:" >> $LOG_LOCATION
  echo "$FILEBOT_AMC_CMD " >> $LOG_LOCATION
  eval $FILEBOT_AMC_CMD
done