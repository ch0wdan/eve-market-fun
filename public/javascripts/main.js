$(document).ready(function () {

    console.log("HELLO WORLD");

    var EventHub = _.extend({}, Backbone.Events);

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

    $('#tree').each(function () {
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
                EventHub.trigger('marketGroupsSelected', selected_ids);
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
                    class: 'showMarketDetails',
                    href: '',
                    "data-typeID": typeID
                })
                .append($("<img>", {
                    class: 'itemThumb',
                    src: 'http://image.eveonline.com/Type/' + typeID + '_32.png',
                    "data-itemID": typeID
                }))
                .append($("<span>").text(formattedValue))
            );
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

    if (true) $('#items').each(function () {
        var InvType = Backbone.Model.extend({});
        
        //var InvTypes = Backbone.Collection.extend({
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
            { name: 'techLevel', label: 'Tech', editable: false, cell: 'integer' },
            { name: 'metaLevel', label: 'Meta', editable: false, cell: 'integer' },
            { name: 'metaGroupName', label: 'Meta Group', editable: false, cell: 'string' },
            { name: 'categoryName', label: 'Category', editable: false, cell: 'string' },
            { name: 'groupName', label: 'Group', editable: false, cell: 'string' },
            { name: 'volume', label: 'Volume', editable: false, cell: 'number' }
        ];

        var grid = new Backgrid.Grid({
            columns: columns,
            collection: items
        });
        $('#items').append(grid.render().$el);

        var paginator = new Backgrid.Extension.Paginator({
            collection: items
        });
        $('#items').append(paginator.render().$el);

        var filter = new Backgrid.Extension.ClientSideFilter({
            collection: items.fullCollection,
            fields: ['typeName']
        });
        $('#items').prepend(filter.render().$el);
        //filter.$el.css({float: "left", margin: "20px"});

        items.fetch({reset: true});

        EventHub.on('marketGroupsSelected', function (selected_ids) {
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
