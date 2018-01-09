/**
 * Created by bingqx on 2018/1/9.
 */
define([
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/DeveloperError',
], function (defaultValue,
             defined,
             DeveloperError) {
    'use strict';

    /**
     * 波纹效果
     * @param {Object} options
     * @param {Scene} options.scene 场景
     * @param {Number} [options.period=4] 动画的时间
     * @param {Number} [options.scale=2.5] 动画中波纹的最大缩放比例
     * @param {Number} [options.brushType='fill'] 波纹的绘制方式，可选‘stroke’和‘fill’
     * @param {Number} [options.size=10] 标记的大小
     * @constructor
     */
    function EffectScatter(options) {
        if (defined(options.scene)) {
            throw new DeveloperError('options.scene is required!');
        }
        this._scene = options.scene;
        this._period = defaultValue(options.period, 4);
        this._scale = defaultValue(options.scale, 2.5);
        this._brushType = defaultValue(options.brushType, 'fill');
        this._size = defaultValue(options.size, 10);
    }

    return EffectScatter;
});
