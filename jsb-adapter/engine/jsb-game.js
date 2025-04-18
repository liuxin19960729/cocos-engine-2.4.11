/****************************************************************************
 Copyright (c) 2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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

cc.game.restart = function () {
    // Need to clear scene, or native object destructor won't be invoke.
    cc.director.getScene().destroy();
    cc.Object._deferredDestroy();
    cc.game.pause();

    __restartVM();
};
// js 异常错误监听
jsb.onError(function (location, message, stack) {
    console.error(location, message, stack);
});

jsb.onPause = function () {
    cc.game.emit(cc.game.EVENT_HIDE);
};

jsb.onResume = function () {
    cc.game.emit(cc.game.EVENT_SHOW);
};

jsb.onResize = function (size) {
    if (size.width === 0 || size.height === 0) return;
    size.width /= window.devicePixelRatio;
    size.height /= window.devicePixelRatio;
    window.resize(size.width, size.height);
};
