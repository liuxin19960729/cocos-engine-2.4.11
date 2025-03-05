/****************************************************************************
 Copyright (c) 2019 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of cache-manager software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in cache-manager License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
const { getUserDataPath, readJsonSync, makeDirSync, writeFileSync, writeFile, deleteFile, rmdirSync } = require('./jsb-fs-utils');

var writeCacheFileList = null;
var startWrite = false;
var nextCallbacks = [];
var callbacks = [];
var cleaning = false;
const REGEX = /^\w+:\/\/.*/;

var cacheManager = {

    /**缓存目录 */
    cacheDir: 'gamecaches',

    /**缓存文件名字 */
    cachedFileName: 'cacheList.json',

    deleteInterval: 500,

    writeFileInterval: 2000,

    cachedFiles: null,

    version: '1.1',

    getCache(url) {
        this.updateLastTime(url);
        return this.cachedFiles.has(url) ? `${this.cacheDir}/${this.cachedFiles.get(url).url}` : '';
    },

    getTemp(url) {
        return '';
    },

    init() {
        /**缓存目录绝对路径 */
        this.cacheDir = getUserDataPath() + '/' + this.cacheDir;
        /**cacheList.json  绝对路径*/
        var cacheFilePath = this.cacheDir + '/' + this.cachedFileName;
        /**读取 cacheList.json 里面的数据 */
        var result = readJsonSync(cacheFilePath);
        if (result instanceof Error || !result.version || result.version !== this.version) {
            /**!result.version or result.version !== this.version*/
            if (!(result instanceof Error)) rmdirSync(this.cacheDir, true);
            this.cachedFiles = new cc.AssetManager.Cache();
            /**创建缓存目录 */
            makeDirSync(this.cacheDir, true);
            writeFileSync(cacheFilePath, JSON.stringify({ files: this.cachedFiles._map, version: this.version }), 'utf8');
        }
        else {
            /**存在CacheList.json 并讲缓存的收据放入缓存中 */
            this.cachedFiles = new cc.AssetManager.Cache(result.files);
        }
    },

    /**更新当最后一次获取cache时间 */
    updateLastTime(url) {
        if (this.cachedFiles.has(url)) {
            var cache = this.cachedFiles.get(url);
            cache.lastTime = Date.now();
        }
    },

    /**讲 cache 数据 写入到磁盘 */
    _write() {
        writeCacheFileList = null;
        startWrite = true;
        writeFile(this.cacheDir + '/' + this.cachedFileName, JSON.stringify({ files: this.cachedFiles._map, version: this.version }), 'utf8', function () {
            startWrite = false;
            for (let i = 0, j = callbacks.length; i < j; i++) {
                callbacks[i]();
            }
            callbacks.length = 0;
            callbacks.push.apply(callbacks, nextCallbacks);
            nextCallbacks.length = 0;
        });
    },

    /**cb 写入到磁盘的回调 */
    writeCacheFile(cb) {
        if (!writeCacheFileList) {// writeCacheFileList 还没有 写入任务的setTimeout
            /**两秒之后写入数据到磁盘 */
            writeCacheFileList = setTimeout(this._write.bind(this), this.writeFileInterval);
            /**startWrite 当前正在写入数据 讲会掉放入到nextCallbacks */
            if (startWrite === true) {
                cb && nextCallbacks.push(cb);
            }
            else {
                cb && callbacks.push(cb);
            }
        } else {
            cb && callbacks.push(cb);
        }
    },

    /**
     * 
     * @param {*} id 
     * @param {*} url 磁盘下的相对路径
     * @param {*} cacheBundleRoot bundle 
     */
    cacheFile(id, url, cacheBundleRoot) {
        this.cachedFiles.add(id, { bundle: cacheBundleRoot, url, lastTime: Date.now() });
        this.writeCacheFile();
    },

    /**清除缓存 */
    clearCache() {
        /**删除缓存目录 */
        rmdirSync(this.cacheDir, true);
        /**重新创建缓存对象 */
        this.cachedFiles = new cc.AssetManager.Cache();
        makeDirSync(this.cacheDir, true);
        var cacheFilePath = this.cacheDir + '/' + this.cachedFileName;
        writeFileSync(cacheFilePath, JSON.stringify({ files: this.cachedFiles._map, version: this.version }), 'utf8');
        /**创建bundel 目录 */
        cc.assetManager.bundles.forEach(bundle => {
            if (REGEX.test(bundle.base)) this.makeBundleFolder(bundle.name);
        });
    },

    /**LRU 清除缓存 */
    clearLRU() {
        /**是否正在LRU 清除 */
        if (cleaning) return;
        cleaning = true;

        var caches = [];
        var self = this;
        this.cachedFiles.forEach((val, key) => {
            if (val.bundle === 'internal') return;
            caches.push({ originUrl: key, url: this.getCache(key), lastTime: val.lastTime });
        });
        /**lastTime 排序 升序 */
        caches.sort(function (a, b) {
            return a.lastTime - b.lastTime;
        });

        /**note: 清除 1/3的文件 */
        caches.length = Math.floor(caches.length / 3);
        if (caches.length === 0) return;
        for (var i = 0, l = caches.length; i < l; i++) {
            this.cachedFiles.remove(caches[i].originUrl);
        }

        this.writeCacheFile(function () {
            function deferredDelete() {
                var item = caches.pop();
                /**讲文件从磁盘删除 */
                deleteFile(item.url);
                if (caches.length > 0) {
                    setTimeout(deferredDelete, self.deleteInterval);
                }
                else {
                    cleaning = false;
                }
            }
            setTimeout(deferredDelete, self.deleteInterval);
        });

    },

    removeCache(url) {
        if (this.cachedFiles.has(url)) {
            var path = this.getCache(url);
            this.cachedFiles.remove(url);
            this.writeCacheFile(function () {
                deleteFile(path);
            });
        }
    },

    /**创建bundel 目录 */
    makeBundleFolder(bundleName) {
        makeDirSync(this.cacheDir + '/' + bundleName, true);
    }
}

cc.assetManager.cacheManager = module.exports = cacheManager;