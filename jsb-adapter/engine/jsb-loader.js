/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

'use strict';

const cacheManager = require('./jsb-cache-manager');
const { downloadFile, readText, readArrayBuffer, readJson, getUserDataPath, initJsbDownloader } = require('./jsb-fs-utils');

const REGEX = /^\w+:\/\/.*/;
const downloader = cc.assetManager.downloader;
const parser = cc.assetManager.parser;
const presets = cc.assetManager.presets;
downloader.maxConcurrency = 30;
downloader.maxRequestsPerFrame = 60;
presets['preload'].maxConcurrency = 15;
presets['preload'].maxRequestsPerFrame = 30;
presets['scene'].maxConcurrency = 32;
presets['scene'].maxRequestsPerFrame = 64;
presets['bundle'].maxConcurrency = 32;
presets['bundle'].maxRequestsPerFrame = 64;
let suffix = 0;

let REMOTE_SERVER_ROOT = '';
let remoteBundles = {};

const failureMap = {};
const maxRetryCountFromBreakpoint = 5;
const loadedScripts = {};

function downloadScript(url, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }

    if (loadedScripts[url]) return onComplete && onComplete();

    download(url, function (src, options, onComplete) {
        window.require(src);
        loadedScripts[url] = true;
        onComplete && onComplete(null);
    }, options, options.onFileProgress, onComplete);
}

function download(url, func, options, onFileProgress, onComplete) {
    var result = transformUrl(url, options);
    // 资源在本地
    if (result.inLocal) {
        func(result.url, options, onComplete);
    }
    // 资源在缓存
    else if (result.inCache) {
        // 缓存
        cacheManager.updateLastTime(url)
        func(result.url, options, function (err, data) {
            if (err) {
                cacheManager.removeCache(url);
            }
            onComplete(err, data);
        });
    }
    else {
        // 下载资源
        var time = Date.now();
        var storagePath = '';
        var failureRecord = failureMap[url];
        if (failureRecord) {
            storagePath = failureRecord.storagePath;
        }
        else if (options.__cacheBundleRoot__) {
            storagePath = `${options.__cacheBundleRoot__}/${time}${suffix++}${cc.path.extname(url)}`;
        }
        else {
            storagePath = `${time}${suffix++}${cc.path.extname(url)}`;
        }

        /**将文件下载到 gamecaches/${storagePath} */
        downloadFile(url, `${cacheManager.cacheDir}/${storagePath}`, options.header, onFileProgress, function (err, path) {
            if (err) {
                //failureRecord 失败记录
                if (failureRecord) {
                    failureRecord.retryCount++;
                    // 超过最大重试次数，删除记录
                    if (failureRecord.retryCount >= maxRetryCountFromBreakpoint) {
                        delete failureMap[url];
                    }
                }
                else {
                    failureMap[url] = { retryCount: 0, storagePath };
                }
                onComplete(err, null);
                return;
            }
            delete failureMap[url];
            func(path, options, function (err, data) {
                if (!err) {
                    /**将下载到的文件写入缓存列表里面 */
                    cacheManager.cacheFile(url, storagePath, options.__cacheBundleRoot__);
                }
                onComplete(err, data);
            });
        });
    }
}

function transformUrl(url, options) {
    // local
    var inLocal = false;
    // cahce
    var inCache = false;
    if (REGEX.test(url)) {
        // http or https ... 下载
        if (options.reload) {
            return { url };
        }
        else {
            // 在缓存中
            var cache = cacheManager.getCache(url);
            if (cache) {
                inCache = true;
                url = cache;
            }
        }
    }
    else {
        // 在本地
        inLocal = true;
    }
    return { url, inLocal, inCache };
}

function doNothing(content, options, onComplete) {
    onComplete(null, content);
}

/**下载资源 */
function downloadAsset(url, options, onComplete) {
    download(url, doNothing, options, options.onFileProgress, onComplete);
}

function _getFontFamily(fontHandle) {
    var ttfIndex = fontHandle.lastIndexOf(".ttf");
    if (ttfIndex === -1) return fontHandle;

    var slashPos = fontHandle.lastIndexOf("/");
    var fontFamilyName;
    if (slashPos === -1) {
        fontFamilyName = fontHandle.substring(0, ttfIndex) + "_LABEL";
    } else {
        fontFamilyName = fontHandle.substring(slashPos + 1, ttfIndex) + "_LABEL";
    }
    if (fontFamilyName.indexOf(' ') !== -1) {
        fontFamilyName = '"' + fontFamilyName + '"';
    }
    return fontFamilyName;
}

function parseText(url, options, onComplete) {
    readText(url, onComplete);
}

function parseJson(url, options, onComplete) {
    readJson(url, onComplete);
}

function downloadText(url, options, onComplete) {
    download(url, parseText, options, options.onFileProgress, onComplete);
}

function parseArrayBuffer(url, options, onComplete) {
    readArrayBuffer(url, onComplete);
}

function downloadJson(url, options, onComplete) {
    /**parseJson 本地 or  chcheList 读取并且 解析 */
    download(url, parseJson, options, options.onFileProgress, onComplete);
}


