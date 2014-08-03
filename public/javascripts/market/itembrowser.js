$(document).ready(function () {

    var selected_group_ids = {};
    var q = null;
    var category = null;
    var tech_level = null;
    var meta_level = null;
    var meta_group = null;

    // Wire up the typeahead search to set browser state
    $('#typeSearch').typeahead({
        highlight: true,
        minLength: 2
    }, {
        name: 'types',
        source: function (query, cb) {
            $.getJSON('/data/invTypes', {q: query}, function (types) {
                cb(_.map(types, function (type) {
                    return _.defaults({
                        value: type.typeName + ' (' + type.categoryName + ')'
                    }, type);
                }))
            });
        } 
    }).bind('typeahead:selected', function (ev, type, name) {
        q = type.typeName;
        updateTypes();
    }).bind('change', function (ev) {
        q = $(ev.target).val();
        updateTypes();
    });

    var tech_level_el = $('#techLevels');
    tech_level_el.selectpicker().on('change', function () {
        tech_level = tech_level_el.val();
        updateTypes();
    });

    var category_el = $('#invCategories');
    category_el.selectpicker().on('change', function () {
        category = category_el.val();
        updateTypes();
    });
    $.getJSON('/data/invCategories', function (data) {
        _.each(data, function (r) {
            category_el.append($('<option>', {
                id: 'metaLevel-' + r.metaLevel,
                value: r.categoryID,
                // "data-subtext": r.invTypesCount
                "data-content": '<img class="small-icon" src="'+ r.iconURL +'"> ' + r.categoryName
            }).text(r.categoryName));
        });
        category_el.selectpicker('refresh');
    });

    var meta_level_el = $('#metaLevels');
    meta_level_el.selectpicker().on('change', function () {
        meta_level = meta_level_el.val();
        updateTypes();
    });
    $.getJSON('/data/invMetaLevels', function (data) {
        _.each(data, function (r) {
            if (!r.metaLevel) { return; }
            meta_level_el.append($('<option>', {
                id: 'metaLevel-' + r.metaLevel,
                value: r.metaLevel,
                // "data-subtext": r.invTypesCount
            }).text('Meta ' + r.metaLevel));
        });
        meta_level_el.selectpicker('refresh');
    });

    var meta_group_el = $('#metaGroups');
    meta_group_el.selectpicker().on('change', function () {
        meta_group = meta_group_el.val();
        updateTypes();
    });
    $.getJSON('/data/invMetaGroups', function (data) {
        _.each(data, function (r) {
            meta_group_el.append($('<option>', {
                id: 'metaGroup-' + r.metaGroupID,
                value: r.metaGroupID,
                // "data-subtext": r.invTypesCount
                // "data-content": '<img src="'+ img_src +'" class="character-select"> ' +
            }).text(r.metaGroupName));
        });
        meta_group_el.selectpicker('refresh');
    });
    
    var browser = new Market.ItemBrowser.TypeBrowser($('#typeBrowser'));
    browser.on('selected', function (selected_groups) {
        selected_group_ids = _.keys(selected_groups);
        updateTypes();
    });

    function updateTypes () {
        var type_list = $('#typeResults');
        type_list.empty();
        var params = {
            q: q,
            marketGroupID: selected_group_ids,
            techLevel: tech_level,
            metaGroupID: meta_group,
            metaLevel: meta_level,
            categoryID: category
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
                    var li = $('<li>');
                    li.data('group', group);
                    li.data('groupID', groupID);
                    li.append('<img src="' + group.iconURL + '">');
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
