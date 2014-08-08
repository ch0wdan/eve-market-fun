$(document).ready(function () {

    var root_el = $('.margins');
    var station_id = root_el.attr('data-stationID');

    var MarketMargin = Backbone.Model.extend({ });

    var MarketMargins = Backbone.PageableCollection.extend({
        model: MarketMargin,
        url: '/data/market/margins?stationID=' + station_id,
        mode: 'client',
        state: { pageSize: 15 }
    });

    var margins = new MarketMargins();

    var columns = [
        { name: 'typeName', label: 'Item', editable: false,
            cell: ShowMarketDetailsCell.extend({typeIDAttr: 'typeID'}) },
        { name: 'maxBuyPrice', label: 'Buy', cell: 'number', editable: false },
        { name: 'minSellPrice', label: 'Sell', cell: 'number', editable: false },
        { name: 'baseMarginPercent', label: 'Margin %', cell: 'number', editable: false },
        { name: 'baseMargin', label: 'Margin', cell: 'number', editable: false },
        { name: 'avgDailyVolumeForMonth', label: 'Volume', cell: 'number', editable: false },
        { name: 'marginByVolume', label: 'MxV', cell: 'number', editable: false },
        { name: 'volatilityForMonth', label: 'Volatility', cell: 'number', editable: false }
    ];

    var grid = new Backgrid.Grid({
        columns: columns, 
        collection: margins
    });
    root_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: margins,
        windowSize: 25
    });
    root_el.append(paginator.render().$el);

    margins.fetch({reset: true});

    /*

    hub.on('loadorders', function (location_state) {
        var params = {bid: bid_idx}
        _.each(location_state, function (val, name) {
            if (val) { params[name] = val; }
        });
        orders.url = "/data/market/type/" + type_id +
            "?" + $.param(params);
        orders.fetch({reset: true});
    });

    // When the location selector is loaded, attempt to initialize location.
    hub.on('locationselector:load', function () {
        window.onpopstate = function (ev) {
            hub.trigger('locationselector:update', ev.state);
        };
        if (window.location.search) {
            var search = window.location.search.substr(1);
            var params = $.parseParams(search);
            hub.trigger('locationselector:update', params);
        } else {
            // If no search params, attempt to load up current location
            hub.trigger('locationselector:selectHere');
        }
    });

    // Refresh orders on location change.
    hub.on('locationselector:change', function (state, changed) {
        hub.trigger('loadorders', state);
    });

    */
});
