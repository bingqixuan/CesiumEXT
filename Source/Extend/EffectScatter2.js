/**
 * Created by bingqx on 2018/1/9.
 */
define([
    '../Core/Color',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Scene/PointPrimitiveCollection'
], function (Color,
             defaultValue,
             defined,
             DeveloperError,
             PointPrimitiveCollection) {
    'use strict';

    /**
     * 波纹效果
     *
     * @alias EffectScatter
     *
     * @param {Object} options
     * @param {Scene} options.scene 场景
     * @param {Cartesian3} options.position 位置
     * @param {Number} [options.period=4] 动画的时间
     * @param {Number} [options.scale=2.5] 动画中波纹的最大缩放比例
     * @param {Number} [options.brushType='fill'] 波纹的绘制方式，可选‘stroke’和‘fill’
     * @param {Number} [options.size=10] 标记的大小
     * @param {Number} [options.color=Color.YELLOW] 标记颜色
     * @constructor
     */
    function EffectScatter(options) {
        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required!');
        }
        this._scene = options.scene;
        if (!defined(options.position)) {
            throw new DeveloperError('options.position is required!');
        }
        this._position = options.position;
        this._period = defaultValue(options.period, 4);
        this._scale = defaultValue(options.scale, 2.5);
        this._brushType = defaultValue(options.brushType, 'fill');
        this._size = defaultValue(options.size, 10);
        this._color = defaultValue(options.color, Color.YELLOW);

        this._pointCollection = this._scene.primitives.add(new PointPrimitiveCollection());
        this.init();

        var i = 0;
        var that = this;
        setInterval(function(){
            if(i > 10){
                i = 0;
            }
            that.update(i);
            i++;
        },50);
    }

    EffectScatter.prototype.init = function () {
        this._pointCollection.add({
            position: this._position,
            color: this._color,
            pixelSize: this._size
        });
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 10,
            outlineWidth: 1
        });
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 20,
            outlineWidth: 1
        });
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 30,
            outlineWidth: 1
        });
    };

    EffectScatter.prototype.update = function (i) {
        this._pointCollection.remove(this._pointCollection.get(1));
        this._pointCollection.remove(this._pointCollection.get(2));
        this._pointCollection.remove(this._pointCollection.get(3));
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 10 + i,
            outlineWidth: 1
        });
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 20 + i,
            outlineWidth: 1
        });
        this._pointCollection.add({
            position: this._position,
            outlineColor: this._color,
            color: new Color(0.0, 0.0, 0.0, 0.0),
            pixelSize: this._size + 30 + i,
            outlineWidth: 1
        });
    };

    return EffectScatter;
});
