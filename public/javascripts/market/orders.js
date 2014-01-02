$(document).ready(function () {

$('.selectpicker').selectpicker();

var MarketOrder = Backbone.Model.extend({});

var MarketOrders = Backbone.Collection.extend({
    model: MarketOrder,
    url: "/data/market/orders?character=Pham+Vrinimi"
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
