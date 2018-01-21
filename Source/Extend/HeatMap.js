/**
 * Created by bingqx on 2018/1/16.
 */
define([
    '../Core/Cartesian3',
    '../Core/Cartographic',
    '../Core/Credit',
    '../Core/defaultValue',
    '../Core/defined',
    '../Core/defineProperties',
    '../Core/DeveloperError',
    '../Core/Event',
    '../Core/GeographicTilingScheme',
    '../Core/GeometryInstance',
    '../Core/Math',
    '../Core/Rectangle',
    '../Core/RectangleGeometry',
    '../Core/TileProviderError',
    '../Core/WebMercatorProjection',
    '../Scene/Material',
    '../Scene/MaterialAppearance',
    '../Scene/Primitive',
    '../ThirdParty/heatmap'
], function(
    Cartesian3,
    Cartographic,
    Credit,
    defaultValue,
    defined,
    defineProperties,
    DeveloperError,
    Event,
    GeographicTilingScheme,
    GeometryInstance,
    CesiumMath,
    Rectangle,
    RectangleGeometry,
    TileProviderError,
    WebMercatorProjection,
    Material,
    MaterialAppearance,
    Primitive,
    h337) {
    "use strict";

    var HeatMapDefaults = {
        minCanvasSize: 700,  //热力图最小像素数
        maxCanvasSize: 2000, //热力图最大像素数
        radiusFactor: 60,  //如果没有给定半径而使用的半径因子（用宽和高中最大的那个来除以这个数所得的值来当做半径）
        spacingFactor: 1.5,  //额外的边界空间（点半径乘以这个数得到的值来扩展边界）
        maxOpacity: 0.8,  //最大透明度
        minOpacity: 0.1,  //最小透明度
        blur: 0.85,  //模糊度
        gradient: {   //渐进色
            '.3': 'green',
            '.45': 'blue',
            '.65': 'yellow',
            '.8': 'orange',
            '.95': 'red'
        }
    };

    var wmp = new WebMercatorProjection();

    /**
     * 热力图类
     * @param viewer
     * @param bbox  热力图边界范围
     * @param options 热力图参数
     * @constructor
     * @example
     * var viewer = new Cesium.Viewer("earth");
     var boundingBox = {
                north: 37.5,
                south: 35.5,
                east: -116,
                west: -118
            };
     var points = [{
                x: -116.6455469,
                y: 36.7355928,
                value: 100
            }, {
                x: -117.6455469,
                y: 35.7355928,
                value: 75
            }, {
                x: -117.1455469,
                y: 35.9855928,
                value: 50
            }];
     const hm = new World3D.HeatMap(viewer, boundingBox);
     hm.setWGS84Data(1, 100, points);
     */
    function HeatMap(options) {
        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._hmoptions = {};
        this._scene = options.scene;
        this._id = this._getID();
        this._bounds = this._wgs84ToMercatorBbox(options.bbox);
        this._setWidthAndHeight(this._bounds);
        this._currentLevel = getCenterLevel(this._scene);

        this._hmoptions.gradient = defaultValue(options.gradient, HeatMapDefaults.gradient);
        this._hmoptions.maxOpacity = defaultValue(options.maxOpacity, HeatMapDefaults.maxOpacity);
        this._hmoptions.minOpacity = defaultValue(options.minOpacity, HeatMapDefaults.minOpacity);
        this._hmoptions.blur = defaultValue(options.blur, HeatMapDefaults.blur);
        this._hmoptions.radius = (20 - this._currentLevel) * 3;

        this._spacing = this._hmoptions.radius * HeatMapDefaults.spacingFactor;
        this._xoffset = this._bounds.west;
        this._yoffset = this._bounds.south;

        this.width = Math.round(this.width + this._spacing * 2);
        this.height = Math.round(this.height + this._spacing * 2);

        this._bounds.west -= this._spacing * this._factor;
        this._bounds.east += this._spacing * this._factor;
        this._bounds.south -= this._spacing * this._factor;
        this._bounds.north += this._spacing * this._factor;

        this._wbounds = this._mercatorToWgs84Bbox(this._bounds);

        this._rectangle = Rectangle.fromDegrees(this._wbounds.west, this._wbounds.south, this._wbounds.east, this._wbounds.north);
        this._hmoptions.container = this._container = this._getContainer();
        // this._heatmap = h337.create(Object.assign(HeatMapDefaults, this._hmoptions));
        this._heatmap = h337.create(Object.assign(this._hmoptions, {radius: 40000/(this._currentLevel*this._currentLevel*this._currentLevel)}));
        this._container.children[0].setAttribute('id', this._id + '-hm');
    }
    /**
     * 生成ID
     * @param len ID长度，可选，默认为8
     * @returns {string} ID
     * @private
     */
    HeatMap.prototype._getID = function (len) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for ( let i = 0; i < ((len) ? len : 8); i++ ) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    };

    /**
     * 将wgs84范围转成墨卡托范围
     * @param bbox WGS84的范围
     * @returns {{north: (*|Number), east: (*|Number), south: (*|Number), west: (*|Number)}}
     * @private
     */
    HeatMap.prototype._wgs84ToMercatorBbox = function (bbox) {
        var ws = wmp.project(Cartographic.fromDegrees(bbox.west, bbox.south));
        var en = wmp.project(Cartographic.fromDegrees(bbox.east, bbox.north));
        return {
            north: en.y,
            east: en.x,
            south: ws.y,
            west: ws.x
        };
    };

    /**
     * 将墨卡托范围转成WGS84的范围
     * @param bbox 墨卡托的范围
     * @returns {{north, east, south, west}}
     * @private
     */
    HeatMap.prototype._mercatorToWgs84Bbox = function (bbox) {
        var ws = wmp.unproject(new Cartesian3(bbox.west, bbox.south));
        var en = wmp.unproject(new Cartesian3(bbox.east, bbox.north));
        return {
            north: CesiumMath.toDegrees(en.latitude),
            east: CesiumMath.toDegrees(en.longitude),
            south: CesiumMath.toDegrees(ws.latitude),
            west: CesiumMath.toDegrees(ws.longitude)
        };
    };

    /**
     * 计算热力图的宽高
     * @param bounds
     * @private
     */
    HeatMap.prototype._setWidthAndHeight = function (bounds) {
        this.width = ((bounds.east > 0 && bounds.west < 0) ? bounds.east + Math.abs(bounds.west) : Math.abs(bounds.east - bounds.west));
        this.height = ((bounds.north > 0 && bounds.south < 0) ? bounds.north + Math.abs(bounds.south) : Math.abs(bounds.north - bounds.south));
        this._factor = 1;

        if (this.width > this.height && this.width > HeatMapDefaults.maxCanvasSize) {
            this._factor = this.width / HeatMapDefaults.maxCanvasSize;

            if (this.height / this._factor < HeatMapDefaults.minCanvasSize) {
                this._factor = this.height / HeatMapDefaults.minCanvasSize;
            }
        } else if (this.height > this.width && this.height > HeatMapDefaults.maxCanvasSize) {
            this._factor = this.height / HeatMapDefaults.maxCanvasSize;

            if (this.width / this._factor < HeatMapDefaults.minCanvasSize) {
                this._factor = this.width / HeatMapDefaults.minCanvasSize;
            }
        } else if (this.width < this.height && this.width < HeatMapDefaults.minCanvasSize) {
            this._factor = this.width / HeatMapDefaults.minCanvasSize;

            if (this.height / this._factor > HeatMapDefaults.maxCanvasSize) {
                this._factor = this.height / HeatMapDefaults.maxCanvasSize;
            }
        } else if (this.height < this.width && this.height < HeatMapDefaults.minCanvasSize) {
            this._factor = this.height / HeatMapDefaults.minCanvasSize;

            if (this.width / this._factor > HeatMapDefaults.maxCanvasSize) {
                this._factor = this.width / HeatMapDefaults.maxCanvasSize;
            }
        }

        this.width = this.width / this._factor;
        this.height = this.height / this._factor;
    };

    /**
     * 创建一个热力图的容器div
     * @returns {Element} 热力图的容器div
     * @private
     */
    HeatMap.prototype._getContainer = function () {
        var div = document.createElement('div');
        if (this._id) {
            div.setAttribute('id', this._id);
        }
        div.setAttribute('style', 'width: ' + this.width + 'px;height: ' + this.height + 'px; margin: 0px; display: none;');
        document.body.appendChild(div);
        return div;
    };

    /**
     * 添加WGS84类型的数据源
     * @param min 数据最小值
     * @param max 数据最大值
     * @param data 数据源
     * @returns {boolean} true为加载成果，false为加载失败
     */
    HeatMap.prototype.setWGS84Data = function (min, max, data) {
        if (data && data.length > 0 && defined(min) && defined(max)) {
            var convdata = [];

            for ( var i = 0; i < data.length; i++ ) {
                var gp = data[i];

                var hp = this._wgs84PointToHeatmapPoint(gp);
                if (gp.value || gp.value === 0) {
                    hp.value = gp.value;
                }
                convdata.push(hp);
            }
            return this.setData(min, max, convdata);
        }
        return false;
    };

    /**
     * 将WGS84的点位置转成热力图上的点位置
     * @param pos
     * @private
     */
    HeatMap.prototype._wgs84PointToHeatmapPoint = function (pos) {
        var result = Cartographic.fromDegrees(pos.x, pos.y);
        return this._mercatorPointToHeatmapPoint(wmp.project(result));
    };

    /**
     * 将墨卡托类型的点位置转成热力图上的点位置
     * @param pos
     * @returns {{}}
     * @private
     */
    HeatMap.prototype._mercatorPointToHeatmapPoint = function (pos) {
        var pn = {};

        pn.x = Math.round((pos.x - this._xoffset) / this._factor + this._spacing);
        pn.y = Math.round((pos.y - this._yoffset) / this._factor + this._spacing);
        pn.y = this.height - pn.y;

        return pn;
    };

    /**
     * 将数据源加载到热力图上
     * @param min 数据最小值
     * @param max 数据最大值
     * @param data 数据源
     * @returns {boolean}
     */
    HeatMap.prototype.setData = function (min, max, data) {
        if (data && data.length > 0 && defined(min) && defined(max)) {
            this._heatmap.setData({
                min: min,
                max: max,
                data: data
            });
            this._updateLayer();
            var that = this;
            this.event = function (){
                var level = getCenterLevel(that._scene);
                if (level !== that._currentLevel) {
                    that._heatmap = h337.create(Object.assign(that._hmoptions, {radius: 40000/(level * level * level)}));
                    // this._heatmap.configure({radius: (20 - level) * 5});
                    that._heatmap.setData({
                        min: min,
                        max: max,
                        data: data
                    });
                    that._updateLayer();
                    that._currentLevel = level;
                }
            };
            this._scene.postRender.addEventListener(this.event);
            // this._viewer.scene.camera.moveEnd.addEventListener(this.event);
            return true;
        }
        return false;
    };

    /**
     * 更新图层
     * @private
     */
    HeatMap.prototype._updateLayer = function () {
        if (this._scene.primitives) {
            if (this._layer) {
                this._layer.appearance.material = new Material({
                    fabric: {
                        uniforms: {
                            image: this._heatmap._renderer.canvas
                        },
                        materials: {
                            bumpMap: {
                                type: 'BumpMap'
                            }
                        },
                        source: 'czm_material czm_getMaterial(czm_materialInput materialInput) {' +
                        'czm_material material = czm_getDefaultMaterial(materialInput);' +
                        'vec4 heightValue = texture2D(image, materialInput.st);' +
                        'if(heightValue.r<1.0/255.0) heightValue.a= 0.0; ' +
                        'material.diffuse = vec3(heightValue.r,heightValue.g,heightValue.b);' +
                        'material.alpha = heightValue.a;' +
                        'material.normal = bumpMap.normal;' +
                        'material.specular = 0.0;' +
                        'material.shininess = 8.0;' +
                        'return material;' +
                        '}'
                    }
                });
            } else {
                this._layer = this._scene.primitives.add(new Primitive({
                    geometryInstances: new GeometryInstance({
                        geometry: new RectangleGeometry({
                            rectangle: this._rectangle
                        })
                    }),
                    appearance: new MaterialAppearance({
                        material: new Material({
                            fabric: {
                                uniforms: {
                                    image: this._heatmap._renderer.canvas
                                },
                                materials: {
                                    bumpMap: {
                                        type: 'BumpMap'
                                    }
                                },
                                source: 'czm_material czm_getMaterial(czm_materialInput materialInput) {' +
                                'czm_material material = czm_getDefaultMaterial(materialInput);' +
                                'vec4 heightValue = texture2D(image, materialInput.st);' +
                                'if(heightValue.r<1.0/255.0) heightValue.a= 0.0; ' +
                                'material.diffuse = vec3(heightValue.r,heightValue.g,heightValue.b);' +
                                'material.alpha = heightValue.a;' +
                                'material.normal = bumpMap.normal;' +
                                'material.specular = 0.0;' +
                                'material.shininess = 8.0;' +
                                'return material;' +
                                '}'
                            }
                        })
                    })
                }))
            }
        }
    };

    /**
     * 移除热力图层
     */
    HeatMap.prototype.destory = function () {
        this._scene.primitives.remove(this._layer);
        this._scene.postRender.removeEventListener(this.event);
    };

    function getCenterLevel(scene) {
        var selectedTile;
        var ellipsoid = scene.globe.ellipsoid;
        var cartesian = scene.camera.pickEllipsoid({
            x : scene.canvas.width / 2,
            y : scene.canvas. height / 2
        }, ellipsoid);

        if (defined(cartesian)) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            var tilesRendered = scene.globe._surface.tileProvider._tilesToRenderByTextureCount;
            for (var textureCount = 0; !selectedTile && textureCount < tilesRendered.length; ++textureCount) {
                var tilesRenderedByTextureCount = tilesRendered[textureCount];
                if (!defined(tilesRenderedByTextureCount)) {
                    continue;
                }
                for (var tileIndex = 0; !selectedTile && tileIndex < tilesRenderedByTextureCount.length; ++tileIndex) {
                    var tile = tilesRenderedByTextureCount[tileIndex];
                    if (Rectangle.contains(tile.rectangle, cartographic)) {
                        selectedTile = tile;
                    }
                }
            }
            return selectedTile ? selectedTile._level: 0;
        }else{
            return 0;
        }

    }

    return HeatMap;
});
