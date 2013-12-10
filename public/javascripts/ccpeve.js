if (typeof CCPEVE == 'undefined') {
    var CCPEVE = window.CCPEVE = {};
    var stub_names = [
        'showMarketDetails'
    ];
    for (var i=0; i<stub_names.length; i++) {
        (function (name) {
            CCPEVE[name] = function () {
                var args = JSON.stringify(Array.prototype.slice.apply(arguments));
                console.log("CCPEVE."+name+"("+args+")");
            }
        })(stub_names[i]);
    }
}
