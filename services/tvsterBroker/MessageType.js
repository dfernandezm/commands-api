/**
 * Created by david on 27/02/2017.
 */
var MessageType;
(function (MessageType) {
    MessageType[MessageType["PROGRESS"] = 0] = "PROGRESS";
    MessageType[MessageType["START_DOWNLOAD"] = 1] = "START_DOWNLOAD";
    MessageType[MessageType["PAUSE_DOWNLOAD"] = 2] = "PAUSE_DOWNLOAD";
    MessageType[MessageType["RESUME_DOWNLOAD"] = 3] = "RESUME_DOWNLOAD";
    MessageType[MessageType["CANCEL_DOWNLOAD"] = 4] = "CANCEL_DOWNLOAD";
    MessageType[MessageType["RENAME"] = 5] = "RENAME";
    MessageType[MessageType["FETCH_SUBTITLES"] = 6] = "FETCH_SUBTITLES";
})(MessageType || (MessageType = {}));
