$(document).ready(function () {

    var root_el = $('.marketorders');
    var type_id = root_el.attr('data-typeID');

    ['sell', 'buy'].forEach(function (bid_type, bid_idx) {

        var orders = new Market.MarketOrders();
        orders.state.pageSize = 7;
        var sort_dir = ('sell' == bid_type) ? 1 : -1
        orders.comparator = function (order) {
            return sort_dir * order.get('price');
        }

        var grid = new Backgrid.Grid({
            collection: orders,
            columns: [
                { name: 'price', label: 'Price', cell: 'number', editable: false },
                { name: 'volRemaining', label: 'Volume', editable: false,
                    cell: ProgressIntegerCell.extend({totalAttr: 'volEntered'}) },
                { name: 'stationName', label: 'Station', editable: false,
                    cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'stationID'}) },
            ]
        });
        var orders_el = root_el.find('.' + bid_type);
        orders_el.append(grid.render().$el);

        var paginator = new Backgrid.Extension.Paginator({
            collection: orders
        });
        orders_el.append(paginator.render().$el);

        var filter = new Backgrid.Extension.ClientSideFilter({
            collection: orders.fullCollection,
            fields: ['typeName']
        });

        hub.on('loadorders', function (location_state) {
            var params = {bid: bid_idx}
            _.each(location_state, function (val, name) {
                if (val) { params[name] = val; }
            });
            orders.url = "/data/market/type/" + type_id +
                "?" + $.param(params);
            orders.fetch({reset: true});
        });

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

});
