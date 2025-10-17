/****************************************************************************
 Copyright (c) 2019 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
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
const { parseParameters } = require('./utilities');

function downloadFile (url, options, onProgress, onComplete) {
    var { options, onProgress, onComplete } = parseParameters(options, onProgress, onComplete);

    var xhr = new XMLHttpRequest(), errInfo = 'download failed: ' + url + ', status: ';

    xhr.open('GET', url, true);

    if (options.responseType !== undefined) xhr.responseType = options.responseType;
    if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
    if (options.mimeType !== undefined && xhr.overrideMimeType ) xhr.overrideMimeType(options.mimeType);
    if (options.timeout !== undefined) xhr.timeout = options.timeout;

    if (options.header) {
        for (var header in options.header) {
            xhr.setRequestHeader(header, options.header[header]);
        }
    }
    // 请求完成 
    xhr.onload = function () {
        if ( xhr.status === 200 || xhr.status === 0 ) {
            onComplete && onComplete(null, xhr.response);
        } else {
            onComplete && onComplete(new Error(errInfo + xhr.status + '(no response)'));
        }

    };

    if (onProgress) {
        // 请求进度监听
        xhr.onprogress = function (e) {
            if (e.lengthComputable) {
                onProgress(e.loaded, e.total);
            }
        };
    }
    
    //当 request 遭遇错误时触发
    xhr.onerror = function(){
        onComplete && onComplete(new Error(errInfo + xhr.status + '(error)'));
    };

    // 在预设时间内没有接收到响应时触发
    xhr.ontimeout = function(){
        onComplete && onComplete(new Error(errInfo + xhr.status + '(time out)'));
    };

    // XMLHttpRequest.abort()
    xhr.onabort = function(){
        onComplete && onComplete(new Error(errInfo + xhr.status + '(abort)'));
    };

    xhr.send(null);
    
    return xhr;
}
/**
 * 请求成功
 *          onload
 * 
 * 请求失败
 *          onabort
 *          onerror
 * 
 * timeout
 * xhr.timeout = 5000; // 5秒超时
 * 如果 5 秒内请求仍未完成（未触发 load、error、abort），浏览器就会自动触发 timeout 事件。
 * note:超时后 xhr.status 通常为 0
 * 
 * 
 * note:
 * onloaded 事件
 * timeout
 * onabort
 * onerror
 * onload
 * 触发后都会触发 onloaded
 * 
 * 
 *  情况	触发事件顺序	状态码 (xhr.status)
 *  正常完成	load → loadend	200 / 404 ...
 *  超时	timeout → loadend	0
 *  网络错误	error → loadend	0
 *  调用 abort()	abort → loadend	0
 * 
 */

module.exports = downloadFile;