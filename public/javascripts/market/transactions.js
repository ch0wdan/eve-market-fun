$(document).ready(function () {

    var LAST_ORDER_CHAR = 'evemf_last_order_char';

    var Transaction = Backbone.Model.extend({});
    var Transactions = Backbone.PageableCollection.extend({
        model: Transaction,
        url: '/data/market/transactions',
        mode: 'client',
        state: { pageSize: 100 }
    });
    var transactions = new Transactions();

    var columns = [
        { name: 'transactionDateTime', label: 'When', editable: false, cell: AgeCell },
        { name: 'typeName', label: 'Type', editable: false,
            cell: ShowMarketDetailsCell.extend({
                typeIDAttr: 'typeID'
            }) },
        { name: 'price', label: 'Price', editable: false, cell: 'string' },
        { name: 'quantity', label: 'Quantity', editable: false, cell: 'string' },
        { name: 'clientName', label: 'Client', editable: false, cell: 'string' },
        { name: 'stationName', label: 'Where', editable: false, cell: 'string' }
    ];

    var grid = new Backgrid.Grid({
        columns: columns,
        collection: transactions
    });

    var transactions_el = $('#transactions');
    transactions_el.append(grid.render().$el);

    var paginator = new Backgrid.Extension.Paginator({
        collection: transactions
    });
    transactions_el.append(paginator.render().$el);

    var loadTransactions = function (characterID) {
        if (!characterID) return;
        transactions.url = "/data/market/transactions?character=" + characterID;
        transactions.fetch({reset: true});
    }

    var select_el = $('#characters');
    select_el.selectpicker({
        showSubtext: true
    }).on('change', function () {
        var char_id = select_el.val();
        loadTransactions(char_id);
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
