function loadSelectFromJSON (el, url, val_name, label_name) {
    $.getJSON(url, function (items) {
        el.empty();
        el.removeAttr('disabled');
        _(items).chain().sortBy(label_name).each(function (item) {
            el.append($('<option>', {
                value: item[val_name],
            }).text(item[label_name]));
        });
        el.selectpicker('refresh');
    });
}

$(document).ready(function () {
    var hub = _.extend({}, Backbone.Events);

    var region_ids = [];
    var constellation_ids = [];
    var system_ids = [];

    var regions_el = $('#regions');
    regions_el.selectpicker().on('change', function () {
        region_ids = regions_el.val();
        loadConstellations();
        hub.trigger('loadOrders');
    });
    loadSelectFromJSON(regions_el, '/data/mapRegions', 'regionID', 'regionName');

    var constellations_el = $('#constellations');
    constellations_el.selectpicker().on('change', function () {
        constellation_ids = constellations_el.val();
        loadSystems();
        hub.trigger('loadOrders');
    });
    function loadConstellations () {
        loadSelectFromJSON(constellations_el,
            '/data/mapConstellations?' + $.param({
                regionID: region_ids
            }), 'constellationID', 'constellationName');
    }

    var systems_el = $('#systems');
    systems_el.selectpicker().on('change', function () {
        system_ids = systems_el.val();
        hub.trigger('loadOrders');
    });
    function loadSystems () {
        loadSelectFromJSON(systems_el,
            '/data/mapSolarSystems?' + $.param({
                constellationID: constellation_ids
            }), 'solarSystemID', 'solarSystemName');
    }

    $('.marketorders').each(function () {
        var root_el = $(this);
        var type_id = root_el.attr('data-typeID');
        console.log(type_id);

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

            var loadOrders = function () {
                orders.url = "/data/market/type/" + type_id + "?" + $.param({
                    bid: bid_idx,
                    regionID: region_ids,
                    constellationID: constellation_ids,
                    solarSystemID: system_ids
                });
                orders.fetch({reset: true});
            };
            loadOrders();
            hub.on('loadOrders', loadOrders);
        });
    });

});
