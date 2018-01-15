/**
 * Created by bingqx on 2018/1/9.
 */
define([
    '../Core/Color',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/ColorGeometryInstanceAttribute',
    '../Core/CircleGeometry',
    '../Core/DeveloperError',
    '../Core/EllipseGeometry',
    '../Core/Geometry',
    '../Core/GeometryInstance',
    '../Core/Math',
    '../Core/VertexFormat',
    '../Scene/ClassificationType',
    '../Scene/GroundPrimitive',
    '../Scene/MaterialAppearance',
    '../Scene/PerInstanceColorAppearance',
    '../Scene/PointPrimitiveCollection',
    '../Scene/Primitive'
], function (Color,
             defaultValue,
             defined,
             ColorGeometryInstanceAttribute,
             CircleGeometry,
             DeveloperError,
             EllipseGeometry,
             Geometry,
             GeometryInstance,
             Math,
             VertexFormat,
             ClassificationType,
             GroundPrimitive,
             MaterialAppearance,
             PerInstanceColorAppearance,
             PointPrimitiveCollection,
             Primitive) {
    'use strict';

    /**
     * 波纹效果
     *
     * @alias EffectScatter
     *
     * @param {Object} options
     * @param {Scene} options.scene 场景
     * @param {Cartesian3} options.position 位置
     * @param {Number} [options.rate=4] 动画的速度,v > 0
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
        this._rate = defaultValue(options.rate, 4);
        if(options.rate < 0){
            throw new DeveloperError('options.rate must be more than 0');
        }
        this._scale = defaultValue(options.scale, 2.5);
        this._brushType = defaultValue(options.brushType, 'fill');
        this._size = defaultValue(options.size, 10);
        this._color = defaultValue(options.color, Color.YELLOW);

        this.init();
    }

    EffectScatter.prototype.init = function () {
        var vs = '';
        var fs = 'varying vec4 v_color; \n' +
                 'uniform vec4 u_color; \n' +
                 'void main(){ \n' +
                 '   gl_FragColor = u_color; \n'+
                 '}';
        var appearance = new MaterialAppearance({
            fragmentShaderSource: fs,
            // vertexShaderSource: vs
        });
        appearance.uniforms = {
            u_color: this._color,
            u_size: this._size,

        };
        this._primitive = new Primitive({
            geometryInstances: new GeometryInstance({
                geometry: new EllipseGeometry({
                    center : this._position,
                    semiMinorAxis : 500000.0,
                    semiMajorAxis : 500000.0
                }),
                attributes : {
                    color : ColorGeometryInstanceAttribute.fromColor(Color.AQUA)
                }
            }),
            appearance: appearance
        });
        this._primitive = this._scene.primitives.add(this._primitive);
    };

    EffectScatter.prototype.update = function (i) {

    };

    return EffectScatter;
});
