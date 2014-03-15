function loadMetaLevels (root_el) {
    var meta_level_el = root_el.find('.meta-levels');
    $.getJSON('/data/invMetaLevels', function (data) {
        _.each(data, function (r) {
            if (!r.metaLevel) { return; }
            meta_level_el.append($('<li>', {
                }).append($('<input>', {
                    id: 'metaLevel-' + r.metaLevel,
                    type: 'checkbox',
                    value: r.metaLevel
                })).append($('<label>', {
                    title: r.invTypesCount,
                    "for": 'metaLevel-' + r.metaLevel
                }).text('Meta ' + r.metaLevel)))
        });
    });
}

function loadMetaGroups (root_el) {
    var meta_group_el = root_el.find('.meta-groups');
    $.getJSON('/data/invMetaGroups', function (data) {
        _.each(data, function (r) {
            meta_group_el.append($('<li>', {
                }).append($('<input>', {
                    id: 'metaGroup-' + r.metaGroupID,
                    type: 'checkbox',
                    value: r.metaGroupID
                })).append($('<label>', {
                    title: r.invTypesCount,
                    "for": 'metaGroup-' + r.metaGroupID
                }).text(r.metaGroupName)))
        });
    });
}

function loadMarketGroupsTree (root_el) {
    var market_groups_base_url = '/data/invMarketGroups?shallow';
    var market_types_base_url = '/data/invTypes';

    root_el.find('.categories').fancytree({
        icons: true,
        selectMode: 1,
        source: $.Deferred(function (dfd) {
            $.getJSON(market_groups_base_url, function (data) {
                dfd.resolve(marketGroupTreeFormat(data));
            });
        }),
        lazyload: function (event, data) {
            data.result = $.Deferred(function (dfd) {
                var node = data.node;
                if (node.data.has_subgroups) {
                    var url = market_groups_base_url + '&root=' + node.key;
                    $.getJSON(url, function (data) {
                        dfd.resolve(marketGroupTreeFormat(data[node.key].children));
                    });
                } else {
                    var url = market_types_base_url + '?marketGroupID=' + node.key;
                    $.getJSON(url, function (data) {
                        dfd.resolve(marketTypesTreeFormat(data));
                    });
                }
            });
        },
        activate: function (event, data) {
            var node = data.node;
            if ('group' == node.data.kind) {
                hub.trigger('marketbrowser:loadgroups', [node.key]);
            } else {
                hub.trigger('marketbrowser:loadorders', node.key);
            }
        },
        dblclick: function(e, data) {
            data.node.toggleSelected();
        },
        keydown: function(e, data) {
            if( e.which === 32 ) {
                data.node.toggleSelected();
                return false;
            }
        }
    });
}

function marketGroupTreeFormat (root) {
    return _.map(root, function (item, id) {
        var out = {
            key: item.marketGroupID,
            title: item.marketGroupName,
            kind: 'group',
            lazy: true
        };
        if (item.children) {
            out.has_subgroups = true;
        }
        return out;    
    });
}

function marketTypesTreeFormat (data) {
    return _.map(data, function (type) {
        var out = {
            key: type.typeID,
            title: type.typeName,
            kind: 'item'
        };
        return out;
    });
}

function setupTypeList (root_el) {
    var items_el = root_el.find('.types');

    var InvType = Backbone.Model.extend({});
    var InvTypes = Backbone.PageableCollection.extend({
        model: InvType,
        url: "/data/invTypes?marketGroupID=1031",
        mode: 'client',
        state: { pageSize: 10 }
    });

    var items = new InvTypes();

    var columns = [
        { name: 'typeName', label: 'Item', editable: false,
            cell: ShowMarketDetailsCell.extend({typeIDAttr: 'typeID'}) },
        { name: 'groupName', label: 'Group', editable: false,
            cell: Backgrid.StringCell.extend({className: 'group-string-cell'}) },
        { name: 'metaLevel', label: 'Meta', editable: false,
            cell: NamedIntegerCell.extend({nameAttr: 'metaGroupName'}) },
    ];

    var grid = new Backgrid.Grid({
        columns: columns,
        collection: items
    });
    items_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: items
    });
    items_el.append(paginator.render().$el);

    hub.on('marketbrowser:loadgroups', function (group_ids) {
        root_el.find('.market-items')
            .removeClass('show-orders').addClass('show-types');
        items.url = '/data/invTypes?' + $.param({
            marketGroupID: group_ids
        }, true);
        items.fetch({reset: true});
    });
}

function setupOrders (root_el) {
    var type_id = null;
    var location_state = {};
    var orders_all = {};

    ['sell', 'buy'].forEach(function (bid_type, bid_idx) {

        var orders = orders_all[bid_type] = new Market.MarketOrders();
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
        var orders_el = root_el.find('.market-items .orders .' + bid_type);
        orders_el.append(grid.render().$el);

        var paginator = new Backgrid.Extension.Paginator({
            collection: orders
        });
        orders_el.append(paginator.render().$el);

        var filter = new Backgrid.Extension.ClientSideFilter({
            collection: orders.fullCollection,
            fields: ['typeName']
        });

    });

    hub.on('marketbrowser:loadorders', function (id) {
        type_id = id;

        var heading = root_el.find('.market-items .orders-heading');
        heading.find('img').attr('src',
            'http://image.eveonline.com/Type/' + type_id + '_64.png');
        heading.find('span').text('LOADED');

        root_el.find('.market-items')
            .addClass('show-orders').removeClass('show-types');
        ['sell', 'buy'].forEach(function (bid_type, bid_idx) {
            var params = {bid: bid_idx}
            _.each(location_state, function (val, name) {
                if (val) { params[name] = val; }
            });
            var url = "/data/market/type/" + type_id + "?" + $.param(params);
            orders_all[bid_type].url = url;
            orders_all[bid_type].fetch({reset: true});
        });
    });

    hub.on('locationselector:change', function (state, changed) {
        location_state = state;
        if (root_el.find('.market-items').hasClass('show-orders')) {
            hub.trigger('marketbrowser:loadorders', type_id);
        }
    });
}

$(document).ready(function () {

    var root_el = $('#market-browser');

    loadMetaLevels(root_el);
    loadMetaGroups(root_el);
    loadMarketGroupsTree(root_el);

    setupTypeList(root_el);
    setupOrders(root_el);

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

});
