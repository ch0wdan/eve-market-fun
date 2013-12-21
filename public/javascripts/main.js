$(document).ready(function () {

    var event_hub = _.extend({}, Backbone.Events);

    $(document)
        .delegate('a.showMarketDetails', 'click', function () {
            var el = $(this);
            CCPEVE.showMarketDetails(el.data('typeid'));
            return false;
        })
        .delegate('a.showInfo', 'click', function () {
            var el = $(this);
            CCPEVE.showInfo(el.data('typeid'), el.data('itemid'));
            return false;
        });

    $('#market-filters .tree').each(function () {
        var tree = $(this);
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
        tree.fancytree({
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
                console.log(node.title);
            },
            select: function (event, data) {
                var node = data.node;
                var selected_ids = _.chain(data.tree.getSelectedNodes())
                    .map(function (node) { return node.key })
                    .value();
                event_hub.trigger('marketGroupsSelectIds', selected_ids);
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
    
    });

    var selected_ids = null;
    event_hub.on('marketGroupsSelectIds', function (ids) {
        selected_ids = ids;
    });
    $('#apply-filters').click(function () {
        event_hub.trigger('marketGroupsSelected', selected_ids);
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
            var nameValue = this.model.get(this.nameAttr) || rawValue;
            this.$el.append($('<span>', {class: 'name', title: rawValue})
                            .text(nameValue));
            this.delegateEvents();
            return this;
        }
    });

    var M3VolumeCell = Backgrid.NumberCell.extend({
        className: "m3volume-cell",
        render: function () {
            this.$el.empty();
            var rawValue = this.model.get(this.column.get("name"));
            var formattedValue = this.formatter.fromRaw(rawValue, this.model);
            this.$el.append($('<span>', {class: 'm3'}).text(formattedValue));
            this.delegateEvents();
            return this;
        }
    });

    $('#market-items .items').each(function () {
        var items_el = $(this);
        var InvType = Backbone.Model.extend({});
        
        var InvTypes = Backbone.PageableCollection.extend({
            model: InvType,
            url: "/data/invTypes?marketGroupID=4",
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

        event_hub.on('marketGroupsSelected', function (selected_ids) {
            items.url = '/data/invTypes?marketGroupID=' + selected_ids.join('&marketGroupID=');
            items.fetch({reset: true});
        });
    });
    
    $('#marketorders').each(function () {
        
        var MarketOrder = Backbone.Model.extend({});
        
        var MarketOrders = Backbone.Collection.extend({
            model: MarketOrder,
            url: "/data/orders.json" //?type=sell"
        });

        var orders = new MarketOrders();

        var columns = [
            { name: 'bidType', label: 'Sell/Buy', editable: false, cell: 'string' },
            { name: 'typeName', label: 'Item', editable: false,
                cell: ShowMarketDetailsCell.extend({typeIDAttr: 'typeID'}) },
            { name: 'price', label: 'Price', cell: 'number', editable: false },
            { name: 'volRemaining', label: 'Volume', editable: false,
                cell: ProgressIntegerCell.extend({totalAttr: 'volEntered'}) },
            { name: 'stationName', label: 'Station', editable: false,
                cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'stationID'}) },
        ];

        var grid = new Backgrid.Grid({
            columns: columns,
            collection: orders
        });

        $('#marketorders').append(grid.render().$el);

        orders.fetch({reset: true});
    
    });

});
