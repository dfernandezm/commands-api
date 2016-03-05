var torrentState = {};

torrentState.NEW = "NEW";
torrentState.DOWNLOADING = "DOWNLOADING";
torrentState.AWAITING_DOWNLOAD = "AWAITING_DOWNLOAD";
torrentState.DOWNLOAD_COMPLETED = "DOWNLOAD_COMPLETED";
torrentState.FAILED = "FAILED";
torrentState.FETCHING_SUBTITLES = "FETCHING_SUBTITLES";
torrentState.RENAMING = "RENAMING";
torrentState.RENAMING_COMPLETED = "RENAMING_COMPLETED";
torrentState.PAUSED = "PAUSED";

module.exports = torrentState;
