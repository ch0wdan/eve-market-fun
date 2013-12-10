$(document).ready(function () {

    $('.marketorders').delegate('a', 'click', function () {
        var target = $(this);
        if (!target.data('typeid')) return;
        CCPEVE.showMarketDetails(target.data('typeid'));
        return false;
    });

});
