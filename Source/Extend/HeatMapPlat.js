/**
 * Created by rick on 2018/1/17.
 */
define([
    '../Core/Color',
    '../Core/ColorGeometryInstanceAttribute',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Core/GeometryInstance',
    '../Core/PixelFormat',
    '../Core/Rectangle',
    '../Core/RectangleGeometry',
    '../DataSources/CallbackProperty',
    '../Renderer/Framebuffer',
    '../Renderer/PixelDatatype',
    '../Renderer/Sampler',
    '../Renderer/Texture',
    '../Renderer/TextureMagnificationFilter',
    '../Renderer/TextureMinificationFilter',
    '../Scene/Material',
    '../Scene/MaterialAppearance',
    '../Scene/PerInstanceColorAppearance',
    '../Scene/Primitive',
], function (Color,
             ColorGeometryInstanceAttribute,
             defined,
             DeveloperError,
             GeometryInstance,
             PixelFormat,
             Rectangle,
             RectangleGeometry,
             CallbackProperty,
             Framebuffer,
             PixelDatatype,
             Sampler,
             Texture,
             TextureMagnificationFilter,
             TextureMinificationFilter,
             Material,
             MaterialAppearance,
             PerInstanceColorAppearance,
             Primitive) {
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
        this._range = options.range;

        this._updateColorRamp();
        this._init();
    }

    HeatMap.prototype._init = function () {
        var instance = new GeometryInstance({
            geometry: new RectangleGeometry({
                rectangle: Rectangle.fromDegrees(this._range[0], this._range[1], this._range[2], this._range[3]),
                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
            })
        });
        // this.colorTexture = new Texture({
        //     context: this._scene.context,
        //     width: this.colorRamp.width,
        //     height: this.colorRamp.height,
        //     pixelFormat: PixelFormat.RGBA,
        //     pixelDatatype: PixelDatatype.UNSIGNED_BUTE,
        //     sampler: new Sampler({
        //         // wrapS: TextureWrap.CLAMP_TO_EDGE,  // 默认值
        //         // wrapT: TextureWrap.CLAMP_TO_EDGE,
        //         minificationFilter: TextureMinificationFilter.NEAREST,
        //         magnificationFilter: TextureMagnificationFilter.NEAREST
        //     })
        // });
        // this.colorTexture.copyFrom(this.colorRamp);


        var vs = `attribute vec3 position3DHigh; 
attribute vec3 position3DLow;
attribute vec3 normal;
attribute vec2 st;
attribute float batchId;

varying vec3 v_positionEC;
varying vec3 v_normalEC;
varying vec2 v_st;

void main()
{
    vec4 p = czm_computePosition();

    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;      // position in eye coordinates
    v_normalEC = czm_normal * normal;                         // normal in eye coordinates
    v_st = st;
    v_st = vec2(st.y,st.x);

    gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`;
        var fs = `
varying vec3 v_positionEC;
varying vec3 v_normalEC;
varying vec2 v_st;

void main()
{
    vec3 positionToEyeEC = -v_positionEC;

    vec3 normalEC = normalize(v_normalEC);;
#ifdef FACE_FORWARD
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);
#endif

    czm_materialInput materialInput;
    materialInput.normalEC = normalEC;
    materialInput.positionToEyeEC = positionToEyeEC;
    materialInput.st = v_st;
    czm_material material = czm_getMaterial(materialInput);

    float coordX = 0.5;
    if(length(positionToEyeEC) > 10000000.0){
        coordX = 0.99;
    }else{ 
        coordX = length(positionToEyeEC) / 10000000.0;
    }
    vec4 color2 = texture2D(u_colorRamp_0, vec2(coordX, 0.5));
    gl_FragColor = vec4(color2.xyz, 1.0);
// #ifdef FLAT
//     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
//    gl_FragColor = vec4(material.diffuse + material.emission, material.alpha);
// #else
//     gl_FragColor = czm_phong(normalize(positionToEyeEC), material);
// #endif
}
`;
        // var fs =
        //     // 'uniform sampler2D u_colorRamp; \n' +
        //     // 'uniform float u_cameraHeight; \n' +
        //     'varying vec3 v_positionEC; \n' +
        //     'void main(){ \n' +
        //     '   vec3 positionToEyeEC = -v_positionEC; \n' +
        //     '   czm_material material = czm_getMaterial(materialInput); \n' +
        //     '   float coordX = 0.5; \n' +
        //     '   if(length(positionToEyeEC) > 10000000.0){ \n' +
        //     '       coordX = 0.99; \n' +
        //     '   }else{ \n' +
        //     '       coordX = length(positionToEyeEC) / 10000000.0; \n' +
        //     '   } \n' +
        //     // '   float coordX = u_cameraHeight / 1e7 >= 1.0 ? 0.7 : u_cameraHeight / 1e7; \n' +
        //     '   vec4 color2 = texture2D(u_colorRamp, vec2(coordX, 0.5)); \n' +
        //     '   gl_FragColor = vec4(color2.xyz, 1.0); \n' +
        //     '}';
        var materail = new Material({
            strict: false,
            translucent: true,
            fabric: {
                uniforms:{
                    u_colorRamp: this.colorRamp
                },
            },
        });
        var appearance = new MaterialAppearance({
            fragmentShaderSource: fs,
            vertexShaderSource: vs,
            material: materail
        });
        // appearance.uniforms = {
        //     // 'u_colorRamp': new CallbackProperty(()=> {
        //     //     return this.colorRamp;
        //     // }, false),
        //     // 'u_cameraHeight': new CallbackProperty(()=> {
        //     //     return this._scene._camera._positionCartographic.height;
        //     // }, false),
        //     'u_colorRamp': this.colorTexture,
        //     // 'u_cameraHeight': this._scene._camera._positionCartographic.height
        // };

        this.primitive = this._scene.primitives.add(new Primitive({
            geometryInstances: [instance],
            appearance: appearance
        }));
    };

    function createFramebuffer(ht, context) {
        var colorTexture = new Texture({
            context: ht._scene.context,
            width: ht.colorRamp.width,
            height: ht.colorRamp.height,
            pixelFormat: PixelFormat.RGBA,
            pixelDatatype: PixelDatatype.UNSIGNED_BUTE,
            sampler: new Sampler({
                // wrapS: TextureWrap.CLAMP_TO_EDGE,  // 默认值
                // wrapT: TextureWrap.CLAMP_TO_EDGE,
                minificationFilter: TextureMinificationFilter.NEAREST,
                magnificationFilter: TextureMagnificationFilter.NEAREST
            })
        });

        // var framebuffer = new Framebuffer({
        //     context: context,
        //     colorTextures: [colorTexture],
        //     destroyAttachments: false
        // });

        // var pass = ht._pass;
        // pass.framebuffer = framebuffer;
        // pass.passState.framebuffer = framebuffer;

        ht._colorTexture = colorTexture;
    }

    // 更新颜色表
    HeatMap.prototype._updateColorRamp = function () {
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
        ctx.putImageData(imageData, 0, 0);
        this.colorRamp = canvas;
        this.colorRampTexture = null;
    };

    // 根据线性插值来生成颜色
    HeatMap.prototype._calcRampData = function (value) {
        var labels = this._colorRampLabels;
        var colors = this._colorRamp;

        var index;
        for (var i = 0, len = labels.length; i < len - 1; i++) {
            if (value >= labels[i] && value < labels[i + 1]) {
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
