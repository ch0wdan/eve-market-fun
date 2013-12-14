$(document).ready(function () {

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
    
    $('#gridplay').each(function () {
        
        var MarketOrder = Backbone.Model.extend({});
        
        var MarketOrders = Backbone.Collection.extend({
            model: MarketOrder,
            url: "/orders.json?type=sell"
        });

        var orders = new MarketOrders();

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

        var columns = [
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

        $('#gridplay').append(grid.render().$el);

        orders.fetch({reset: true});
    
    });

});
