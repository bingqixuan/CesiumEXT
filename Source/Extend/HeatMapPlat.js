/**
 * Created by rick on 2018/1/17.
 */
define([
    '../Core/Color',
    '../Core/defined',
    '../Core/DeveloperError'
],function (Color,
    defined,
    DeveloperError) {
    'use strict';

    /**
     * 平面热力图
     * @param {Object} options
     * @param {Scene} options.scene  场景
     * @param {Number} options.weight  热点权重
     * @param {Number} options.intensity  热点强度
     * @param {Array} options.colorRamp  颜色值
     * @param {Array} options.colorRampLabels  颜色值对应索引值
     * @constructor
     */
    function HeatMap(options) {
        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._scene = options.scene;
        this._weight = options.weight;
        this._intensity = options.intensity;
        this._colorRamp = options.colorRamp;
        this._colorRampLabels = options.colorRampLabels;
        this._radius = options.radius;
        this._opacity = options.opacity;

        this._updateColorRamp();
    }

    HeatMap.prototype.init = function () {

    };

    // 更新颜色表
    HeatMap.prototype._updateColorRamp = function(){
        var colorRampData = new Uint8ClampedArray(256 * 4);
        var len = colorRampData.length;
        for (var i = 4; i < len; i += 4) {
            var pxColor = this._calcRampData((i / len));
            colorRampData[i + 0] = Math.floor(pxColor.red * 255 / pxColor.alpha);
            colorRampData[i + 1] = Math.floor(pxColor.green * 255 / pxColor.alpha);
            colorRampData[i + 2] = Math.floor(pxColor.blue * 255 / pxColor.alpha);
            colorRampData[i + 3] = Math.floor(pxColor.alpha * 255);
        }
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        canvas.width = 256;
        canvas.height = 1;
        var imageData = new ImageData(colorRampData, 256, 1);
        this.colorRamp = ctx.putImageData(imageData, 0, 0);
        this.colorRampTexture = null;
    };

    // 根据线性插值来生成颜色
    HeatMap.prototype._calcRampData = function (value) {
        var labels = this._colorRampLabels;
        var colors = this._colorRamp;

        var index;
        for(var i = 0, len = labels.length;i < len-1; i++){
            if(value >= labels[i] && value < labels[i+1]){
                index = i;
            }
        }
        var lower = labels[index];
        var upper = labels[index + 1];
        var t = value / (upper - lower);

        var colorsLower = Color.fromCssColorString(colors[index]);
        var colorsUpper = Color.fromCssColorString(colors[index + 1]);

        return interpolateColor(colorsLower, colorsUpper, t);
    };

    function interpolateColor(from, to, t) {
        return new Color(
            interpolate(from.red, to.red, t),
            interpolate(from.green, to.green, t),
            interpolate(from.blue, to.blue, t),
            interpolate(from.alpha, to.alpha, t)
        );
    }

    // 线性插值
    function interpolate(a, b, t) {
        return (a * (1 - t)) + (b * t);
    }

    return HeatMap;
});
