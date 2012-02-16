/*jslint browser: true, windows: true, nomen: true, white: true*/
/*global esri, dojo, jQuery*/
/// <reference path="http://ajax.aspnetcdn.com/ajax/jQuery/jquery-1.6.4-vsdoc.js"/>
/// <reference path="http://ajax.aspnetcdn.com/ajax/jquery.ui/1.8.16/jquery-ui.js"/>
/// <reference path="http://serverapi.arcgisonline.com/jsapi/arcgis/?v=2.7"/>
/* 
 * Copyright 2011 Washington State Department of Transportation
 * Licensed under the MIT License (http://www.opensource.org/licenses/MIT)
 */

/**
 * A layer list that only creates a layer object when the user checks the associated checkbox.
 * @author Jeff Jacobson
 */


(function ($) {
    "use strict";
    dojo.require("esri.layers.agstiled");
    dojo.require("esri.layers.agsdynamic");

    var _defaultContextMenuIcon, _defaultLoadingIcon, onLayerLoad, onLayerError, updateIsInScaleStatus, toggleSublayer;
    _defaultContextMenuIcon = "<img src='images/contextMenu.png' style='cursor:pointer' height='11' width='11' alt='context menu icon' title='Layer Options' />";
    _defaultLoadingIcon = "<img src='images/ajax-loader.gif' height='16' width='16' alt='Loading icon' />";

    function makeIdSafeString(s, replacement, prefix, alwaysUsePrefix) {
        /// <summary>Makes a string safe to use as an HTML id property.</summary>
        /// <param name="s" type="String">A string.</param>
        /// <param name="replacement" type="String">Optional.  The string that will be used to replace invalid characters.  Defaults to "-".</param>
        /// <param name="prefix" type="String">Optional.  A string that will be prepended to the output if the input starts with a non-alpha character.  Defaults to "z-".</param>
        /// <param name="alwaysUsePrefix" type="Boolean">Set to true to always prepend the prefix to the output, false to only use it when the first character of s is non-alpha.</param>

        // Replace invalid characters with hyphen.
        s = s.replace(/\W/gi, replacement || "-");
        // Append a prefix if non-alpha character
        if (alwaysUsePrefix || /^[^a-z]/i.test(s)) {
            s = [prefix || "z-", s].join("");
        }

        return s;
    }

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
            } else {
                throw new Error("Unsupported layer type.");
            }
        } else if (typeof (layerType) === "function") {
            return layerType;
        }
    }

    var toggleSublayer = function (evt) {
        /// <summary>Toggles the visibility of a sublayer associated with a checkbox.</summary>
        /// <param name="evt" type="Object">An event object.  Must have a data.list property defined.</param>
        // Initialize variables.  The currentId is the ID corresponding to the checkbox (this).
        var layers, currentId = Number(this.value), layer = evt.data.layer, id, i, l, layerInfo;

        // Initialize the list of layers that will be sent to the setVisibleLayers method.
        layers = this.checked ? [currentId] : [];

        // Copy the ids of the currently visible layers (excluding "currentId") into a new array.
        for (i = 0, l = layer.visibleLayers.length; i < l; i += 1) {
            id = layer.visibleLayers[i];
            layerInfo = layer.layerInfos[id];
            // Omit layers that have subLayers.
            if (id !== currentId && typeof(layerInfo) !== "undefined" && layerInfo.subLayerIds === null) {
                layers.push(id);
            }
        }

        // If the array is empty, add the value -1 to make the setVisibleLayers query valid.
        if (layers.length === 0) {
            layers.push(-1);
        }

        // Call the setVisibleLayers function.
        layer.setVisibleLayers(layers);
    };

    function setTreeIcon(element, isCollapsed) {
        /// <summary>Adds either an "expanded" or "collaped" class to the specified elements based on the visibility of its child elements.</summary>
        /// <param name="element" type="DOMElement">A list item element.</param>
        /// <param name="isCollapsed" type="boolean">Optional.  Use this to explicitly specify what state the element is in.  If omitted, the expanded/collapsed state will be determined automatically.</param>
        /// <returns type="undefined" />
        if (!element) {
            // Exit if element not specified.
            return;
        }

        // Determine the value of "isCollapsed" if not provided.
        if (typeof (isCollapsed) === "undefined") {
            isCollapsed = $("> ul", element).css("display") === "none";
        }

        // Set the class to either expanded or collapsed depending on the value of isCollapsed.
        if (isCollapsed) {
            $(element).addClass("collapsed").removeClass("expanded");
        } else {
            $(element).addClass("expanded").removeClass("collapsed");
        }
    }

    function toggleChildList(evt) {
        /// <summary>Toggles the child list of a list item on or off.</summary>
        /// <param name="evt" type="Object">An event object.  The evt must have a data property that has a parent property.</param>
        var parent, childLists, hidden;
        parent = evt.data.parent;
        childLists = $("> ul", parent);
        hidden = childLists.css("display") !== "none";

        setTreeIcon(parent, hidden);
        childLists.toggle("blind");
        return false;
    }

    function createSublayerControls(layer) {
        var i, l, layerInfo, output, li, parentLi, parentUl, checkbox, a;
        if (typeof (layer.layerInfos) === "undefined") {
            // Layer does not have sublayer infos.
            return null;
        }

        output = $("<ul>").hide();

        // Create heirarchy for sublayers.
        for (i = 0, l = layer.layerInfos.length; i < l; i += 1) {
            layerInfo = layer.layerInfos[i];
            li = $("<li>").attr({ "data-sublayerId": layerInfo.id });

            // Create a checkbox only if this is not a parent layer.
            checkbox = layerInfo.subLayerIds !== null ? null : $("<input>").attr({
                type: "checkbox",
                value: layerInfo.id,
                checked: layerInfo.defaultVisibility
            }).appendTo(li).addClass('ui-layer-list-sublayer');
            if (layerInfo.subLayerIds === null) {
                $("<label>").text(layerInfo.name).appendTo(li);
            } else {
                // Attach an event to the label link that will toggle the child list.
                li.addClass("ui-layer-list-has-children");
                $("<label>").text(layerInfo.name).appendTo(li).click({
                    parent: li
                }, toggleChildList);
                setTreeIcon(li);
            }

            // If its a parent layer, add directly to the output list.
            if (layerInfo.parentLayerId === -1) {
                output.append(li);
            } else {
                // Find the parent li
                parentLi = $(["li[data-subLayerId=", layerInfo.parentLayerId, "]"].join(""), output);
                // Get the parent list items child list.
                parentUl = $("ul", parentLi);
                // If a child list hasn't been created, create one now.
                if (parentUl.length === 0) {
                    parentUl = $("<ul>").appendTo(parentLi);
                }
                parentUl.append(li);
            }

            // Attach an event to the checkbox.
            if (checkbox) {
                checkbox.change({
                    layer: layer,
                    list: parentUl
                }, toggleSublayer);
            }
        }

        return output;
    }

    function createLayer(layerInfo) {
        /// <summary>Creates an esri.layer.Layer based on information in layerInfo.</summary>
        /// <param name="layerInfo" type="Object">An object containing parameters for a Layer constructor.</param>
        /// <returns type="esri.layer.Layer" />
        var constructor;
        // If layerInfo is already an esri.layers.Layer, just return it.
        if (typeof (layerInfo) !== "undefined" && typeof (layerInfo.isInstanceOf) !== "undefined" && layerInfo.isInstanceOf(esri.layers.Layer)) {
            return layerInfo;
        }

        constructor = getLayerConstructor(layerInfo.type || layerInfo.layerType);
        return new constructor(layerInfo.url, layerInfo.options);
    }

    function setOpacity(event, ui) {
        var value = event.target.valueAsNumber || ui.value, layer = event.data.layer;
        layer.setOpacity(value);
    }

    function toggleOpacity(event) {
        event.data.slider.toggle();
    }

    function showTools(event) {
        event.data.tools.show();
    }

    function hideTools(event) {
        event.data.tools.hide();
    }

    function supportsInputRange() {
        /// <summary>Determines if the browser supports the HTML5 input range type element.</summary>
        /// <returns type="Boolean" />
        var input = $("<input type='range'>")[0];
        return typeof (input.min) !== "undefined";
    }

    $.widget("ui.layerOptions", {
        options: {
            layer: null
        },
        _create: function () {
            var $this = this, layer, slider, sliderContainer, chromeRe = /Chrome\/([\d\.]+)/gi;
            if (this.options.layer === null) {
                throw new Error("No layer specified");
            }

            layer = $this.options.layer;

            // Add the opacity slider if the layer supports the setOpacity function.
            if (typeof (layer.setOpacity) === "function") {
                $("<label>").text("Transparency").appendTo($this.element);
                sliderContainer = $("<div>").addClass("ui-layer-list-opacity-slider-container").appendTo($this.element);
                // Add opacity slider
                if (supportsInputRange()) { //chromeRe.test(navigator.userAgent)) {
                    // Chrome supports the HTML5 range input control, so we'll just use that...
                    slider = $("<input>").attr({
                        type: "range",
                        min: 0,
                        max: 1,
                        value: layer.opacity, // This doesn't actually seem to set the value.  We actually set this value with the val method.
                        step: 0.1
                    }).appendTo(sliderContainer).val(layer.opacity).change({ layer: layer }, setOpacity);
                } else {
                    // Convert into a jQuery UI slider.  (HTML5 slider doesn't work in many browsers.)
                    slider = $("<div>").appendTo(sliderContainer).slider({
                        value: layer.opacity,
                        min: 0,
                        max: 1,
                        step: 0.1
                    }).appendTo(sliderContainer).bind("slidechange", {
                        layer: layer
                    }, setOpacity);
                }

            }
        },
        _destroy: function () {
            // Call the base destroy method.
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });

    function showOptions(event) {
        var layer = event.data.layer, dialog;
        // Create the options widget inside a dialog.
        dialog = $("<div>").layerOptions({
            layer: layer
        }).dialog({
            title: [layer.id, "Options"].join(" "),
            position: [
                event.clientX,
                event.clientY
            ],
            modal: true,
            close: function (/*event, ui*/) {
                // Remove the dialog from the DOM and dispose of it.
                $(this).remove().dialog("dispose");
            }
        });
        return false;
    }


    onLayerLoad = function (layer) {
        /// <summary>Removes the "layer not loaded" class and (if appropriate) sets up controls for the child layers.</summary>
        /// <param name="layer" type="esri.layers.Layer">A map service layer.</param>
        // The "this" object is a ui.layerListItem widget.
        var a, $element = $(this.element), label, slider, tools, opacityToggle, map;
        this._hideLoading();
        $element.removeClass("ui-layer-list-not-loaded");

        // Add options link
        tools = $(this.options.contextMenuIcon).appendTo($element).click({
            layer: layer
        }, showOptions);

        // Setup the mouse over and mouse out events.
        $element.mouseover({
            tools: tools
        }, showTools).mouseout({
            tools: tools
        }, hideTools);

        // Add sublayers if the layer supports sub-layer visibility setting, and has more than one sub-layer.
        if (!this.options.layer.omitSublayers && typeof (layer.setVisibleLayers) === "function" && layer.layerInfos.length > 1) {
            // Set the label to toggle sublayer list when clicked.
            $element.addClass("ui-layer-list-has-children");
            label = $("> label", $element).click({ parent: $element }, toggleChildList);
            $(createSublayerControls(layer)).appendTo($element);

            setTreeIcon($element[0]);
        }

        try {
            this.setIsInScale();
        } catch (e) {
            if (typeof (console) !== "undefined" && typeof (console.error) === "function") {
                console.error(e);
            }
        }
    };

    function formatError(error) {
        /// <summary>Converts an error object into a string.</summary>
        /// <param name="error" type="Error">An error that occurs when loading a layer.</param>
        var msgParts;
        if (typeof (error.details) !== "undefined") {
            return error.details.join("\n");
        } else if (typeof (error.message) !== "undefined") {
            return error.message;
        } else {
            return error;
        }
    }

    onLayerError = function (error) {
        /// <summary>Modify the control to show that an error has occured with this layer.</summary>
        // The "this" keyword will be a layerListItem widget.
        var layer = this._layer;
        if (!layer.loaded) {
            this.disable();
            this._hideLoading();
            $(this.element).removeClass("ui-layer-list-not-loaded").addClass("ui-state-error").attr("title", "Error\n" + formatError(error));
        }
        // Trigger an event that can be used by consumers of this control..
        this._trigger("layerError", {
            error: error
        });
    };

    function toggleLayer(eventObject) {
        /// <summary>Toggles the layer associated with a checkbox on or off.</summary>
        /// <param name="eventObject" type="Object">Contains information about the checkbox change event.</param>
        var $this;

        $this = eventObject.data.widget;
        // Turn the layer on if it is checked, off if not.
        if (eventObject.currentTarget.checked) {
            // If the layer hasn't been created yet, create it and add it to the map.
            // Otherwise, show the layer.
            if (!$this._layer) {
                $this._showLoading();
                $this._layer = createLayer($this.options.layer);
                $this.options.map.addLayer($this._layer);
                // Connect the layer load event.
                dojo.connect($this._layer, "onError", $this, onLayerError);
                dojo.connect($this._layer, "onLoad", $this, onLayerLoad);
            } else {
                $this._layer.show();
            }
        } else {
            if ($this._layer) {
                $this._layer.hide();
            }
        }
    }

    updateIsInScaleStatus = function (extent, delta, levelChange, lod) {
        /// <summary>Update the "is in scale" status for each layerListItem in a layerList.  Note: "this" is the layer list widget.</summary>
        // Get all of the layer list items in the current list.
        var layerListItems, layerListItem, layer, i, l;

        if (levelChange) {
            layerListItems = $(".ui-layer-list-item", this.element);

            for (i = 0, l = layerListItems.length; i < l; i += 1) {
                layerListItem = layerListItems.eq(i);
                layerListItem.layerListItem("setIsInScale", lod.scale);
            }
        }
    };

    $.widget("ui.layerListItem", {
        options: {
            layer: null, // An object that is used to create an esri.layers.layer.  Has an id, url, and layerType.
            map: null,
            contextMenuIcon: _defaultContextMenuIcon,
            loadingIcon: _defaultLoadingIcon
        },
        _showLoading: function () {
            $(".ui-layer-list-item-loading-icon", this.element).show();
        },
        _hideLoading: function () {
            $(".ui-layer-list-item-loading-icon", this.element).hide();
        },
        _checkbox: null,
        _layer: null, // This is where the esri.layers.Layer object will be stored.
        getLayer: function () {
            return this._layer;
        },
        _sublayerDiv: null,
        setIsInScale: function (scale) {
            /// <summary>Sets the "is in scale" status of this control</summary>
            /// <param name="scale" type="Number">The current scale of the map.</param>
            var layer, scales, minScale, maxScale, isInScale, outOfScaleClass = "ui-layer-list-out-of-scale";

            if (!this._layer) {
                return this;
            }

            layer = this._layer;

            // If scale is not provided, get it from the map.
            if (scale === null || typeof (scale) === "undefined") {
                scale = this.options.map.__LOD.scale;
            }

            // Check to see if the layer has a scales property that is an array.
            scales = this._layer.scales;
            if (typeof (scales) !== "undefined" && $.isArray(scales)) {
                minScale = scales[0];
                maxScale = scales[scales.length - 1];
                isInScale = (minScale === 0 || minScale >= scale) && (maxScale === 0 || maxScale <= scale);
                if (isInScale) {
                    $(this.element).removeClass(outOfScaleClass);
                } else {
                    $(this.element).addClass(outOfScaleClass);
                }
            }

            return this;
        },
        _addInfoFromLoadedLayer: onLayerLoad,
        _create: function () {
            var $this = this;

            ($this.element).addClass("ui-layer-list-item ui-layer-list-not-loaded");

            // Add the layer checkbox to the widget and add change event handler.
            $this._checkbox = $("<input>").attr({
                type: "checkbox"
            }).appendTo($this.element).change({ widget: $this }, toggleLayer);

            // Add the label for the checkbox.
            $("<label>").text($this.options.layer.id || $this.options.layer.options.id || "Unnamed").appendTo($this.element);

            ////// Add the loading progress bar.
            ////$("<progress>").text("Loading...").css({
            ////    "display": "block"
            ////}).appendTo($this.element).hide();

            $($this.options.loadingIcon).addClass("ui-layer-list-item-loading-icon").appendTo($this.element).hide();

            // If this layer has already been loaded, call the layer load event handler.
            if (typeof ($this.options.layer) !== "undefined" && $this.options.layer !== null && typeof ($this.options.layer.isInstanceOf) === "function" && $this.options.layer.isInstanceOf(esri.layers.Layer)) {
                $this._layer = $this.options.layer;
                $this._addInfoFromLoadedLayer($this._layer);
                // Set the checkbox to match the layer's visibility.

                $this._checkbox[0].checked = $this._layer.visible;
                $($this.element).mouseout();
            }

            return this;
        },
        disable: function () {
            // Remove the change event handler, disable and uncheck the checkbox.
            this._checkbox.change(null).attr("disabled", true)[0].checked = false;
            $.Widget.prototype.disable.apply(this, arguments);
        },
        _destroy: function () {
            // Call the base destroy method.
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });

    $.widget("ui.layerListGroup", {
        options: {
            map: null,
            groupName: null,
            layers: null,
            startCollapsed: false,
            contextMenuIcon: _defaultContextMenuIcon,
            loadingIcon: _defaultLoadingIcon
        },
        _list: null,
        toggle: function () {
            /// <summary>Toggles the list of layers or subgroups on or off.</summary>
            // Get the list.  If called from a click event, "this" will not be referencing the widget, so we need to get the list an alternate way.
            var hidden = $("ul", this.element).css("display") === "none";
            // Expand the list if it is hidden, or collapse it if it is currently visible.  Then trigger the appropriate event.
            if (hidden) {
                this._list.show("blind");
                $(this.element).removeClass("collapsed");
                this._trigger("collapse", this);
            } else {
                this._list.hide("blind");
                $(this.element).addClass("collapsed");
                this._trigger("expand", this);
            }
            return this;
        },
        _addLayer: function (layer) {
            /// <summary>Adds a layer to the layer list group.</summary>
            /// <param name="layer" type="esri.layers.Layer">A layer to be added to the group.</param>
            var layerListItem = $("<li>").appendTo(this._list).layerListItem({
                layer: layer,
                map: this.options.map,
                contextMenuIcon: this.options.contextMenuIcon,
                loadingIcon: this.options.loadingIcon
            });
            this._trigger("layerAdd", this, {
                layer: layer,
                layerListItem: layerListItem.data("layerListItem")
            });
            return this;
        },
        _addGroup: function (name, layers) {
            /// <summary>Adds a child group to this group.</summary>
            /// <param name="name" type="String">The name that will be given to the group.</param>
            /// <param name="layers" type="Array">An array of layer description objects that will be added to the new group.</param>
            var group = $("<li>").appendTo(this._list).layerListGroup({
                groupName: name,
                startCollapsed: this.options.startCollapsed,
                layers: layers,
                map: this.options.map,
                contextMenuIcon: this.options.contextMenuIcon,
                loadingIcon: this.options.loadingIcon
            });
            this._trigger("groupAdd", this, {
                name: name,
                layers: layers,
                group: group.data("layerListGroup")
            });
            return this;
        },
        _create: function () {
            var $this = this, layers = this.options.layers, link, i, l, name;

            // Add a class indicating that this is a layer list group.
            $($this.element).addClass("ui-layer-list-group");
            // Add the group header link.
            link = $(["<a href='#'>", $this.options.groupName, "</a>"].join("")).attr("href", "#").appendTo($this.element);

            // Add a list to hold the child elements or arrays.
            $this._list = $("<ul>").appendTo($this.element);

            // Add the click event to the link which will toggle the list.
            link.click(function () {
                $this.toggle();
                return false;
            });

            // If layers is an array, it contains layers.  Otherwise it contains groups of layers.
            if ($.type(layers) === "array") {
                // For each layer in layers, add a list item and turn it into a layerListItem.
                for (i = 0, l = layers.length; i < l; i += 1) {
                    $this._addLayer(layers[i]);
                }
            } else if ($.type(layers) === "object") {
                // Add layer list groups for each property in the layers object.
                for (name in layers) {
                    if (layers.hasOwnProperty(name)) {
                        $this._addGroup(name, layers[name]);
                    }
                }
            }

            if ($this.options.startCollapsed) {
                $this.toggle();
            }

            return this;
        },
        _destroy: function () {
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });

    function getLayerId(layer) {
        var type = $.type(layer);
        if (type === "string") {
            return layer;
        } else {
            return Boolean(layer.id) ? layer.id : Boolean(layer.options) && Boolean(layer.options.id) ? layer.options.id : null;
        }
    }

    $.widget("ui.layerList", {
        options: {
            map: null,
            layers: null,
            startCollapsed: false,
            contextMenuIcon: _defaultContextMenuIcon,
            loadingIcon: _defaultLoadingIcon,
            startLayers: null,
            basemapRe: /layer((?:\d+)|(?:_osm)|(?:_bing))/i,
            basemapGroupName: "Basemap",
            addAdditionalLayers: true
        },
        getWidget: function () {
            return this;
        },

        _layerExistsInToc: function (layer) {
            /// <summary>Checks to see if a layer already exists in the layer list.</summary>
            var existingLayers;

            if (typeof (layer) !== "string") {
                layer = getLayerId(layer);
            }

            return $("label").filter(function () {
                return $(this).text() === layer;
            }).length > 0;

        },
        _selectStartLayers: function () {
            /// <summary>Turns on all of the layers specified in the options.startLayers array.</summary>
            var startLayerNames, listItems, i, l, listItem, j, nameCount, name, checkbox;
            startLayerNames = this.options.startLayers;
            listItems = $("li.ui-layer-list-item", this.element);
            for (i = 0, l = listItems.length; i < l; i += 1) {
                listItem = listItems[i];
                // Loop through all of the names to see if there is a match.
                for (j = 0, nameCount = startLayerNames.length; j < nameCount; j += 1) {
                    name = startLayerNames[j];
                    if ($("label", listItem).text() === name) {
                        // Get the checkbox
                        checkbox = $("> input", listItem);
                        checkbox = checkbox.length ? checkbox[0] : null;

                        // Click the checkbox.  This will check it and activate the associated layer.
                        if (checkbox) {
                            checkbox.click();
                            $(checkbox).change(); // This line is necessary to turn the layer on in IE.
                        }
                        break; // Match found.  Go to the next list item.
                    }
                }
            }
        },
        _childNodeType: null,
        _addGroup: function (name) {
            var group = $(this._childNodeType).appendTo(this.element).layerListGroup({
                map: this.options.map,
                startCollapsed: this.options.startCollapsed,
                groupName: name,
                layers: this.options.layers[name],
                contextMenuIcon: this.options.contextMenuIcon,
                loadingIcon: this.options.loadingIcon
            });
            this._trigger("groupAdd", this, {
                group: group
            });
            return group;
        },
        _addLayer: function (layer, error) {
            var parent = this.element, groups, group, groupWidget, i, l, basemapGroupFound = false, layerListItem;
            if (this.options.basemapRe.test(getLayerId(layer))) {
                // Check to see if a "Basemap" group exists.  Create one if it does not.  Set "parent" to the "Basemap" group.
                // $(".ui-layer-list-group").first().data("layerListGroup").options.groupName
                groups = $(".ui-layer-list-group", this.element);
                for (i = 0, l = groups.length; i < l; i += 1) {
                    group = groups.eq(i);
                    groupWidget = group.data("layerListGroup");
                    if (Boolean(groupWidget.options) && typeof (groupWidget.options.groupName) === "string" && groupWidget.options.groupName === this.options.basemapGroupName) {
                        parent = group[0];
                        basemapGroupFound = true;
                        break;
                    }
                }
                // TODO: Create "Basemap" group if it does not already exist.  Assign this group to parent.
                if (!basemapGroupFound) {
                    parent = this._addGroup(this.options.basemapGroupName);
                }

                parent = $("ul", parent);
            }
            if (!error && !this._layerExistsInToc(layer)) {
                // Add the layer list item
                layerListItem = $(this._childNodeType).appendTo(parent).layerListItem({
                    layer: layer,
                    map: this.options.map,
                    contextMenuIcon: this.options.contextMenuIcon,
                    loadingIcon: this.options.loadingIcon
                });

                // Trigger an event.
                this._trigger("layerAdd", this, {
                    layer: layer,
                    layerListItem: layerListItem.data("layerListItem")
                });
            }
            return this;
        },
        _removeLayer: function (layer) {
            /// <summary>Removes the list item corresponding to the given layer from the layerList.  Intended to be called from the map's removeLayer event.</summary>
            /// <param name="layer" type="esri.layers.Layer">The layer that will have its corresponding item removed.</param>
            var listItems, i, l, item;
            // Get all of the layer list items that have had their layers loaded.
            listItems = $(".ui-layer-list-item").filter(":not(.ui-layer-list-not-loaded)");
            // Find the one that matches the removed layer and remove it.
            for (i = 0, l = listItems.length; i < l; i += 1) {
                // Get the item at the current index in a jQuery object.
                item = listItems.eq(i);
                if (item.layerListItem("getLayer") === layer) {
                    item.remove();
                    break;
                }
            }
            this._trigger("layerRemove", this, {
                layer: layer
            });
        },
        _addLayersAlreadyInMap: function () {
            var i, l, map = this.options.map, layerIds = map.layerIds.concat(map.graphicsLayerIds);
            // Add layers already in map to the TOC.
            for (i = 0, l = layerIds.length; i < l; i += 1) {
                this._addLayer(map.getLayer(layerIds[i]));
            }
        },
        _create: function () {
            var $this = this, layer, baseNode, map = this.options.map, i, l, name;

            // Add classes to this element for jQuery UI styling and for custom styling.
            $($this.element).addClass('ui-layer-list');

            // Get the base node DOM element.
            baseNode = this.element.nodeName ? this.element : this.element[0];
            // Determine the type of DOM element.  If the baseNode is either an OL or UL, we will be adding LI elements.
            // Otherwise we will be adding DIV elements.
            $this._childNodeType = /[uo]l/i.test(baseNode.nodeName) ? "<li>" : "<div>";

            if ($.isArray($this.options.layers)) {
                // If the "layers" option is an array, add a layerListItem for each element in the array.
                for (i = 0, l = $this.options.layers.length; i < l; i += 1) {
                    $this._addLayer($this.options.layers[i]);
                }
            } else {
                // For each property in the "layers" object, add a layerListGroup.
                for (name in $this.options.layers) {
                    if ($this.options.layers.hasOwnProperty(name)) {
                        $this._addGroup(name);
                    }

                }
            }

            // Check the layers specified in the startLayers option.
            if ($.isArray($this.options.startLayers)) {
                $this._selectStartLayers();
            }

            // Setup zoom events to show if layer is out of scale.
            dojo.connect(map, "onExtentChange", this, updateIsInScaleStatus);

            if ($this.options.addAdditionalLayers === true) {
                // Add an event to add layers to the TOC as they are added to the map.
                dojo.connect(map, "onLayerAddResult", $this, this._addLayer);
                dojo.connect(map, "onLayerRemove", $this, this._removeLayer);


                // Add layers already in map to the TOC.
                $this._addLayersAlreadyInMap();
            }

            return this;
        },
        _destroy: function () {
            // Call the base destroy method.
            // TODO: destroy the layer list items.
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });

    $.widget("ui.tabbedLayerList", {
        options: {
            map: null,
            layers: null,
            startCollapsed: false,
            contextMenuIcon: _defaultContextMenuIcon,
            loadingIcon: _defaultLoadingIcon,
            startLayers: null,
            basemapRe: /layer((?:\d+)|(?:_osm)|(?:_bing))/i,
            basemapGroupName: "Basemap",
            addAdditionalLayers: true
        },
        _create: function () {
            var $this = this, tabList, tabId, tabDiv, tabsLayers, tabName;

            function createTabDiv(tabName, addAdditionalLayers) {
                var layers = $this.options.layers[tabName] || [];
                // Create the ID for the current tab.
                tabId = makeIdSafeString(tabName, "-", "ui-tabbed-layer-list-tab-", true);
                // Add a link for the current tab.
                tabList.append(["<li><a href='#", tabId, "'>", tabName, "</a></li>"].join(""));
                // Create the currrent tab.
                tabDiv = $("<div>").attr("id", tabId).appendTo($this.element).layerList({
                    map: $this.options.map,
                    layers: layers,
                    startCollapsed: $this.options.startCollapsed,
                    contextMenuIcon: $this.options.contextMenuIcon,
                    loadingIcon: $this.options.loadingIcon,
                    startLayers: $this.options.startLayers,
                    basemapRe: $this.options.basemapRe,
                    basemapGroupName: $this.options.basemapGroupName,
                    addAdditionalLayers: Boolean(addAdditionalLayers)
                });
            }

            tabList = $("<ul>").appendTo($this.element);

            // Loop through each property in layers option and create a corresponding list item and div for each.
            for (tabName in $this.options.layers) {
                if ($this.options.layers.hasOwnProperty(tabName)) {
                    createTabDiv(tabName);
                }
            }

            // Add a group for additional layers
            if ($this.options.addAdditionalLayers) {
                createTabDiv("Additional", true);
            }

            $(this.element).tabs();

            return this;
        },
        _destroy: function () {
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });

} (jQuery));