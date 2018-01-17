/**
 * Created by rick on 2018/1/17.
 */
define([
    '../Core/defined',
    '../Core/DeveloperError'
],function (defined,
    DeveloperError) {
    'use strict';
    function HeatMap(options) {
        if (!defined(options.scene)) {
            throw new DeveloperError('options.scene is required.');
        }
        this._scene = options.scene;
        this._weight = options.weight;
    }
    return HeatMap;
});
