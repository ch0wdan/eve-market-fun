$(document).ready(function () {

    var Trade = Backbone.Model.extend({});
    var Trades = Backbone.PageableCollection.extend({
        model: Trade,
        url: '/data/market/trades',
        mode: 'client',
        state: { pageSize: 100 }
    });
    var trades = new Trades();

    var columns = [

        { name: 'updated_at', label: 'When', editable: false, cell: AgeCell },

        { name: 'typeName', label: 'Type', editable: false,
            cell: ShowMarketDetailsCell.extend({
                typeIDAttr: 'typeID'
            }) },

        { name: 'baseMarginPercent', label: '%', editable: false, cell: 'number' },
        
        //{ name: 'fromStationName', label: 'Station', editable: false,
        //    cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'fromStationID'}) },
        { name: 'fromSolarSystemName', label: 'From', editable: false,
            cell: ShowInfoCell.extend({typeID: '5', itemIDAttr: 'fromSolarSystemID'}) },
        { name: 'fromPrice', label: 'From Price', editable: false, cell: 'number' },
        
        //{ name: 'toStationName', label: 'Station', editable: false,
        //    cell: ShowInfoCell.extend({typeID: '3867', itemIDAttr: 'toStationID'}) },
        { name: 'toSolarSystemName', label: 'To', editable: false,
            cell: ShowInfoCell.extend({typeID: '5', itemIDAttr: 'toSolarSystemID'}) },
        { name: 'toPrice', label: 'To Price', editable: false, cell: 'number' },

        { name: 'baseMargin', label: 'Margin', editable: false, cell: 'number' },

    ];

    var grid = new Backgrid.Grid({
        columns: columns,
        collection: trades
    });

    var trades_el = $('#trades');
    trades_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: trades
    });
    trades_el.append(paginator.render().$el);

    trades.fetch({reset: true});

});
