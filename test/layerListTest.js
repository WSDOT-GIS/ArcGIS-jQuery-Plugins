/*global jQuery, dojo, esri, Modernizr */
/*jslint devel: true, browser: true, white: true, maxerr: 50, indent: 4 */

/// <reference path="../script/jquery.ba-bbq.js" />

(function ($) {
    "use strict";
    dojo.require("esri.dijit.BasemapGallery");

    $().ready(function () {
        var qs = $.deparam.querystring(), layers;

        $("button").button({
            disabled: true
        });

        if (typeof (qs.layers) !== "undefined") {
            layers = qs.layers.split(",");
        }

        // Create the ArcGIS Map control.
        $("#map").arcGisMap({
            layers: [
                {
                    url: "http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                    type: "esri.layers.ArcGISTiledMapServiceLayer",
                    options: {
                        id: "layer0"
                    }
                },
                {
                    url: "http://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
                    type: "esri.layers.ArcGISTiledMapServiceLayer",
                    options: {
                        id: "layer1"
                    }
                },
                {
                    url: "http://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
                    type: "esri.layers.ArcGISTiledMapServiceLayer",
                    options: {
                        id: "layer2"
                    }
                }
            ],
            resizeWithWindow: true,
            mapLoad: function (event, map) {
                var basemapDialog, basemapGallery;
                $("#basemapButton").button("option", "disabled", false).click(function () {
                    if (!basemapDialog) {
                        basemapDialog = $("<div id='basemapDialog'><div id='basemapGallery'>").dialog({
                            title: "Basemap Gallery"
                        });

                        // Create the basemap gallery if it does not yet exist.
                        basemapGallery = new esri.dijit.BasemapGallery({
                            map: map,
                            // bingMapsKey: 'Your Bing Maps Key goes here',
                            referenceIds: ["layer0", "layer1", "layer2"]
                        }, "basemapGallery");

                        basemapGallery.startup();
                    } else {
                        basemapDialog.dialog("open");
                    }

                });

                $.getJSON("test/categorizedLayers.json", function (data, textStatus) {
                    var layerList, layerSorter;

                    function createLayerSorterDialog() {
                        if (!layerSorter) {
                            layerSorter = $("<div>").layerSorter({
                                map: map
                            }).dialog({
                                title: "Sort Layers",
                                autoOpen: false,
                                close: function () {
                                    $(this).layerSorter("destroy").remove();
                                    layerSorter = null;
                                }
                            });
                        }
                        layerSorter.dialog("open");
                    }

                    layerList = $("#layerList").dialog({
                        title: "Layers",
                        autoOpen: false
                    }).layerList({
                        map: map,
                        layers: data,
                        startCollapsed: true,
                        startLayers: layers
                        /*,
                        layerAdd: function (evt, data) {
                            console.debug("layer added", this, evt, data);
                        },
                        groupAdd: function (evt, data) {
                            console.debug("group added", this, evt, data);
                        }
                        */
                    });



                    $("#layersButton").click(function () {
                        layerList.dialog("open");
                    }).button("option", "disabled", false);

                    $("#sortLayersButton").click(createLayerSorterDialog).button("enable");
                });
            }
        });
    });
} (jQuery));