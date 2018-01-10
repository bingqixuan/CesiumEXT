/**
 * Created by rick on 2018/1/10.
 */
define([
    '../Core/BoundingRectangle',
    '../Core/BoundingSphere',
    '../Core/Cartesian2',
    '../Core/Cartesian3',
    '../Core/Cartographic',
    '../Core/Color',
    '../Core/ColorGeometryInstanceAttribute',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/destroyObject',
    '../Core/DeveloperError',
    '../Core/Ellipsoid',
    '../Core/Math',
    '../Core/Matrix4',
    '../Core/GeometryInstance',
    '../Core/PixelFormat',
    '../Core/PolylineGeometry',
    '../Core/WebGLConstants',
    '../DataSources/CallbackProperty',
    '../Renderer/ContextLimits',
    '../Renderer/Framebuffer',
    '../Renderer/PassState',
    '../Renderer/PixelDatatype',
    '../Renderer/RenderState',
    '../Renderer/Sampler',
    '../Renderer/Texture',
    '../Renderer/TextureMagnificationFilter',
    '../Renderer/TextureMinificationFilter',
    '../Renderer/TextureWrap',
    '../Scene/Camera',
    '../Scene/Material',
    '../Scene/PerInstanceColorAppearance',
    '../Scene/PolylineMaterialAppearance',
    '../Scene/Primitive',
    '../Scene/PrimitiveCollection'
], function(
    BoundingRectangle,
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Cartographic,
    Color,
    ColorGeometryInstanceAttribute,
    defaultValue,
    defined,
    destroyObject,
    DeveloperError,
    Ellipsoid,
    Math,
    Matrix4,
    GeometryInstance,
    PixelFormat,
    PolylineGeometry,
    WebGLConstants,
    CallbackProperty,
    ContextLimits,
    Framebuffer,
    PassState,
    PixelDatatype,
    RenderState,
    Sampler,
    Texture,
    TextureMagnificationFilter,
    TextureMinificationFilter,
    TextureWrap,
    Camera,
    Material,
    PerInstanceColorAppearance,
    PolylineMaterialAppearance,
    Primitive,
    PrimitiveCollection) {
    'use strict';

    /**
     * 通视分析类
     * @param {Object} options
     * @param {Scene} options.scene  地球场景
     * @param {Color} [options.visibleColor=new Color(0.0,1.0,0.0,1.0)]  可视部分颜色
     * @param {Color} [options.invisibleColor=new Color(1.0,0.0,0.0,1.0)]  不可视部分颜色
     * @param {Boolean} [options.depthTest=false]  是否开启视线的深度测试
     * @constructor
     */
    function Sightline(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._scene = options.scene;
        this._scene.sightline = this;

        this._visibleColor = defaultValue(options.visibleColor, new Color(0.0, 1.0, 0.0, 1.0));
        this._invisibleColor = defaultValue(options.invisibleColor, new Color(1.0, 0.0, 0.0, 1.0));
        this._viewPosition = new Cartesian3();
        this._targetPosition = new Cartesian3();
        this._sightlineDepthTest = defaultValue(options.depthTest, false);

        this._sightlineMatrix = new Matrix4();
        this._sightlineTexture = undefined;

        this._sightlineCamera = new SightlineCamera();
        this._boundingSphere = new BoundingSphere();

        this._pass = new SightlinePass(this._scene.context);
        this._textureSize = new Cartesian2();
        this._usesDepthTexture = this._scene.context.depthTexture;

        this._clearPassState = new PassState(this._scene.context);
        resize(this, 2048);

        this._polylines = this._scene.primitives.add(new PrimitiveCollection());

        // this._scene.globe.depthTestAgainstTerrain = true;
    }

    function SightlinePass(context){
        this.camera = new SightlineCamera();
        this.passState = new PassState(context);
        this.framebuffer = undefined;
        this.textureOffsets = undefined;
        this.commandList = [];
        this.cullingVolume = undefined;
    }

    function SightlineCamera() {
        this.viewMatrix = new Matrix4();
        this.inverseViewMatrix = new Matrix4();
        this.frustum = undefined;
        this.positionWC = new Cartesian3();
        this.positionCartographic = new Cartographic();
        this.directionWC = Cartesian3.clone(Cartesian3.UNIT_Z);
        this.upWC = Cartesian3.clone(Cartesian3.UNIT_Y);
        this.rightWC = Cartesian3.clone(Cartesian3.UNIT_X);
        this.viewProjectionMatrix = new Matrix4();
    }

    SightlineCamera.prototype.clone = function(camera) {
        Matrix4.clone(camera.viewMatrix, this.viewMatrix);
        Matrix4.clone(camera.inverseViewMatrix, this.inverseViewMatrix);
        Matrix4.clone(camera.viewProjectionMatrix, this.viewProjectionMatrix);
        this.frustum = camera.frustum.clone(this.frustum);
        Cartographic.clone(camera.positionCartographic, this.positionCartographic);
        Cartesian3.clone(camera.positionWC, this.positionWC);
        Cartesian3.clone(camera.directionWC, this.directionWC);
        Cartesian3.clone(camera.upWC, this.upWC);
        Cartesian3.clone(camera.rightWC, this.rightWC);
    };

    var scaleBiasMatrix = new Matrix4(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);

    SightlineCamera.prototype.getViewProjection = function() {
        var view = this.viewMatrix;
        var projection = this.frustum.projectionMatrix;
        Matrix4.multiply(projection, view, this.viewProjectionMatrix);
        Matrix4.multiply(scaleBiasMatrix, this.viewProjectionMatrix, this.viewProjectionMatrix);
        return this.viewProjectionMatrix;
    };

    function resize(sightline, size) {
        sightline._size = size;
        var pass = sightline._pass;
        var textureSize = sightline._textureSize;

        size = (ContextLimits.maximumTextureSize >= size) ? size : ContextLimits.maximumTextureSize;
        textureSize.x = size;
        textureSize.y = size;
        pass.passState.viewport = new BoundingRectangle(0, 0, size, size);

        sightline._clearPassState.viewport = new BoundingRectangle(0, 0, textureSize.x, textureSize.y);

        var viewport = pass.passState.viewport;
        var biasX = viewport.x / textureSize.x;
        var biasY = viewport.y / textureSize.y;
        var scaleX = viewport.width / textureSize.x;
        var scaleY = viewport.height / textureSize.y;
        pass.textureOffsets = new Matrix4(scaleX, 0.0, 0.0, biasX, 0.0, scaleY, 0,0, biasY, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0)
    }

    Sightline.prototype.update = function(frameState) {
        if(!this._viewCamera){
            return;
        }

        updateCameras(this, frameState);
        updateFramebuffer(this, frameState.context);

        var sightlineCamera = this._sightlineCamera;

        this._pass.camera.clone(sightlineCamera);
        var inverseView = this._sceneCamera.inverseViewMatrix;
        Matrix4.multiply(this._sightlineCamera.getViewProjection(), inverseView, this._sightlineMatrix);
    };

    Sightline.prototype.updateCamera = function(camera) {
        this._viewCamera = camera;
    };

    Sightline.prototype.updatePass = function(context, sightlinePass) {
        // clearFramebuffer(this, context, sightlinePass);
        destroyFramebuffer(this);
        createFramebufferDepth(this, context);
    };

    function updateCameras(sightline, frameState) {
        var camera = frameState.camera;
        var viewCamera = sightline._viewCamera;
        var sceneCamera = sightline._sceneCamera;
        var sightlineCamera = sightline._sightlineCamera;
        sightlineCamera.clone(viewCamera);
        sightline._sceneCamera = Camera.clone(camera, sceneCamera);
    }

    function updateFramebuffer(sightline, context) {
        if(!defined(sightline._pass.framebuffer) || sightline._sightlineTexture.width !== sightline._textureSize.x){
            destroyFramebuffer(sightline);
            createFramebufferDepth(sightline, context);
            checkFramebuffer(sightline, context);
            // clearFramebuffer(sightline, context);
        }
    }

    function checkFramebuffer(sightline, context) {
        if(!defined(sightline._usesDepthTexture) && (sightline._pass.framebuffer.status !== WebGLConstants.FRAMEBUFFER_COMPLETE)){
            sightline._usesDepthTexture = false;
            // createRenderStates(sightline);
            destroyFramebuffer(sightline);
            createFramebufferDepth(sightline, context);
        }
    }

    function destroyFramebuffer(sightline) {
        var pass = sightline._pass;
        var framebuffer = pass.framebuffer;
        if(defined(framebuffer) && !framebuffer.isDestroyed()){
            framebuffer.destroy();
        }
        pass.framebuffer = undefined;

        sightline._depthAttachment = sightline._depthAttachment && sightline._depthAttachment.destroy();
        sightline._colorAttachment = sightline._colorAttachment && sightline._colorAttachment.destroy();
    }

    function createFramebufferDepth(sightline, context) {
        var depthStencilTexture = new Texture({
            context: context,
            width: sightline._textureSize.x,
            height: sightline._textureSize.y,
            pixelFormat: PixelFormat.DEPTH_STENCIL,
            pixelDatatype: PixelDatatype.UNSIGNED_INT_24_8,
            sampler: createSampler()
        });

        var colorTexture = new Texture({
            context: context,
            width: sightline._textureSize.x,
            height: sightline._textureSize.y,
            pixelFormat: PixelFormat.RGBA,
            pixelDatatype: PixelDatatype.UNSIGNED_BUTE,
            sampler: createSampler()
        });

        var framebuffer = new Framebuffer({
            context: context,
            depthStencilTexture: depthStencilTexture,
            colorTextures: [colorTexture],
            destroyAttachments: false
        });

        var pass = sightline._pass;
        pass.framebuffer = framebuffer;
        pass.passState.framebuffer = framebuffer;

        sightline._sightlineTexture = depthStencilTexture;
        sightline._depthAttachment = depthStencilTexture;
        sightline._colorTexture = colorTexture;
    }

    function createSampler() {
        return new Sampler({
            // wrapS: TextureWrap.CLAMP_TO_EDGE,  // 默认值
            // wrapT: TextureWrap.CLAMP_TO_EDGE,
            minificationFilter: TextureMinificationFilter.NEAREST,
            magnificationFilter: TextureMagnificationFilter.NEAREST
        });
    }

    var SightlineAppearanceFS = "uniform sampler2D u_depthTexture; \n"+
        "uniform vec4 u_visibleColor; \n" +
        "uniform vec4 u_invisibleColor; \n" +
        "uniform mat4 u_sightlineMatrix; \n" +
        "vec4 getPositionEC(){ \n" +
        "    return czm_windowToEyeCoordinates(gl_FragCoord); \n" +
        "} \n" +
        "void main() { \n" +
        "    vec4 positionEC = getPositionEC(); \n" +
        "    vec4 sightlinePosition = u_sightlineMatrix * positionEC; \n" +
        "    sightlinePosition /= sightlinePosition.w; \n" +
        "    vec2 texCoords = sightlinePosition.xy; \n" +
        "    float depth = sightlinePosition.z; \n" +
        "    vec4 realDepth = texture2D(u_depthTexture, texCoords); \n" +
        "    if(depth > realDepth.r){ \n" +
        "       gl_FragColor = u_invisibleColor; \n" +
        "    } \n" +
        "    else \n" +
        "    { \n" +
        "       gl_FragColor = u_visibleColor; \n" +
        "    } \n" +
        "} \n";

    /**
     * 设置通视分析的视点位置
     * @param {Cartesian3} viewPosition  视点位置坐标
     */
    Sightline.prototype.setViewPosition = function(viewPosition) {
        if (!defined(viewPosition)) {
            throw new DeveloperError('视点位置获取失败');
        }
        this._viewPosition = viewPosition;
    };

    /**
     * 设置通视分析的目标点位置
     * @param targetPosition
     */
    Sightline.prototype.setTargetPosition = function(targetPosition) {
        if (!defined(targetPosition)) {
            throw new DeveloperError('位置获取失败');
        }
        this._targetPosition = targetPosition;

        var distance = Cartesian3.distance(this._viewPosition, this._targetPosition);
        if(distance <= 0){
            return;
        }
        this.updatePass(this._scene.context);

        // viewCamera: 构建从视点出发的相机
        this._viewCamera = new Camera(this._scene);
        this._viewCamera.position = this._viewPosition;
        this._viewCamera.direction = Cartesian3.subtract(this._targetPosition, this._viewPosition, new Cartesian3());
        Cartesian3.normalize(this._viewCamera.direction, this._viewCamera.direction);
        this._viewCamera.up = Ellipsoid.WGS84.geodeticSurfaceNormal(this._viewPosition);
        this._viewCamera.frustum.aspectRatio = this._scene.canvas.clientWidth / this._scene.canvas.clientHeight;
        this._viewCamera.frustum.fov = Math.PI_OVER_SIX;
        this._viewCamera.frustum.near = 0.05;
        this._viewCamera.frustum.far = Cartesian3.distance(this._viewPosition, this._targetPosition);

        if(this._viewCamera.frustum.near >= this._viewCamera.frustum.far){
            return false;
        }
        if(!this._scene.enableSightline){
            this._scene.enableSightline = true;
        }

        this.update(this._scene.frameState);
        this._polylines.removeAll();
        var appearance = new PolylineMaterialAppearance({
            fragmentShaderSource: SightlineAppearanceFS,
            renderState:RenderState.fromCache({
                depthTest: {
                    enabled: this._sightlineDepthTest
                }
            })
        });
        appearance.uniforms = {
            u_depthTexture: this._sightlineTexture,
            u_visibleColor: this._visibleColor,
            u_invisibleColor: this._invisibleColor,
            u_sightlineMatrix: this._sightlineMatrix
        };
        this._sightlinePrimitive = this._polylines.add(new Primitive({
            geometryInstances : new GeometryInstance({
                geometry : new PolylineGeometry({
                    positions : [this._viewPosition, this._targetPosition],
                    width : 3.0
                }),
                attributes : {
                    color : ColorGeometryInstanceAttribute.fromColor(Color.AQUA)
                }
            }),
            appearance : appearance,
            allowPicking: false
        }));
    };

    /**
     * 结束通视分析
     * @param endPosition
     */
    Sightline.prototype.end = function(endPosition) {
        if (!defined(endPosition)) {
            throw new DeveloperError('结束位置获取失败');
        }
        this.setTargetPosition(endPosition);
    };

    /**
     * 销毁可视分析对象
     */
    Sightline.prototype.destroy = function() {
        this._scene.sightline = null;
        this._scene.enableSightline = false;
        this._sightlineTexture.destroy();
        return destroyObject(this);
    };

    return Sightline;
});


