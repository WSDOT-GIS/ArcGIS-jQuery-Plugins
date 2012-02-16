/*jslint windows: true, devel: true, browser: true, white: true, nomen: true, maxerr: 50, indent: 4 */
/*global jQuery, dojo, esri */

/* 
 * Copyright 2011 Washington State Department of Transportation
 * Licensed under the MIT License (http://www.opensource.org/licenses/MIT)
 */

/// <reference path="http://ajax.aspnetcdn.com/ajax/jQuery/jquery-1.6.2-vsdoc.js" />
/// <reference path="http://ajax.aspnetcdn.com/ajax/jquery.ui/1.8.15/jquery-ui.js"/>
/// <reference path="http://serverapi.arcgisonline.com/jsapi/arcgis/?v=2.6compact"/>

(function ($) {
    "use strict";
    function getLayerConstructor(layerType) {
        ///<summary>Returns a constructor for a specific type of layer.</summary>
        if (typeof (layerType) === "string") {
            if (/(?:esri\.layers\.)?ArcGISTiledMapServiceLayer/i.test(layerType)) {
                return esri.layers.ArcGISTiledMapServiceLayer;
            } else if (/(?:esri\.layers\.)?ArcGISDynamicMapServiceLayer/i.test(layerType)) {
                return esri.layers.ArcGISDynamicMapServiceLayer;
            } else if (/(?:esri\.layers\.)?ArcGISImageServiceLayer/i.test(layerType)) {
                return esri.layers.ArcGISImageServiceLayer;
            } else if (/(?:esri\.layers\.)?FeatureLayer/i.test(layerType)) {
                return esri.layers.FeatureLayer;
            } else if (/(?:esri\.layers\.)?KMLLayer/i.test(layerType)) {
                return esri.layers.KMLLayer;
            } else if (/(?:esri\.virtualearth\.)?VETiledLayer/i.test(layerType)) {
                return esri.virtualearth.VETiledLayer;
            } else {
                throw new Error("Unsupported layer type.");
            }
        } else if (typeof (layerType) === "function") {
            return layerType;
        }
    }

    function createLayer(layerDef) {
        var constructor = getLayerConstructor(layerDef.type);
        if (layerDef.url) {
            return constructor(layerDef.url, layerDef.options);
        } else {
            return constructor(layerDef.options);
        }
    }

    $.widget("ui.arcGisMap", {
        options: {
            apiUrl: "http://serverapi.arcgisonline.com/jsapi/arcgis/?v=2.7compact",
            extent: { "xmin": -14402710.641319368, "ymin": 5436246.03029616, "xmax": -12445922.717219383, "ymax": 6479458.5923319645, "spatialReference": { "wkid": 102100} },
            layers: null, /* [
                {
                    url: "http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                    type: "esri.layers.ArcGISTiledMapServiceLayer"
                }
            ], */
            // layers: An array of objects that defines a "type" of layer, a "url", and (optionally) "options". 
            logo: true,
            lods: null,
            wrapAround180: false,
            setupResizeEvent: true,
            dijitStyleSheet: null //"http://serverapi.arcgisonline.com/jsapi/arcgis/2.7/js/dojo/dijit/themes/claro/claro.css"
        },
        map: null,
        _getDijitClass: function () {
            /// <summary>Gets the name of the theme from the dijitStyleSheet option.</summary>
            /// <returns type="String" />
            var styleRe, match;
            if (this.options.dijitStyleSheet) {
                styleRe = /(\w+)\.css/i;
                match = styleRe.exec(this.options.dijitStyleSheet);
                if (match.length > 1) {
                    return match[1];
                }
            }
            return null;
        },
        getMap: function () {
            /// <summary>Returns the ArcGIS JavaScript API esri.Map object.</summary>
            /// <returns type="esri.Map" />
            return this.map;
        },
        getMapProperty: function (propertyName) {
            ///<summary>Gets a property from the underlying esri.Map object.</summary>
            return this.map[propertyName];
        },
        setMapProperty: function (propertyName, value) {
            ///<summary>Sets the value of a property of the underlying esri.Map object.</summary>
            this.map[propertyName] = value;
        },
        connectMapEvent: function (eventName, handler) {
            return dojo.connect(this.map, eventName, handler);
        },
        callMapFunction: function (functionName) {
            ///<summary>Calls a function of the underlying esri.Map object.</summary>
            ///<param name="functionName">The name of the function.</param>
            // Convert the arguments into an array.
            var args, argumentsArray = Array.prototype.slice.call(arguments);
            // Get the arguments, excluding the function name (the first arg.).
            args = argumentsArray.slice(1);
            // Call the specified function, passing in the other arguments.
            if (this.map) {
                return this.map[functionName].apply(this.map, args);
            }
        },
        _setOption: function (key, value) {
            // If the option that is being set is "extent"...
            if (key === "extent") {
				// If it is not an esri.geometry.Extent, convert it to that type.
                if (value && (!value.isInstanceOf || !value.isInstanceOf(esri.geometry.Extent))) {
                    value = new esri.geometry.Extent(value);
                }
                // Set the map's extent to the new value.
                this.map.setExtent(value);
            }
            // Call the base _setOption function.
            $.Widget.prototype._setOption.apply(this, arguments);
        },
        _layerUpdatingCount: 0,
        _progressBar: null,
        _create: function () {
            var self = this, layerUpdateStart, layerUpdateEnd;

            layerUpdateStart = function () {
                if (self._progressBar !== null) {
                    self._progressBar.show();
                }
                self._layerUpdatingCount += 1;
            };

            layerUpdateEnd = function (error) {
                self._layerUpdatingCount -= 1;
                if (self._layerUpdatingCount < 1 && self._progressBar !== null) {
                    self._progressBar.hide();
                }
            };


            function init() {
                /// <summary>Initializes the creation of the map control.</summary>

                // Check to see if a dijitStyleSheet option was provided.
                if (self.options.dijitStyleSheet) {
                    // If the stylesheet is not already in the document's head, add it now.
                    if ($("link[href='" + self.options.dijitStyleSheet + "']").length < 1) {
                        $('<link rel="stylesheet" type="text/css" href="http://serverapi.arcgisonline.com/jsapi/arcgis/2.5/js/dojo/dijit/themes/claro/claro.css">').appendTo("head");
                    }
                    var dijitClass = self._getDijitClass();
                    $(self.element).addClass(dijitClass);
                }

                // Set the extent option to an Extent object if it is not already.
                if (self.options.extent && (!self.options.extent.isInstanceOf || !self.options.extent.isInstanceOf(esri.geometry.Extent))) {
                    self.options.extent = new esri.geometry.Extent(self.options.extent);
                }

                // Create the map object.
                self.map = new esri.Map(self.element[0], {
                    extent: self.options.extent,
                    logo: self.options.logo,
                    lods: self.options.lods,
                    wrapAround180: self.options.wrapAround180
                });

                // Trigger this widget's mapLoad event when the map objects onLoad event occurs.
                dojo.connect(self.map, "onLoad", function (map) {
                    // Trigger this widget's map load event.
                    self._trigger("mapLoad", this.element, map);

                    esri.dijit.Scalebar({
                        map: map
                    });

                    // Resize the map when the window is resized.
                    if (self.options.setupResizeEvent) {
                        $(window).resize(function() { map.resize(); });
                    }

                    // Create the progress bar that is displayed when layers are loading.
                    self._progressBar = $("<progress style='position: absolute; top: 3px; left: 69px; z-index:30'>Loading...</progress>").appendTo(map.root);
                });

                // For each of the layer definitions, create the layer and then add it to the map.
                dojo.forEach(self.options.layers, function (layerDef) {
                    var layer;
                    // Try to create the layer.  If an error occurs, trigger an event and go to the next layer definition.
                    try {
                        layer = createLayer(layerDef);
                    } catch (e) {
                        self._trigger("layerCreateError", self, {
                            layerDef: layerDef,
                            error: e
                        });
                        return;
                    }

                    // Try to add the new layer to the map.  If that fails, trigger an event.
                    try {
                        self.map.addLayer(layer);
                    } catch (e2) {
                        self._trigger("layerAddError", self, {
                            layerDef: layerDef,
                            error: e2
                        });
                        return;
                    }

                    // Connect events to the layer.
                    dojo.connect(layer, "onUpdateStart", layerUpdateStart);
                    dojo.connect(layer, "onUpdateEnd", layerUpdateEnd);
                });

                self.map.resize();
            }

            function callDojoRequire() {
                dojo.require("esri.map");
                dojo.require("esri.dijit.Scalebar");
                dojo.require("esri.layers.FeatureLayer");
                dojo.require("esri.virtualearth.VETiledLayer");
            }

            // Check to see if the ArcGIS JavaScript API is already loaded.  If it is not, load the API from the URL, then initialize the map.
            // Otherwise, just initialize the map immediately.
            if (typeof (esri) === "undefined") {
                $.getScript(this.options.apiUrl, function (/*data, textStatus*/) {
                    callDojoRequire();
                    dojo.addOnLoad(init);
                });
            } else {
                callDojoRequire();
                dojo.addOnLoad(init);
            }

            return self;
        },
        _destroy: function () {
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });
} (jQuery));