
define([
    './Mesh',
    '../../Core/BoundingSphere',
    '../../Core/BoxGeometry',
    '../../Core/Cartesian3',
    '../../Core/ComponentDatatype',
    '../../Core/combine',
    '../../Core/defaultValue',
    '../../Core/defined',
    '../../Core/destroyObject',
    '../../Core/DeveloperError',
    '../../Core/Matrix4',
    '../../Core/VertexFormat',
    '../../Core/PrimitiveType',
    '../../Core/IndexDatatype',
    '../../Core/Ellipsoid',
    '../../Core/Cartographic',
    '../../Core/Color',
    '../../Core/WebGLConstants',
    '../../Renderer/Buffer',
    '../../Renderer/BufferUsage',
    '../../Renderer/DrawCommand',
    '../../Renderer/RenderState',
    '../../Renderer/ShaderProgram',
    '../../Renderer/ShaderSource',
    '../../Renderer/VertexArray',
    '../../Renderer/Pass',
    '../../Scene/BlendingState',
    '../../Scene/CullFace',
    '../../Scene/Material',
    '../../Scene/Scene',
    '../../Scene/Globe',
    '../../Scene/SceneMode',
    '../../Shaders/Extend/CoorConvertVS'
], function (Mesh,
             BoundingSphere,
             BoxGeometry,
             Cartesian3,
             ComponentDatatype,
             combine,
             defaultValue,
             defined,
             destroyObject,
             DeveloperError,
             Matrix4,
             VertexFormat,
             PrimitiveType,
             IndexDatatype,
             Ellipsoid,
             Cartographic,
             Color,
             WebGLConstants,
             Buffer,
             BufferUsage,
             DrawCommand,
             RenderState,
             ShaderProgram,
             ShaderSource,
             VertexArray,
             Pass,
             BlendingState,
             CullFace,
             Material,
             Scene,
             Globe,
             SceneMode,
             CoorConvertVS) {
    'use strict';

    function RenderObject(options) {
        //Primitive.call(this,options);
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        //是否已初始化
        this.m_bInitialized = false;
        //是否渲染网格线
        this.m_bRendWireFrame = false;
        //是否深度检查
        this._depthTestEnabled = defaultValue(options.depthTestEnabled, true);
        //是否显示
        this.show = defaultValue(options.show, true);
        //名称
        this.name = options.name;

        //id号
        this.id = options.id;
        this._id = undefined;

        //材质
        this.material = options.material;
        this._material = undefined;

        //投影类型
        this._projectionType = 0;
        //眼睛到球面的距离
        this._cameraDistance = 0;
        //相机相对位置（高位）
        this._camRefCenterPosHigh = new Cartesian3(0, 0, 0);
        //相机相对位置（低位）
        this._camRefCenterPosLow = new Cartesian3(0, 0, 0);
        //透明度
        this._transparent = 1.0;

        //包围盒
        this._boundingSphere = new BoundingSphere();
        //模型矩阵
        this.modelMatrix = Matrix4.clone(defaultValue(options.modelMatrix, Matrix4.IDENTITY));
        this._modelMatrix = new Matrix4();
        //计算模型矩阵
        this._computedModelMatrix = new Matrix4();

        //顶点shader
        this._vertexShaderSource = options.vertexShaderSource;
        //片元shader
        this._fragmentShaderSource = options.fragmentShaderSource;

        this._sp = undefined;//shaderProgram
        this._rs = undefined;//渲染状态
        this._va = [];//VBO
        this._meshs = [];//mesh数组
        this._drawCommandArray = [];//绘制命令数组

        this._PrimitiveType = PrimitiveType.TRIANGLES;
        this._Pass = Pass.OPAQUE;

        var that = this;
        this._uniforms = {
            u_ProjectionType: function () {
                return that._projectionType;
            },
            u_CameraDistance: function () {
                return that._cameraDistance;
            },
            u_CamRefCenterPosHigh: function () {
                return that._camRefCenterPosHigh;
            },
            u_CamRefCenterPosLow: function () {
                return that._camRefCenterPosLow;
            },
            u_Transparent: function () {
                return that._transparent;
            }
        };
    }

    RenderObject.prototype.addMesh = function (mesh) {
        this._meshs.push(mesh);
    }

    //virtual
    RenderObject.prototype.createMesh = function (context, mesh) {
    }

    //virtual
    RenderObject.prototype.createBuffer = function (context) {
        var i = 0;
        for (i = 0; i < this._meshs.length; ++i) {
            var vertexArray = this.createMesh(context, this._meshs[i]);
            this._va.push(vertexArray);
        }
    }

    //virtual
    RenderObject.prototype.combineShader = function (context) {
        var coorConvertVS = CoorConvertVS;
        var vertexShaderSource = new ShaderSource({
            sources: [coorConvertVS,
                this._vertexShaderSource
            ],
            includeBuiltIns: false
        });
        var vertexShaderText = vertexShaderSource.createCombinedVertexShader(context);
        this._vertexShaderSource = vertexShaderText;
    };

    //virtual
    RenderObject.prototype.initialize = function (context) {
        //创建渲染状态
        if (!defined(this._rs)) {
            this._rs = RenderState.fromCache({
                blending: BlendingState.ALPHA_BLEND,
                depthMask: false,//深度是否可写
                depthTest: {
                    enabled: true
                }
            });
        }
        //创建缓存区
        this.createBuffer(context);
        return true;
    };

    //virtual
    RenderObject.prototype.startRender = function (frameState) {
        if (!this.show) {
            return false;
        }
        //相机距离和场景模式
        if (frameState.mode === SceneMode.SCENE3D) {
            this._projectionType = 0;
            this.m_dCameraDistance = frameState.camera.lookAtDistance;
        }
        else if (frameState.mode === SceneMode.SCENE2D) {
            this._projectionType = 2;
            //this.m_dCameraDistance = frameState.camera.positionCartographic.height;
        }
        else if (frameState.mode === SceneMode.COLUMBUS_VIEW) {
            this._projectionType = 2;
            this.m_dCameraDistance = frameState.camera.positionCartographic.height;
        }

        if (!defined(this.material)) {
            throw new DeveloperError('this.material must be defined.');
        }

        var context = frameState.context;

        //在渲染之前必须创建好顶点和顶点缓存，否则不能渲染
        if (!this.m_bInitialized) {
            this.m_bInitialized = this.initialize(context);
        }
        if (!this.m_bInitialized) {
            return false;
        }
        if (this._va.length == 0) {
            return false;
        }
        if (this.m_bRendWireFrame) {
            //渲染网格
        }

        //TODO眼睛到球面的距离
        //this.m_dCameraDistance = how much?;
        //TODO相机参考位置点
        // DoubleToTwoFloat(pCamera->GetReferenceCenter(), this._camRefCenterPosHigh, this._camRefCenterPosLow);
        return true;
    }

    //virtual渲染
    RenderObject.prototype.update = function (frameState) {
        var bSuccess = this.startRender(frameState);
        if (!bSuccess) {
            return false;
        }
        var context = frameState.context;

        var materialChanged = this._material !== this.material;
        this._material = this.material;
        this._material.update(context);

        // Recompile shader when material, lighting, or translucency changes
        if (materialChanged) {
            //先清空数组
            this._drawCommandArray.splice(0, this._drawCommandArray.length);
            //创建shader程序
            this._sp = ShaderProgram.fromCache({
                context: context,
                vertexShaderSource: this._vertexShaderSource,
                fragmentShaderSource: this._fragmentShaderSource,
                attributeLocations: this._va.attributes
            });
            //绘制命令
            for (var i = 0; i < this._va.length; ++i) {
                var colorCommand = new DrawCommand({
                    primitiveType: this._PrimitiveType,
                    boundingVolume: new BoundingSphere(),
                    owner: this
                });
                colorCommand.vertexArray = this._va[i];
                colorCommand.renderState = this._rs;
                colorCommand.shaderProgram = this._sp;
                colorCommand.uniformMap = combine(this._uniforms, this.material._uniforms);
                colorCommand.executeInClosestFrustum = false;
                this._drawCommandArray.push(colorCommand);
            }
        }

        if (defined(this._material)) {
            if (!this._material.isTextureLoaded()) {
                return;
            }
        }

        this._boundingSphere = new BoundingSphere(new Cartesian3(0.0, 0.0, 0.0), 6378137.0 + 200000000.0);
        this._computedModelMatrix = Matrix4.clone(Matrix4.IDENTITY);
        this.debugShowBoundingVolume = new BoundingSphere(new Cartesian3(0.0, 0.0, 0.0), 6378137.0 + 200000000.0);

        var commandList = frameState.commandList;
        var passes = frameState.passes;

        if (passes.render) {
            for (var j = 0; j < this._drawCommandArray.length; ++j) {
                var colorCommandj = this._drawCommandArray[j];
                colorCommandj.boundingVolume = this._boundingSphere;
                colorCommandj.modelMatrix = this._computedModelMatrix;
                colorCommandj.pass = this._Pass;
                commandList.push(colorCommandj);
            }
        }
        this.endRender(frameState);
        return bSuccess;
    }

    //virtual
    RenderObject.prototype.endRender = function (frameState) {
        if (this.m_bRendWireFrame) {

        }
        return true;
    }

    RenderObject.prototype.destroy = function () {
        var length;
        var i;
        var va = this._va;
        length = va.length;
        for (i = 0; i < length; ++i) {
            va[i].destroy();
        }
        this._va = undefined;

        return destroyObject(this);
    };

    RenderObject.prototype.setPass = function (pass) {
        this._Pass = pass;
    }

    //设置透明度
    RenderObject.prototype.setTransparent = function (nTrans) {
        this._transparent = nTrans;
    };

    //设置是否可见
    RenderObject.prototype.setVisible = function (bVisible) {
        this.show = bVisible;
    }

    return RenderObject;
});
