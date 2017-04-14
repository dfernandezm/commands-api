/**
 * Created by david on 14/04/2017.
 */
"use strict";
const cache = require("memory-cache");

const cacheKeys = {
    SETTINGS_KEY: "mediacenter_settings",
    CANCELLED_STATUS_POLLER_KEY: "cancelled_poller"
};

const cacheService = {};

cacheService.get = (key) => {
    return cache.get(key);
};

cacheService.writeToCache = (key, value) => {
    cache.put(key, value);
};

cacheService.writeToCacheWithTtl = (key, value, ttlMs, timeoutCallback) => {
    cache.put(key, value, ttlMs, timeoutCallback);
};

cacheService.invalidateKey = (key) => {
    return cache.del(key);
};

cacheService.invalidateCache = () => {
    cache.clear();
};

cacheService.keys = cacheKeys;

module.exports = cacheService;