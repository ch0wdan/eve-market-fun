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

});
