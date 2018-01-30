/**
 * Created by bingqx on 2018/1/30.
 */
define([
    '../Core/Cartographic',
    '../Core/Color',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Scene/LabelCollection',
],function (
    Cartographic,
    Color,
    defined,
    DeveloperError,
    LabelCollection
) {

    /**
     * 经纬网
     * @constructor
     */
    function Graticule(options) {
        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._scene = options.scene;
        //线宽
        this._lineWidth = 1.0;
        //顶点shader
        this._vertexShaderSource = LonLatGridLineVS;
        //片元shader
        this._fragmentShaderSource = LonLatGridLineFS;
        //合并顶点Shader
        this.CombineShader();
        //图元类型
        this._PrimitiveType = PrimitiveType.LINES;
        var that = this;
        var childUniforms = {
            u_LineColor: function () {
                return that.m_Color;
            }
        };
        this._uniforms = combine(this._uniforms, childUniforms);

        this.m_LonLabels = new Map();
        this.m_LatLabels = new Map();
        this._labelCollection = undefined;

        this.m_scene = undefined;
        this.m_LabelColor = new Color(255, 0, 0, 255);
        this.m_LabelSize = 20;
    }

    Graticule.prototype.CreateLabels = function () {
        this._labelCollection = this._scene.primitives.add(new LabelCollection());
        var ellipsoid = this._scene.globe.ellipsoid;
        var worldPos = ellipsoid.cartographicToCartesian(new Cartographic(0, 0, 0));

        var textArray = ["°N", "°S", "Equator", "Prime meridian", "°E", "°W"];

        //纬线标注
        var preText = undefined;
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
            var label1 = this.m_labelCollection.add({
                position: worldPos,
                text: preText,
                font: this.m_LabelSize.toString() + 'px sans-serif',
                fillColor: this.m_LabelColor
            });
            this.m_LatLabels[lat] = label1;
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
            var label2 = this.m_labelCollection.add({
                position: worldPos,
                text: preText,
                font: this.m_LabelSize.toString() + 'px sans-serif',
                fillColor: this.m_LabelColor
            });
            this.m_LonLabels[lon] = label2;
        }
    }
    return Graticule;
});
