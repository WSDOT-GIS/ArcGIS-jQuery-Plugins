/*global jQuery:true, dojo:true, esri:true, localStorage:true */
/*jslint devel: true, browser: true, es5: true, white: true, nomen: true, maxerr: 50, indent: 4 */

/* 
 * Copyright 2011 Washington State Department of Transportation
 * Licensed under the MIT License (http://www.opensource.org/licenses/MIT)
 */
(function ($) {
    "use strict";
    $.widget("ui.extentSelect", {
        options: {
            apiUrl: "http://serverapi.arcgisonline.com/jsapi/arcgis/?v=2.7compact",
            // The URL for the query that returns geometries.  These geometries' extents will be used by this control.
            // For more details see http://help.arcgis.com/en/arcgisserver/10.0/apis/rest/index.html?query.html.
            localStorageKey: "extents",
            url: "http://wsdot.wa.gov/geosvcs/ArcGIS/rest/services/Shared/CountyBoundaries/MapServer/0/query", 
            // The options that will be passed to the query URL (i.e., query string parameters).
            queryOptions: {
                "where": "1=1",
                "returnGeometry": true,
                "maxAllowableOffset": 100000000000,
                "outSR": 102100,
                "outFields": "JURLBL",
                "f": "json"
            },
            // The name of the field that will be used to name the extents in the <select>.
            extentNameField: "JURLBL",
            // extents: This parameter can be used to define additional extents for the control (in addition to the query results). 
            extents: {
                "State": { "xmin": -14402710.641319368, "ymin": 5436246.03029616, "xmax": -12445922.717219383, "ymax": 6479458.5923319645, "spatialReference": { "wkid": 102100} }
            },
            // Set this option to true if you want the <select> to have a blank entry at the top that is not associated with an extent.
            includeBlank: false
        },
        getSelectedExtent: function () {
            ///<summary>Gets the extent corresponding to the currently selected option.</summary>
            var name = $(":selected", this.element).val();
            return this.options.extents[name] || null;
        },
        addExtent: function (name, extent) {
            /// <summary>Adds an extent to the list</summary>
            var option = $("<option>").text(name).appendTo(this.element).val(name);
            if (extent) {
                if (!extent.isInstanceOf || !extent.isInstanceOf(esri.geometry.Extent)) {
                    extent = esri.geometry.fromJson(extent);
                }
            }
            return this;
        },
        removeExtent: function (name) {
            /// <summary>Removes an extent from the list</summary>
            // Remove the extent <option> from the <select>.
            $("option", this).filter(function () {
                return $(this).text() === name;
            }).remove();
            // Remove the extent from the extents option.
            delete this.options.extents[name];
            return this;
        },
        _storeExtents: function () {
            var json = {};
            if (typeof(localStorage) !== "undefined" && this.options.localStorageKey) {
                $.each(this.options.extents, function (name, ext) {
                    json[name] = typeof(ext.toJson) !== "undefined" ? ext.toJson() : ext; 
                });
                localStorage.setItem(this.options.localStorageKey, JSON.stringify(json));
            }
            return this;
        },
        _getExtents: function () {
            var json = null, output = null;
            // Try to get the list of extents from local storage, if browser supports it.
            if (typeof(localStorage) !== "undefined" && this.options.localStorageKey) {
                json = localStorage.getItem(this.options.localStorageKey);
            }
            
            // If extents could not be retrieved, return null.
            // Otherwise, parse the extents and return them. 
            if (json) {
                json = JSON.parse(json);
                output = {};
                $.each(json, function (name, extent) {
                    output[name] = esri.geometry.fromJson(extent);
                });
                // json = JSON.parse(json, function (key, value) {
                    // if (value.x && value.y) {
                        // console.debug(value);
                        // return esri.geometry.fromJson(value);
                    // } else {
                        // return value;
                    // }
                // });
            } 
            return output;
        },
        _create: function () {
            var self = this;
            
            // if (typeof(esri) === "undefined" || typeof(esri.geometry) === "undefined" || typeof(esri.geometry.Extent) === "undefined") {
                // throw new Error("The type \"esri.geometry.Extent\" is not defined.  ArcGIS JS API does not appear to be loaded.");
            // }
            
            
            function init() {
                // Get the list of counties and populate the counties select element.
                
                // Try to get the extents from local storage.
                var extents = self._getExtents();
                
                // If extents were successfully retrieved from local storage...
                if (extents) {
                    self.options.extents = extents;
                    // Add the extents as <option>s to the <select>.
                    $.each(self.options.extents, function (name, ext) {
                        $("<option>").appendTo(self.element).text(name).val(name);
                    });
                    // Add a blank <option> in the <select> list (if specified in options).
                    if (self.options.includeBlank) {
                        $("<option>").prependTo(self.element);
                    }
                    // Trigger the "features loaded" event.
                    self._trigger("featuresLoaded", self.element, self.options.extents);
                } else {
                    
                    $.get(self.options.url, self.options.queryOptions, function (data, textStatus) {
                        var features;
                        if (/success/gi.test(textStatus)) {
                            features = data.features;
                            // Sort the features by county name.
                            features.sort(function (a, b) {
                                var nameA = a.attributes.JURLBL, nameB = b.attributes.JURLBL;
                                if (nameA === nameB) {
                                    return 0;
                                } else if (nameA > nameB) {
                                    return 1;
                                } else {
                                    return -1;
                                }
                            });
                            // Initialize the extents option if it has not been defined.
                            if (!self.options.extents) {
                                self.options.extents = {};
                            } else {
                                // If extents have been defined in the options, add to the select and ensure that the value is an esri.geometry.Extent.
                                $.each(self.options.extents, function (name, ext) {
                                    $("<option>").appendTo(self.element).text(name).val(name);
                                    if (!ext.isInstanceOf || !ext.isInstanceOf(esri.geometry.Extent)) {
                                        self.options.extents[name] = esri.geometry.fromJson(ext);
                                    }
                                });
                            }
                            // Add extent options for each feature returned from the query.
                            $.map(features, function (feature) {
                                var extents = self.options.extents, extent, name;
                                // Convert the geometry to an esri.geometry.Geometry, the get its extent
                                extent = Boolean(feature) && Boolean(feature.geometry) ? esri.geometry.fromJson(feature.geometry).getExtent() : null;
                                name = feature.attributes[self.options.extentNameField];
                                self.options.extents[name] = extent;
                                $("<option>").appendTo(self.element).text(name).val(name);
                            });
                            // Add a blank <option> in the <select> list (if specified in options).
                            if (self.options.includeBlank) {
                                $("<option>").prependTo(self.element);
                            }
                            
                            // Store the extents in local storage.
                            self._storeExtents();
                            
                            // Trigger the "features loaded" event.
                            self._trigger("featuresLoaded", self.element, features);
                        } else {
                            // Trigger the "features failed to load"" event. 
                            self._trigger("featureLoadFailed", self.element, {textStatus: textStatus});
                        }
                    }, "jsonp");
                }
            }
            // Check to see if the ArcGIS JavaScript API is already loaded.  If it is not, load the API from the URL, then initialize the map.
            // Otherwise, just initialize the map immediately.
            if (typeof (esri) === "undefined") {
                $.getScript(this.options.apiUrl, function (/*data, textStatus*/) {
                    dojo.require("esri.geometry");
                    dojo.addOnLoad(init);
                });
            } else {
                dojo.require("esri.geometry");
                dojo.addOnLoad(init);
            }
            return this;
        },
        _destroy: function () {
            // Call the default destroy behavior.
            $.Widget.prototype.destroy.apply(this, arguments);
        } 
    });
}(jQuery));
