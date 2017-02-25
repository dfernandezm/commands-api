#!/bin/sh

# force JVM language and encoding settings
export LANG="es_ES.UTF-8"
export LC_ALL="es_ES.UTF-8"

JAVA_EXEC=%JAVA_EXEC%
FILEBOT_HOME=%FILEBOT_HOME%

$JAVA_EXEC -Xmx350m -Dunixfs=false -Dsun.jnu.encoding=UTF-8 -DuseExtendedFileAttributes=true -DuseCreationDate=false -Dfile.encoding=UTF-8 -Dsun.net.client.defaultConnectTimeout=40000 -Dsun.net.client.defaultReadTimeout=120000 -Dapplication.deployment=ipkg -Duser.home=$FILEBOT_HOME/data -Dapplication.dir=$FILEBOT_HOME/data -Djava.io.tmpdir=$FILEBOT_HOME/data/temp -Djna.library.path=$FILEBOT_HOME -Djava.library.path=$FILEBOT_HOME -Dnet.filebot.AcoustID.fpcalc=$FILEBOT_HOME/fpcalc -jar $FILEBOT_HOME/FileBot.jar "$@"
