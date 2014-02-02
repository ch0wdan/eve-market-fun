function loadSelectFromJSON (el, url, val_name, label_name, next_cb) {
    next_cb = next_cb || function () {};
    $.getJSON(url, function (items) {
        var choices = {};
        el.empty();
        el.removeAttr('disabled');
        _(items).chain().sortBy(label_name).each(function (item) {
            choices[item[val_name]] = item[label_name];
            el.append($('<option>', {
                value: item[val_name],
            }).text(item[label_name]));
        });
        el.selectpicker('refresh');
        next_cb(null, items, choices);
    });
}

var hub = window.hub = _.extend({}, Backbone.Events);

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

    $('.locationselector').each(function () {
        var root_el = $(this);
        var state = {
            regionID: null,
            constellationID: null,
            solarSystemID: null
        };
        var choices = {};
        var els = {};
        _.each(state, function (ignore, name) {
            choices[name] = {};
            els[name] = root_el.find('.'+name)
                .prop('disabled', true)
                .selectpicker({
                    liveSearch: true,
                    showSubtext: true,
                    selectedTextFormat: 'values' 
                })
                .on('change', function (ev) {
                    var update = _.clone(state);
                    update[name] = $(this).val();
                    updateState(update);
                    saveState();
                });
        });
        var resetSelector = function (name) {
            els[name].empty().prop('disabled', true).selectpicker('refresh');
            choices[name] = {};
        };
        var updateSelector = function (name) {
            if (state[name]) {
                els[name].val(state[name]).selectpicker('refresh');
            }
        };
        var updateState = function (update) {
            var changed = {};
            _.each(state, function (curr_val, name) {
                var new_val = update[name];
                changed[name] = (update[name] != curr_val);
                state[name] = new_val;
            });
            async.waterfall([
                function (next) {
                    if (!changed.regionID) {
                        return next(null, null, null);
                    }
                    updateSelector('regionID');
                    resetSelector('constellationID');
                    resetSelector('solarSystemID');
                    loadSelectFromJSON(els.constellationID,
                        '/data/mapConstellations?' + $.param({
                            regionID: state.regionID
                        }), 'constellationID', 'constellationName', next);
                }, function (data, choices_in, next) {
                    if (choices_in) { choices.constellationID = choices_in; }
                    if (!changed.constellationID) {
                        return next(null, null, null);
                    }
                    updateSelector('constellationID');
                    resetSelector('solarSystemID');
                    loadSelectFromJSON(els.solarSystemID,
                        '/data/mapSolarSystems?' + $.param({
                            constellationID: state.constellationID
                        }), 'solarSystemID', 'solarSystemName', next);
                }, function (data, choices_in, next) {
                    if (choices_in) { choices.solarSystemID = choices_in; }
                    if (!changed.solarSystemID) { return next(); }
                    updateSelector('solarSystemID');
                    next();
                }
            ], function (err) {
                _.each(state, function (curr_val, name) {
                    if (!choices[name] || !choices[name][state[name]]) {
                        state[name] = null;
                    }
                });
                hub.trigger('locationselector:change', state, changed);
            });
        };
        var saveState = function () {
            history.pushState(state, '',
                '/market/type/' + type_id + '?' + $.param(state));
        };
        hub.on('locationselector:update', function (update) {
            updateState(update);
        });
        loadSelectFromJSON(els.regionID, '/data/mapRegions',
            'regionID', 'regionName',
            function (err, data, choices_in) {
                choices.regionID = choices_in;
                hub.trigger('locationselector:load');
            });
    });

    hub.on('locationselector:load', function () {
        window.onpopstate = function (ev) {
            hub.trigger('locationselector:update', ev.state);
        };
        if (window.location.search) {
            var search = window.location.search.substr(1);
            var params = $.parseParams(search);
            hub.trigger('locationselector:update', params);
        } else if (eve_headers && eve_headers.trusted) {
            hub.trigger('locationselector:update', {
                regionID: eve_headers.regionid,
                constellationID: eve_headers.constellationid,
                solarSystemID: eve_headers.solarsystemid
            });
        }
    });

    hub.on('locationselector:change', function (state, changed) {
        hub.trigger('loadorders', state);
    });
});
