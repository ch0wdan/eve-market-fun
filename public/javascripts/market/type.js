$(document).ready(function () {

    $('.marketorders').each(function () {
        var root_el = $(this);
        var type_id = root_el.attr('data-typeID');
        console.log(type_id);

        ['sell', 'buy'].forEach(function (bid_type, idx) {
            
            var orders = new Market.MarketOrders();
            orders.state.pageSize = 5;
            orders.url = "/data/market/type/" + type_id + "?bid=" + idx;

            var grid = new Backgrid.Grid({
                columns: Market.MarketColumns,
                collection: orders
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

            orders.fetch({reset: true});
        });
    });

});
