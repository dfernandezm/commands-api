/**
 * Created by david on 02/04/2017.
 */
const log4js = require("log4js");
log4js.configure({
    "appenders": [
        {
            "type": "file",
            "level": "DEBUG",
            "filename": "/mediacenter/temp/tvster.log",
            "maxLogSize": 4096,
            "backups": 3,
            "pollInterval": 15
        },

        {
            "category": "tvster_api",
            "type": "logLevelFilter",
            "level": "INFO",
            "appender": {
                "type": "console"
            }
        }
    ],

    "levels": {
        "tvster_api": "DEBUG"
    }
});
 module.exports = log4js.getLogger("tvster_api");