/**
 * Created by bingqx on 2018/1/30.
 */
define([
    './Core/Mesh',
    './Core/RenderObject',
    '../Core/Cartesian2',
    '../Core/Cartographic',
    '../Core/Color',
    '../Core/combine',
    '../Core/ComponentDatatype',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Core/IndexDatatype',
    '../Core/Math',
    '../Core/PrimitiveType',
    '../Renderer/Buffer',
    '../Renderer/BufferUsage',
    '../Renderer/VertexArray',
    '../Scene/LabelCollection',
    '../Scene/Material',
    '../Shaders/Extend/GraticuleFS',
    '../Shaders/Extend/GraticuleVS'
],function (
    Mesh,
    RenderObject,
    Cartesian2,
    Cartographic,
    Color,
    combine,
    ComponentDatatype,
    defined,
    DeveloperError,
    IndexDatatype,
    Math,
    PrimitiveType,
    Buffer,
    BufferUsage,
    VertexArray,
    LabelCollection,
    Material,
    GratituleFS,
    GratituleVS
) {

    'use strict';

    /**
     * 经纬网
     * @param {Object} options
     * @param {Scene} options.scene 场景
     * @param {Boolean} [options.depthTestEnabled] 是否开启深度测试
     * @param {Boolean} [options.show] 是否显示
     * @param {String} [options.name] 对象名称
     * @param {Number} [options.id] 对象ID
     * @constructor
     */
    function Graticule(options) {
        // 继承RenderObject类
        RenderObject.call(this, options);

        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._scene = options.scene;
        //线宽
        this._lineWidth = 1.0;
        this._lineColor = new Color(255, 255, 0, 255);
        //顶点shader
        this._vertexShaderSource = GratituleVS;
        //片元shader
        this._fragmentShaderSource = GratituleFS;
        //合并顶点Shader
        this.combineShader(this._scene.context);
        //图元类型
        this._PrimitiveType = PrimitiveType.LINES;
        var that = this;
        var childUniforms = {
            u_LineColor: function () {
                return that._lineColor;
            }
        };
        this._uniforms = combine(this._uniforms, childUniforms);

        this._lonLabels = {};
        this._latLabels = {};
        this._labelCollection = undefined;

        this.labelColor = new Color(255, 0, 0, 255);
        this.labelSize = 20;

        this.material = new Material();

        this.startRender(this._scene.frameState);
    }

    Graticule.prototype = new RenderObject();

    Graticule.prototype.createMesh = function (context, mesh) {
        var attributeLocations = {
            Position: 0,
            HLevel: 1
        };
        //创建mesh
        var buffer1 = Buffer.createVertexBuffer({
            context: context,
            typedArray: mesh.m_vertexs,
            usage: BufferUsage.STATIC_DRAW
        });

        var indexBuffer = Buffer.createIndexBuffer({
            context: context,
            typedArray: mesh.m_indices,
            usage: BufferUsage.STATIC_DRAW,
            indexDatatype: IndexDatatype.UNSIGNED_SHORT
        });

        var iSizeInBytes1 = Float32Array.BYTES_PER_ELEMENT;
        var iStride1 = 3 * iSizeInBytes1;

        var attributes = [
            {
                index: attributeLocations.Position,
                vertexBuffer: buffer1,
                componentsPerAttribute: 2,
                componentDatatype: ComponentDatatype.FLOAT,
                offsetInBytes: 0,
                strideInBytes: iStride1
            },
            {
                index: attributeLocations.HLevel,
                vertexBuffer: buffer1,
                componentsPerAttribute: 1,//tag此值和shader里的属性数据类型相关
                componentDatatype: ComponentDatatype.FLOAT,//tag此值和shader里的属性数据类型相关
                normalize: false,
                offsetInBytes: 2 * iSizeInBytes1,
                strideInBytes: iStride1
            }
        ];
        var vertexArray = new VertexArray({
            context: context,
            attributes: attributes,
            indexBuffer: indexBuffer
        });
        return vertexArray;
    };

    Graticule.prototype.initialize = function (context) {
        this.createGirdLines();
        this.createLabels();
        return RenderObject.prototype.initialize.call(this, context);
    };

    var labelGeoPos = new Cartographic();

    Graticule.prototype.startRender = function (frameState) {
        var bResult = RenderObject.prototype.startRender.call(this, frameState);
        if (bResult === false) {
            return false;
        }
        var centerLonLat = frameState.camera.positionCartographic;
        var ellipsoid = frameState.camera._scene.globe.ellipsoid;

        this._cameraDistance = frameState.camera._measuringScale * 500;
        for (var itr1 in this._lonLabels) {
            var lon = parseFloat(itr1);
            if (this._cameraDistance > 20000000.0 && (Math.mod(lon, 32.0) > 0.0)) {
                this._lonLabels[itr1].show = false;
            }
            else if (this._cameraDistance > 3200000.0 && (Math.mod(lon, 16.0) > 0.0)) {
                this._lonLabels[itr1].show = false;
            }
            else if (this._cameraDistance > 2000000.0 && (Math.mod(lon, 4.0) > 0.0)) {
                this._lonLabels[itr1].show = false;
            }
            else if (this._cameraDistance > 1000000.0 && (Math.mod(lon, 2.0) > 0.0)) {
                this._lonLabels[itr1].show = false;
            }
            else {
                labelGeoPos = Cartographic.fromDegrees(lon, 0, 10);
                labelGeoPos.latitude = centerLonLat.latitude;
                this._lonLabels[itr1].show = true;
                this._lonLabels[itr1].position = ellipsoid.cartographicToCartesian(labelGeoPos);
            }
        }
        for (var itr2 in this._latLabels) {
            var lat = parseFloat(itr2);
            if (this._cameraDistance > 3200000.0 && (Math.mod(lat, 16.0) > 0.0)) {
                this._latLabels[itr2].show = false;
            }
            else if (this._cameraDistance > 2000000.0 && (Math.mod(lat, 4.0) > 0.0)) {
                this._latLabels[itr2].show = false;
            }
            else if (this._cameraDistance > 1000000.0 && (Math.mod(lat, 2.0) > 0.0)) {
                this._latLabels[itr2].show = false;
            }
            else {
                labelGeoPos = Cartographic.fromDegrees(0, lat, 10);
                labelGeoPos.longitude = centerLonLat.longitude;
                this._latLabels[itr2].show = true;
                this._latLabels[itr2].position = ellipsoid.cartographicToCartesian(labelGeoPos);
            }
        }
        return bResult;
    };

    var dStartLon = -180;
    var dStartLat = 90;
    var iSizeX = 181;
    var iSizeY = 91;
    var dIntervalX = 360 / (iSizeX - 1);
    var dIntervalY = -180 / (iSizeY - 1);

    var iVByteIndex = 0;
    var iIByteIndex = 0;
    var iCurVCount = 0;
    var geoPos = new Cartesian2();

    Graticule.prototype.createGirdLines = function () {
        iVByteIndex = 0;
        iIByteIndex = 0;
        iCurVCount = 0;
        //纬线
        var latMesh = new Mesh();
        latMesh.m_vertexs = new Float32Array(iSizeX * iSizeY * 3);
        latMesh.m_indices = new Uint16Array((iSizeX - 1) * 2 * iSizeY);
        for (let iy = 0; iy < iSizeY; ++iy) {
            geoPos.y = dStartLat + iy * dIntervalY;
            for (let ix = 0; ix < iSizeX; ++ix) {
                geoPos.x = dStartLon + ix * dIntervalX;
                latMesh.m_vertexs[iVByteIndex++] = geoPos.x;
                latMesh.m_vertexs[iVByteIndex++] = geoPos.y;
                latMesh.m_vertexs[iVByteIndex++] = geoPos.y;
                iCurVCount++;

                if (ix < iSizeX - 1) {
                    latMesh.m_indices[iIByteIndex++] = iCurVCount - 1;
                    latMesh.m_indices[iIByteIndex++] = iCurVCount;
                }
            }
        }
        this._meshs.push(latMesh);

        iVByteIndex = 0;
        iIByteIndex = 0;
        iCurVCount = 0;

        var iTempSizeX = iSizeX;
        //经线
        var lonMesh = new Mesh();
        lonMesh.m_vertexs = new Float32Array(iTempSizeX * iSizeY * 3);
        lonMesh.m_indices = new Uint16Array((iSizeY - 1) * 2 * iTempSizeX);
        for (let ix = 0; ix < iTempSizeX; ++ix) {
            geoPos.x = dStartLon + ix * dIntervalX;
            for (let iy = 0; iy < iSizeY; ++iy) {
                geoPos.y = dStartLat + iy * dIntervalY;
                lonMesh.m_vertexs[iVByteIndex++] = geoPos.x;
                lonMesh.m_vertexs[iVByteIndex++] = geoPos.y;
                lonMesh.m_vertexs[iVByteIndex++] = geoPos.x;
                iCurVCount++;

                if (iy < iSizeY - 1) {
                    lonMesh.m_indices[iIByteIndex++] = iCurVCount - 1;
                    lonMesh.m_indices[iIByteIndex++] = iCurVCount;
                }
            }
        }
        this._meshs.push(lonMesh);
    };

    Graticule.prototype.createLabels = function () {
        this._labelCollection = this._scene.primitives.add(new LabelCollection());
        var ellipsoid = this._scene.globe.ellipsoid;
        var worldPos = ellipsoid.cartographicToCartesian(new Cartographic(0, 0, 0));

        var textArray = ['°N', '°S', 'Equator', 'Prime meridian', '°E', '°W'];

        //纬线标注
        var preText;
        for (var iy = 0; iy < iSizeY; ++iy) {
            var lat = dStartLat + iy * dIntervalY;
            if (lat > 0) {
                preText = lat.toString() + textArray[0].toString();
            }
            else if (lat < 0) {
                preText = lat.toString() + textArray[1].toString();
            }
            else {
                preText = textArray[2].toString();
            }
            var label1 = this._labelCollection.add({
                position: worldPos,
                text: preText,
                font: this.labelSize.toString() + 'px sans-serif',
                fillColor: this.labelColor
            });
            this._latLabels[lat] = label1;
        }
        //经线标注
        for (var ix = 0; ix < iSizeX - 1; ++ix) {
            var lon = dStartLon + ix * dIntervalX;
            if (lon === 0) {
                preText = textArray[3].toString();
            }
            else if (lon > 0) {
                preText = lon.toString() + textArray[4].toString();
            }
            else if (lon < 0) {
                preText = lon.toString() + textArray[5].toString();
            }
            var label2 = this._labelCollection.add({
                position: worldPos,
                text: preText,
                font: this.labelSize.toString() + 'px sans-serif',
                fillColor: this.labelColor
            });
            this._lonLabels[lon] = label2;
        }
    };

    /**
     * 销毁对象
     */
    Graticule.prototype.destroy = function () {
        if (this._scene === undefined) {
            return;
        }
        this._scene.primitives.remove(this._labelCollection);
        RenderObject.prototype.destroy.call(this);
    };

    return Graticule;
});
