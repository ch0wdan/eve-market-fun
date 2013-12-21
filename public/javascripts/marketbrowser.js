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
                    for: 'metaLevel-' + r.metaLevel
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
                    for: 'metaGroup-' + r.metaGroupID
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
    
    var ShowInfoCell = Backgrid.Cell.extend({
        className: "showinfo-cell",
        typeID: '3867',
        itemIDAttr: 'itemID',
        render: function () {
            this.$el.empty();
            var rawValue = this.model.get(this.column.get("name"));
            var formattedValue = this.formatter.fromRaw(rawValue, this.model);
            var itemID = this.model.get(this.itemIDAttr);
            this.$el.append($("<a>", {
                class: 'showInfo',
                href: '',
                "data-typeID": this.typeID,
                "data-itemID": itemID
            }).text(formattedValue));
            this.delegateEvents();
            return this;
        }
    });

    var ShowMarketDetailsCell = Backgrid.Cell.extend({
        className: "showmarketdetails-cell",
        typeIDAttr: 'typeID',
        render: function () {
            this.$el.empty();
            var rawValue = this.model.get(this.column.get("name"));
            var formattedValue = this.formatter.fromRaw(rawValue, this.model);
            var typeID = this.model.get(this.typeIDAttr);
            this.$el.append(
                $("<a>", {
                    class: 'showInfo',
                    href: "",
                    "data-typeID": this.model.get('typeID'),
                    title: this.model.get('description')
                })
                .append($("<img>", {
                    class: 'itemThumb',
                    src: 'http://image.eveonline.com/Type/' + typeID + '_32.png',
                    "data-typeID":  this.model.get('typeID')
                })));
            this.$el.append(
                $("<a>", {
                    class: 'showMarketDetails',
                    href: '',
                    "data-typeID": typeID
                })
                .append($("<span>").text(formattedValue)));
            this.delegateEvents();
            return this;
        }
    });

    var ProgressIntegerCell = Backgrid.Cell.extend({
        className: "progressinteger-cell",
        totalAttr: "volEntered",
        render: function () {
            this.$el.empty();
            var rawValue = this.model.get(this.column.get("name"));
            var formattedValue = this.formatter.fromRaw(rawValue, this.model);
            var totalValue = this.model.get(this.totalAttr);
            this.$el
                .append($('<span>', {class: 'remaining'}).text(formattedValue))
                .append($('<span>').text(' / '))
                .append($('<span>', {class: 'total'}).text(totalValue))
            this.delegateEvents();
            return this;
        }
    });

    var NamedIntegerCell = Backgrid.IntegerCell.extend({
        className: "metalevel-cell",
        nameAttr: "metaGroupName",
        render: function () {
            this.$el.empty();
            var rawValue = this.model.get(this.column.get("name"));
            var formattedValue = this.formatter.fromRaw(rawValue, this.model);
            var nameValue = this.model.get(this.nameAttr);
            var out = (nameValue) ? nameValue + ' / ' : '';
            out += 'Meta ' + formattedValue;
            this.$el.append($('<span>', {class: 'name', title: rawValue})
                            .text(out));
            this.delegateEvents();
            return this;
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
