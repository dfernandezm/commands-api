#!/bin/bash

FB_EXEC=filebot
LOG_LOCATION=%LOG_LOCATION%.log
ACTION=move
# Bash array - needs a substitution with a string like ==> ("path/to/files/1" "/path/to/files/2" ...), values separated by spaces
INPUT_ARRAY=%INPUT_PATHS%
LANGS_ARRAY=%CONTENT_LANGS%
AMC_SCRIPT_PATH=%AMC_SCRIPT_PATH%
COUNT=${#INPUT_ARRAY[@]}
OUTPUT=%VIDEO_LIBRARY_BASE_PATH%
TITLE_ESCAPED="{t.replaceAll(/[é]/,'e').replaceAll(/[á]/,'a').replaceAll(/[í]/,'i').replaceAll(/[ó]/,'o').replaceAll(/[ú]/,'u')}"
for ((i = 0; i < ${#INPUT_ARRAY[@]}; i++))
do
  INPUT_PATH="${INPUT_ARRAY[$i]}"
  CONTENT_LANG="${LANGS_ARRAY[$i]}"
  FILEBOT_AMC_CMD="$FB_EXEC -script $AMC_SCRIPT_PATH --output \"$OUTPUT\" --log-file $LOG_LOCATION --action $ACTION -non-strict \"$INPUT_PATH\" --def clean=y --conflict auto --def skipExtract=y --lang $CONTENT_LANG"
  FILEBOT_AMC_CMD="$FILEBOT_AMC_CMD --def unsorted=y --def \"seriesFormat=TV Shows/{n.upperInitial()}/{episode.special ? 'Specials':'Season '+s}/{n.upperInitial()} {episode.special ? '0xSpecial '+special.pad(2) : sxe.pad(2)} $TITLE_ESCAPED\" \"movieFormat=Movies/{n} ({y})/{n}\""
  let c=$COUNT-1

  if [ "$i" -eq "$c" ]; then
     FILEBOT_AMC_CMD="$FILEBOT_AMC_CMD --def xbmc=%XBMC_HOSTNAME%"
  fi

  echo "Command executed:" >> $LOG_LOCATION
  echo "$FILEBOT_AMC_CMD " >> $LOG_LOCATION

  eval $FILEBOT_AMC_CMD

done
