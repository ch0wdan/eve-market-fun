$(document).ready(function () {

    var Market = window.Market = {};

    Market.MarketOrder = Backbone.Model.extend({
    });

    Market.MarketOrders = Backbone.PageableCollection.extend({
        model: Market.MarketOrder,
        mode: 'client',
        state: { pageSize: 15 }
    });

    Market.MarketColumns = [
        { name: 'orderState', label: 'State', editable: false, cell: 'integer' },
        { name: 'bidType', label: 'Sell/Buy', editable: false, cell: 'string' },
        { name: 'typeName', label: 'Item', editable: false,
            cell: ShowMarketDetailsCell.extend({typeIDAttr: 'typeID'}) },
        { name: 'price', label: 'Price', cell: 'number', editable: false },
        { name: 'volRemaining', label: 'Volume', editable: false,
            cell: ProgressIntegerCell.extend({totalAttr: 'volEntered'}) },
        { name: 'stationName', label: 'Station', editable: false,
            cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'stationID'}) },
    ];

});
