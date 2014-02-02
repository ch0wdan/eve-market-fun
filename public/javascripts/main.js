$(document).ready(function () {

    $(document)
        .delegate('a.showMarketDetails', 'click', function () {
            var el = $(this);
            var type_id = el.data('typeid');
            CCPEVE.showMarketDetails(el.data('typeid'));
            window.location.href = '/market/type/' + type_id;
            return false;
        })
        .delegate('a.showInfo', 'click', function () {
            var el = $(this);
            CCPEVE.showInfo(el.data('typeid'), el.data('itemid'));
            return false;
        });

    if ($('body').hasClass('eve-untrusted') && !CCPEVE.mock) {
        CCPEVE.requestTrust(location.href);
        location.reload();
    }
});

/**
* $.parseParams - parse query string paramaters into an object.
*/
(function($) {
    var re = /([^&=]+)=?([^&]*)/g;
    var decodeRE = /\+/g; // Regex for replacing addition symbol with a space
    var decode = function (str) {return decodeURIComponent( str.replace(decodeRE, " ") );};
    $.parseParams = function(query) {
        var params = {}, e;
        while ( e = re.exec(query) ) {
            var k = decode( e[1] ), v = decode( e[2] );
            if (k.substring(k.length - 2) === '[]') {
                k = k.substring(0, k.length - 2);
                (params[k] || (params[k] = [])).push(v);
            }
            else params[k] = v;
        }
        return params;
    };
})(jQuery);

var ShowInfoCell = Backgrid.Cell.extend({
    className: "showinfo-cell",
    typeID: '3867',
    itemIDAttr: 'itemID',
    render: function () {
        this.$el.empty();
        var rawValue = this.model.get(this.column.get("name"));
        var formattedValue = this.formatter.fromRaw(rawValue, this.model);
        var itemID = this.model.get(this.itemIDAttr);
        this.$el.append($("<a>", {
            class: 'showInfo',
            href: '',
            "data-typeID": this.typeID,
            "data-itemID": itemID
        }).text(formattedValue));
        this.delegateEvents();
        return this;
    }
});

var ShowMarketDetailsCell = Backgrid.Cell.extend({
    className: "showmarketdetails-cell",
    typeIDAttr: 'typeID',
    render: function () {
        this.$el.empty();
        var rawValue = this.model.get(this.column.get("name"));
        var formattedValue = this.formatter.fromRaw(rawValue, this.model);
        var typeID = this.model.get(this.typeIDAttr);
        this.$el.append(
            $("<a>", {
                class: 'showInfo',
                href: "",
                "data-typeID": this.model.get('typeID'),
                title: this.model.get('description')
            })
            .append($("<img>", {
                class: 'itemThumb',
                src: 'http://image.eveonline.com/Type/' + typeID + '_32.png',
                "data-typeID":  this.model.get('typeID')
            })));
        this.$el.append(
            $("<a>", {
                class: 'showMarketDetails',
                href: '',
                "data-typeID": typeID
            })
            .append($("<span>").text(formattedValue)));
        this.delegateEvents();
        return this;
    }
});

var ProgressIntegerCell = Backgrid.Cell.extend({
    className: "progressinteger-cell",
    totalAttr: "volEntered",
    render: function () {
        this.$el.empty();
        var rawValue = this.model.get(this.column.get("name"));
        var formattedValue = this.formatter.fromRaw(rawValue, this.model);
        var totalValue = this.model.get(this.totalAttr);
        this.$el
            .append($('<span>', {class: 'remaining'}).text(formattedValue))
            .append($('<span>').text(' / '))
            .append($('<span>', {class: 'total'}).text(totalValue))
        this.delegateEvents();
        return this;
    }
});

var NamedIntegerCell = Backgrid.IntegerCell.extend({
    className: "metalevel-cell",
    nameAttr: "metaGroupName",
    render: function () {
        this.$el.empty();
        var rawValue = this.model.get(this.column.get("name"));
        var formattedValue = this.formatter.fromRaw(rawValue, this.model);
        var nameValue = this.model.get(this.nameAttr);
        var out = (nameValue) ? nameValue + ' / ' : '';
        out += 'Meta ' + formattedValue;
        this.$el.append($('<span>', {class: 'name', title: rawValue})
                        .text(out));
        this.delegateEvents();
        return this;
    }
});
