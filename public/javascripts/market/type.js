$(document).ready(function () {

    var root_el = $('.margins');
    var type_id = root_el.attr('data-typeID');

    var MarketMargin = Backbone.Model.extend({ });

    var MarketMargins = Backbone.PageableCollection.extend({
        model: MarketMargin,
        url: '/data/market/margins?typeID=' + type_id,
        mode: 'client',
        state: { pageSize: 50 }
    });

    var margins = new MarketMargins();

    var columns = [
        { name: 'regionName', label: 'Region', cell: 'string', editable: false },
        { name: 'stationName', label: 'Station', editable: false,
            cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'stationID'}) },
        { name: 'maxBuyPrice', label: 'Buy', cell: 'number', editable: false },
        { name: 'minSellPrice', label: 'Sell', cell: 'number', editable: false },
        { name: 'baseMarginPercent', label: 'Margin %', cell: 'number', editable: false },
        { name: 'baseMargin', label: 'Margin', cell: 'number', editable: false },
        { name: 'avgDailyVolumeForMonth', label: 'Volume', cell: 'number', editable: false },
        { name: 'volatilityForMonth', label: 'Volatility', cell: 'number', editable: false }
    ];

    var grid = new Backgrid.Grid({
        columns: columns, 
        collection: margins
    });
    root_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: margins
    });
    root_el.append(paginator.render().$el);

    margins.fetch({reset: true});

});
