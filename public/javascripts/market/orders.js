$(document).ready(function () {

    var LAST_ORDER_CHAR = 'evemf_last_order_char';

    var MarketOrder = Backbone.Model.extend({
    });

    var MarketOrders = Backbone.PageableCollection.extend({
        model: MarketOrder,
        mode: 'client',
        state: { pageSize: 15 }
    });

    var orders = new MarketOrders();

    var columns = [
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

    var grid = new Backgrid.Grid({
        columns: columns,
        collection: orders
    });

    var orders_el = $('#marketorders');
    orders_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: orders
    });
    orders_el.append(paginator.render().$el);

    var filter = new Backgrid.Extension.ClientSideFilter({
        collection: orders.fullCollection,
        fields: ['typeName']
    });

    var loadOrders = function (characterID) {
        if (!characterID) return;
        orders.url = "/data/market/orders?character=" + characterID;
        //orders.url = "/data/market/orders?regionID=10000032&typeID=30834"
        orders.fetch({reset: true});
    }

    var select_el = $('#characters');
    select_el.selectpicker({
        showSubtext: true
    }).on('change', function () {
        var char_id = select_el.val();
        loadOrders(char_id);
        $.cookie(LAST_ORDER_CHAR, char_id);
    });

    $.getJSON('/data/profile', function (data) {
        select_el.empty();
        _.each(data.apiKeys, function (key) {
            _.each(key.characters, function (character) {
                var img_src = 'https://image.eveonline.com/Character/' +
                    character.characterID + '_32.jpg';
                select_el.append($('<option>', {
                    value: character.characterID,
                    "data-subtext": '('+key.keyID+')',
                    "data-content": '<img src="'+ img_src +'" class="character-select"> ' +
                        character.name
                }).text(character.name));
            });
        });
        select_el.selectpicker('refresh');
        var last_char_id = $.cookie(LAST_ORDER_CHAR);
        if (last_char_id) {
            select_el.selectpicker('val', last_char_id);
        }
    });

});
