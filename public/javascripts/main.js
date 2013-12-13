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

        var columns = [
            { name: 'typeName', label: 'Item', cell: 'string' },
            { name: 'price', label: 'Price', cell: 'number' },
            { name: 'volRemaining', label: 'Vol. Entered', cell: 'number' },
            { name: 'volEntered', label: 'Vol. Remaining', cell: 'number' },
            { name: 'stationName', label: 'Station', cell: 'string' }
        ];

        var grid = new Backgrid.Grid({
            columns: columns,
            collection: orders
        });

        $('#gridplay').append(grid.render().$el);

        orders.fetch({reset: true});
    
    });

});
