$(document).ready(function () {
    var selected_group_ids = {};
    
    var browser = new Market.ItemBrowser.TypeBrowser($('#typeBrowser'));
    browser.on('selected', function (selected_groups) {
        selected_group_ids = _.keys(selected_groups);
        updateTypes();
    });

    function updateTypes () {
        var type_list = $('#typeResults');
        type_list.empty();
        var params = {
            marketGroupID: selected_group_ids
        };
        $.getJSON('/data/invTypes?' + $.param(params), function (data) {
            _.each(data, function (type) {
                var li = $('<li>');
                li.html(type.typeName);
                type_list.append(li);
            });
        });
    }
});

if ('undefined' === typeof Market) { Market = {}; }
Market.ItemBrowser = { };

(function (exports) {

    exports.TypeBrowser = function () {
        this.init.apply(this, arguments);
    };
    _.extend(exports.TypeBrowser.prototype, Backbone.Events, {
        
        init: function (container, options) {
            var self = this;
            
            self.options = _.defaults(options || {}, { });
            self.container = $(container);
            self.container.data('TypeBrowser', self);

            self.selected = {};

            self.head = new exports.TypeBrowserColumn(self);
            self.head.update();
        },

        setSelected: function (selected) {
            var self = this;
            self.selected = selected;
            self.trigger('selected', selected);
        }

    });

    exports.TypeBrowserColumn = function () {
        this.init.apply(this, arguments);
    };
    _.extend(exports.TypeBrowserColumn.prototype, {

        init: function (browser, options) {
            var self = this;

            self.options = _.defaults(options || {}, {
                root: false
            });

            self.browser = browser;
            self.next = null;
            self.groups = null;
            self.selected = {};

            self.col = $('<div class="column">');
            self.col.data('TypeBrowserColumn', self);

            self.list = $('<ol>');
            self.col.append(self.list);
            self.browser.container.append(self.col);

            self.list.selectable({
                selected: function (ev, ui) {
                    var id = $(ui.selected).data('groupID');
                    if (self.groups[id]) {
                        self.selected[id] = self.groups[id];
                    }
                    self.scheduleUpdateSelection();
                },
                unselected: function (ev, ui) {
                    var id = $(ui.unselected).data('groupID');
                    if (self.selected[id]) {
                        delete self.selected[id];
                    }
                    self.scheduleUpdateSelection();
                }
            });

            self.col.hide().fadeIn();
            setTimeout(function () {
                self.browser.container.animate({
                    scrollLeft: self.browser.container.width()
                });
            }, 0.1);
        },

        remove: function () {
            var self = this;
            if (self.next) {
                self.next = self.next.remove();
            }
            self.col.fadeOut(250, function () {
                self.col.remove();
            });
            return null;
        },

        scheduleUpdateSelection: function () {
            var self = this;
            if (self.updateWaitTimer) { return; }
            self.updateWaitTimer = setTimeout(function () {
                self.updateSelection();
                self.updateWaitTimer = null;
            }, 25);
        },

        updateSelection: function () {
            var self = this;

            self.browser.setSelected(self.selected);

            var parent_ids = [];
            _.each(self.selected, function (group, id) {
                if (group && group.children) { parent_ids.push(id); }
            });

            if (0 === parent_ids.length && self.next) {
                self.next = self.next.remove();
            } else if (parent_ids.length) {
                if (!self.next) {
                    self.next = new exports.TypeBrowserColumn(self.browser);
                }
                self.next.update(parent_ids);
            }
        },

        update: function (ids) {
            var self = this;

            if (self.next) {
                self.next = self.next.remove();
            }
            self.selected = {};
            self.list.empty();
            self.list.append($('<li class="loading">Loading...</li>'));

            var params = { shallow: true };
            if (ids) { params.root = ids; }
            var url = '/data/invMarketGroups?' + $.param(params);
            $.getJSON(url, function (data) {
                if (!ids) {
                    self.groups = data;
                } else {
                    self.groups = {};
                    _.each(data, function (parent, parentID) {
                        _.extend(self.groups, parent.children);
                    });
                }
                self.list.empty();
                var items = data;
                _.each(self.groups, function (group, groupID) {
                    var iconURL = group.iconURL || '/blank.gif';
                    var li = $('<li>');
                    li.data('group', group);
                    li.data('groupID', groupID);
                    li.append('<img src="' + iconURL + '">');
                    li.append($('<span>').html(group.marketGroupName));
                    if (group.children) {
                        li.addClass('hasChildren');
                    }
                    self.list.append(li);
                });
            });
        }

    });


})(Market.ItemBrowser);
