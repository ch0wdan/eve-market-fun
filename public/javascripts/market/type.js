function loadSelectFromJSON (el, url, val_name, label_name, next_cb) {
    next_cb = next_cb || function () {};
    $.getJSON(url, function (items) {
        el.empty();
        el.removeAttr('disabled');
        _(items).chain().sortBy(label_name).each(function (item) {
            el.append($('<option>', {
                value: item[val_name],
            }).text(item[label_name]));
        });
        el.selectpicker('refresh');
        next_cb(items);
    });
}

var hub = _.extend({}, Backbone.Events);
var state = {
    regionID: [],
    constellationID: [],
    solarSystemID: []
};

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

        hub.on('loadOrders', function () {
            var params = $.param(_.extend({bid: bid_idx}, state));
            orders.url = "/data/market/type/" + type_id + "?" + params;
            orders.fetch({reset: true});
        });

    });

    var regions_el = $('#regions');
    regions_el.selectpicker().on('change', function (ev) {
        updateState({regionID: $(this).val()});
    });

    var constellations_el = $('#constellations');
    constellations_el.selectpicker().on('change', function (ev) {
        updateState({constellationID: $(this).val()});
    });
    
    var systems_el = $('#systems');
    systems_el.selectpicker().on('change', function (ev) {
        updateState({solarSystemID: $(this).val()});
    });
    
    var updateRegions = function () {
        loadSelectFromJSON(regions_el, '/data/mapRegions', 'regionID', 'regionName', function () {
            regions_el.val(state.regionID);
            regions_el.selectpicker('render');
        });
    }
    var updateConstellations = function () {
        var url = '/data/mapConstellations?' + $.param({regionID: state.regionID});
        loadSelectFromJSON(constellations_el, url, 'constellationID', 'constellationName', function () {
            constellations_el.val(state.constellationID);
            constellations_el.selectpicker('render');
        });
    }
    var updateSolarSystems = function () {
        var url = '/data/mapSolarSystems?' + $.param({constellationID: state.constellationID});
        loadSelectFromJSON(systems_el, url, 'solarSystemID', 'solarSystemName', function () {
            systems_el.val(state.solarSystemID);
            systems_el.selectpicker('render');
        });
    }

    var updateState = function (data, skip_push_state) {
        data = data || {};
        state = _.extend(state, data);
        if (regions_el.attr('disabled')) {
            updateRegions();
        }
        if (data.constellationID && data.constellationID.length) {
            updateSolarSystems();
        }
        if (data.regionID && data.regionID.length) {
            updateConstellations();
        }
        if (!skip_push_state) {
            history.pushState(state, "", "/market/type/" + type_id + "?" + $.param(state));
        }
        hub.trigger('loadOrders');
    };

    window.onpopstate = function (ev) {
        updateState(ev.state, true);
    };
    if (window.location.search) {
        var params = $.parseParams(window.location.search.substr(1));
        updateState(params, true);
    } else {
        updateState({}, true);
    }
});
