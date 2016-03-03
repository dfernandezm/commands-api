var torrentState = {};

torrentState.NEW = "NEW";
torrentState.DOWNLOADING = "DOWLOADING";
torrentState.AWAITING_DOWNLOAD = "AWAITING_DOWNLOAD";
torrentState.DOWNLOAD_COMPLETED = "DOWNLOAD_COMPLETED";
torrentState.FAILED = "FAILED";

module.exports = torrentState;
