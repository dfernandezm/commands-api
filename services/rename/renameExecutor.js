/**
 * Created by david on 13/03/2017.
 */

const spawn = require('child_process').spawn;
const debug = require("debug")("services/rename:renameExecutor");


const renameExecutor = {};

const pathMovedPattern = /\[MOVE\]\s+Rename\s+(.*)to\s+\[(.*)\]/;
const hashRegex = /_([\w]{40})/;

renameExecutor.executeFilebotRenameScript = (renameCommandParameters) => {
    try {
        let args = [ renameCommandParameters.inputPaths.join(","),
                     renameCommandParameters.baseLibraryPath,
                     renameCommandParameters.logLocation,
                     renameCommandParameters.xbmcHostOrIp
                     ];

        let executablePath = __dirname + "/filebot-rename.sh";

        debug("Executable is", executablePath);
        debug("Arguments for script are %o", args);

        return spawn(executablePath, args).on('error', (err) => {
            debug("Error spawning script", err);
            return {exitCode: -1, error: err};
        });
    } catch (err) {
        debug("Error spawning script", err);
        return {exitCode: -1, error: err};
    }
}

renameExecutor.startMonitoringRenamer = (filebotProcess, isRenamer) => {
    // Give the chance to run other tasks by deferring process listeners
    process.nextTick(() => {

        let completedRenames = [];

        filebotProcess.stdout.on('data', function (data) {
            const dataStr = data.toString('utf8');
            debug("[FILEBOT-COMMAND] " + dataStr);

            if (isRenamer) {
                const match = pathMovedPattern.exec(dataStr);
                if (match !== null && match.length > 1) {
                    let originalPath = match[1];
                    let renamedPath = match[2];

                    debug(`[FILEBOT-RENAMER-DETECTED] ${originalPath}  ==>  ${renamedPath}`);

                    const matchHash = hashRegex.exec(originalPath);
                    debug("Match hash %o", matchHash);

                    if (matchHash !== null && matchHash.length > 1) {
                        debug("Torrent hash match is %s", matchHash);
                        let torrentHash = matchHash[1];

                        if (!completedRenames[torrentHash]) {
                            completedRenames[torrentHash] = [];
                        }

                        completedRenames[torrentHash].push({
                            type: 'RENAME',
                            original: originalPath,
                            renamedPath: renamedPath,
                            torrentHash: torrentHash
                        });

                    } else {
                        debug("Torrent hash was not found in original path %s -- skipping", originalPath);
                    }
                }
            } else {
                //TODO: if subtitles
            }
        });

        filebotProcess.stderr.on('data', function (data) {
            debug('[FILEBOT-COMMAND-ERROR]: ' + data);
        });

        filebotProcess.on('close',  (exitCode) => {
            //TODO: send exitcode
            debug("Filebot Process exited with code: %s",exitCode);
            const tvsterMessageService = require("../sqs/tvsterMessageService");
            if (isRenamer) {
                debug("Completed Renames %o", completedRenames);
                if (exitCode !== 0) {
                    tvsterMessageService.renameCompleted({status: "failure", renamedTorrents: completedRenames});
                } else {
                    tvsterMessageService.renameCompleted({status: "success", renamedTorrents: completedRenames});
                }
                debug("Sent rename completed");
            } else {
                //TODO: is subtitles
            }
        });
    });
}

module.exports = renameExecutor;