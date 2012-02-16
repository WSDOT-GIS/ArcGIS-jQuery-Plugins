/* 
 * Copyright 2011 Washington State Department of Transportation
 * Licensed under the MIT License (http://www.opensource.org/licenses/MIT)
 */
(function ($) {
    "use strict";

    $.widget("ui.layerSorter", {
        options: {
            map: null
        },
        _list: null,
        _moveLayer: function (listItem) {
        	/// <summary>Moves the layer corresponding list item to the same position in the map.</summary>
            var map, index, layer;
            map = this.options.map;
            layer = listItem.data("layer");
            if (map && layer) {
            	// Determine the new index.  Remember, map index values are the reverse of that of the layer list.
                index = map.layerIds.length - 1 - $(listItem).index();
                map.reorderLayer(layer, index);
            }
        },
        _populateList: function () {
            var $this = this, map = this.options.map, i, l, layerId, layer;

            /// Create the list if it does not already exist.
            if (!this._list) {
                this._list = $("<ul>").appendTo(this.element).sortable({
                    stop: function (event, ui) {
                        var item = ui.item;
                        $this._moveLayer(item);
                    }
                }).disableSelection();
            }
            this._list.empty();
           
            // Loop through the layers in reverse order, so topmost layer is on the top of the list.
            for (l = map.layerIds.length, i = l - 1; i >= 0; i -= 1) {
                layerId = map.layerIds[i];
                layer = map.getLayer(layerId);
                $(['<li class="ui-state-default" title="', layer.description, '"><span class="ui-icon ui-icon-arrowthick-2-n-s"></span>', layerId, '</li>'].join("")).data("layer", layer).appendTo(this._list);
            }
        },
        _refresh: function () {
            /// <summary>Updates the layer sorter list to match the layers</summary>
            this._populateList();
        },
        _create: function () {
            var $this = this, $element = $(this.element);

            $element.addClass("ui-layer-sorter");
            $("<p>Drag items in this list to rearrange layers.</p>").appendTo(this.element);

            // Populate the list of layers.
            this._populateList();

            // Add event handing to reorganize layers when layer's list item has been moved.
            dojo.connect(this.options.map, "onLayerReorder", $this, $this._populateList);

            return this;
        },
        _destroy: function () {
            // Call the base destroy method.
            $.Widget.prototype.destroy.apply(this, arguments);
        }
    });
} (jQuery));