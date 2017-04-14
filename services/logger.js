const log4js = require("log4js");
log4js.configure({
    "appenders": [
        {
            "type": "file",
            "level": "DEBUG",
            "filename": "/mediacenter/temp/tvster.log",
            "maxLogSize": 4096,
            "backups": 3,
            "pollInterval": 15,
            "category": "tvster_api",
            layout: {
                type: 'pattern',
                pattern: "%d{ABSOLUTE} [%[%5.5p%]] - %m%n"
            }
        },
        {
            "category": "tvster_api",
            "type": "logLevelFilter",
            "level": "INFO",
            layout: {
                type: 'pattern',
                pattern: "[%[%d{ISO8601_WITH_TZ_OFFSET}] [%p %x{ln}%]] %] - %m%n",
                tokens: {
                    ln : function() {
                        // The caller:
                        return (new Error).stack.split("\n")[11]
                        // Just the namespace, filename, line:
                        .replace(/^\s+at\s+(\S+)\s\((.+?)([^\/]+):(\d+):\d+\)$/, function (){
                            return arguments[3] +':'+ arguments[4];
                        });
                    }
                }
            },
            "appender": {
                "type": "console",
                layout: {
                    type: 'pattern',
                    pattern: "[%[%d{ISO8601_WITH_TZ_OFFSET}] [%p] %x{ln}%]%] - %m%n",
                    tokens: {
                        ln : function() {
                            // The caller:
                            return (new Error).stack.split("\n")[11]
                            // Just the namespace, filename, line:
                                .replace(/^\s+at\s+(\S+)\s\((.+?)([^\/]+):(\d+):\d+\)$/, function (){
                                    return arguments[3] +':'+ arguments[4];
                                });
                        }
                    }
                }
            }
        }
    ],
    "levels": {
        "tvster_api": "DEBUG"
    }
});
module.exports = log4js.getLogger("tvster_api");