/**下载bundle */
function downloadBundle(nameOrUrl, options, onComplete) {
    let bundleName = cc.path.basename(nameOrUrl);
    var version = options.version || cc.assetManager.downloader.bundleVers[bundleName];
    let url;
    //http://  or  磁盘下
    if (REGEX.test(nameOrUrl) || nameOrUrl.startsWith(getUserDataPath())) {
        url = nameOrUrl;
        cacheManager.makeBundleFolder(bundleName);
    }
    else {
        /**工程内设置的远程bundle */
        if (remoteBundles[bundleName]) {
            url = `${REMOTE_SERVER_ROOT}remote/${bundleName}`;
            cacheManager.makeBundleFolder(bundleName);
        }
        else {
            url = `assets/${bundleName}`;
        }
    }
    var config = `${url}/config.${version ? version + '.' : ''}json`;
    options.__cacheBundleRoot__ = bundleName;
    downloadJson(config, options, function (err, response) {
        if (err) {
            return onComplete(err, null);
        }
        let out = response;
        out && (out.base = url + '/');

        var js = `${url}/index.${version ? version + '.' : ''}${out.encrypted ? 'jsc' : `js`}`;
        downloadScript(js, options, function (err) {
            if (err) {
                return onComplete(err, null);
            }
            onComplete(err, out);
        });
    });
};

function loadFont(url, options, onComplete) {
    let fontFamilyName = _getFontFamily(url);

    let fontFace = new FontFace(fontFamilyName, "url('" + url + "')");
    document.fonts.add(fontFace);

    fontFace.load();
    fontFace.loaded.then(function () {
        onComplete(null, fontFamilyName);
    }, function () {
        cc.warnID(4933, fontFamilyName);
        onComplete(null, fontFamilyName);
    });
}

function parsePlist(url, options, onComplete) {
    readText(url, function (err, file) {
        var result = null;
        if (!err) {
            result = cc.plistParser.parse(file);
            if (!result) err = new Error('parse failed');
        }
        onComplete && onComplete(err, result);
    });
}

parser.parsePVRTex = downloader.downloadDomImage;
parser.parsePKMTex = downloader.downloadDomImage;
parser.parseASTCTex = downloader.downloadDomImage;
downloader.downloadScript = downloadScript;
/**注册下载相关的函数 */
downloader.register({
    // JS
    '.js': downloadScript,
    '.jsc': downloadScript,

    // Images
    '.png': downloadAsset,
    '.jpg': downloadAsset,
    '.bmp': downloadAsset,
    '.jpeg': downloadAsset,
    '.gif': downloadAsset,
    '.ico': downloadAsset,
    '.tiff': downloadAsset,
    '.webp': downloadAsset,
    '.image': downloadAsset,
    '.pvr': downloadAsset,
    '.pkm': downloadAsset,
    '.astc': downloadAsset,

    // Audio
    '.mp3': downloadAsset,
    '.ogg': downloadAsset,
    '.wav': downloadAsset,
    '.m4a': downloadAsset,

    // Video
    '.mp4': downloadAsset,
    '.avi': downloadAsset,
    '.mov': downloadAsset,
    '.mpg': downloadAsset,
    '.mpeg': downloadAsset,
    '.rm': downloadAsset,
    '.rmvb': downloadAsset,
    // Text
    '.txt': downloadAsset,
    '.xml': downloadAsset,
    '.vsh': downloadAsset,
    '.fsh': downloadAsset,
    '.atlas': downloadAsset,

    '.tmx': downloadAsset,
    '.tsx': downloadAsset,
    '.fnt': downloadAsset,
    '.plist': downloadAsset,

    '.json': downloadJson,
    '.ExportJson': downloadAsset,

    '.binary': downloadAsset,
    '.bin': downloadAsset,
    '.dbbin': downloadAsset,
    '.skel': downloadAsset,

    // Font
    '.font': downloadAsset,
    '.eot': downloadAsset,
    '.ttf': downloadAsset,
    '.woff': downloadAsset,
    '.svg': downloadAsset,
    '.ttc': downloadAsset,

    'bundle': downloadBundle,
    'default': downloadText
});

parser.register({

    // Images
    '.png': downloader.downloadDomImage,
    '.jpg': downloader.downloadDomImage,
    '.bmp': downloader.downloadDomImage,
    '.jpeg': downloader.downloadDomImage,
    '.gif': downloader.downloadDomImage,
    '.ico': downloader.downloadDomImage,
    '.tiff': downloader.downloadDomImage,
    '.webp': downloader.downloadDomImage,
    '.image': downloader.downloadDomImage,
    // compressed texture
    '.pvr': downloader.downloadDomImage,
    '.pkm': downloader.downloadDomImage,
    '.astc': downloader.downloadDomImage,

    '.binary': parseArrayBuffer,
    '.bin': parseArrayBuffer,
    '.dbbin': parseArrayBuffer,
    '.skel': parseArrayBuffer,

    // Text
    '.txt': parseText,
    '.xml': parseText,
    '.vsh': parseText,
    '.fsh': parseText,
    '.atlas': parseText,
    '.tmx': parseText,
    '.tsx': parseText,
    '.fnt': parseText,

    '.plist': parsePlist,

    // Font
    '.font': loadFont,
    '.eot': loadFont,
    '.ttf': loadFont,
    '.woff': loadFont,
    '.svg': loadFont,
    '.ttc': loadFont,

    '.ExportJson': parseJson,
});

cc.assetManager.transformPipeline.append(function (task) {
    var input = task.output = task.input;
    for (var i = 0, l = input.length; i < l; i++) {
        var item = input[i];
        if (item.config) {
            item.options.__cacheBundleRoot__ = item.config.name;
        }
    }
});

var originInit = cc.assetManager.init;
cc.assetManager.init = function (options) {
    originInit.call(cc.assetManager, options);
    options.remoteBundles && options.remoteBundles.forEach(x => remoteBundles[x] = true);
    REMOTE_SERVER_ROOT = options.server || '';
    if (REMOTE_SERVER_ROOT && !REMOTE_SERVER_ROOT.endsWith('/')) REMOTE_SERVER_ROOT += '/';
    initJsbDownloader(options.jsbDownloaderMaxTasks, options.jsbDownloaderTimeout);
    cacheManager.init();
};