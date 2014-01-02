$(document).ready(function () {

    var root_el = $('#market-browser');

    var marketbrowser_events = _.extend({}, Backbone.Events);

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

    var base_url = '/data/invMarketGroups?shallow';

    var treeFormat = function (root) {
        return _.map(root, function (item, id) {
            var out = {
                key: item.marketGroupID,
                title: item.marketGroupName
            };
            if (item.children) { out.lazy = true; }
            return out;    
        });
    }

    root_el.find('.categories').fancytree({
        checkbox: true,
        icons: false,
        selectMode: 3,
        source: $.Deferred(function (dfd) {
            $.getJSON(base_url, function (data) {
                dfd.resolve(treeFormat(data));
            });
        }),
        lazyload: function (event, data) {
            data.result = $.Deferred(function (dfd) {
                var node = data.node;
                var url = base_url + '&root=' + node.key;
                $.getJSON(url, function (data) {
                    dfd.resolve(treeFormat(data[node.key].children));
                });
            });
        },
        activate: function (event, data) {
            var node = data.node;
        },
        select: function (event, data) {
            var node = data.node;
            var selected_ids = _.chain(data.tree.getSelectedNodes())
                .map(function (node) { return node.key })
                .value();
            marketbrowser_events.trigger('marketGroupsSelectIds', selected_ids);
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

    var items_el = root_el.find('.items');
    var InvType = Backbone.Model.extend({});
    
    var InvTypes = Backbone.PageableCollection.extend({
        model: InvType,
        url: "/data/invTypes?marketGroupID=1031",
        mode: 'client',
        state: { pageSize: 15 }
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

    var filter = new Backgrid.Extension.ClientSideFilter({
        collection: items.fullCollection,
        fields: ['typeName']
    });
    //$('#market-filters .panel-body').prepend(filter.render().$el);
    //filter.$el.css({float: "left", margin: "20px"});

    items.fetch({reset: true});

    var selected_ids = [];
    marketbrowser_events.on('marketGroupsSelectIds', function (ids) {
        selected_ids = ids;
    });
    $('#apply-filters').click(function () {
        var meta_group_ids = []
        root_el.find('.meta-groups input:checkbox:checked').each(function () {
            meta_group_ids.push($(this).val());
        });
        var meta_levels = []
        root_el.find('.meta-levels input:checkbox:checked').each(function () {
            meta_levels.push($(this).val());
        });
        items.url = '/data/invTypes?' + $.param({
            marketGroupID: selected_ids,
            metaGroupID: meta_group_ids,
            metaLevel: meta_levels
        }, true);
        items.fetch({reset: true});
    });

});
