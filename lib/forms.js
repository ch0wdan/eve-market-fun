var util = require('util');
var _ = require('underscore');

var Promise = require('bluebird');

var forms = require('forms'),
    fields = forms.fields,
    widgets = forms.widgets,
    validators = forms.validators;

var check = require('validator').check,
    sanitize = require('validator').sanitize;

exports.signup = function () {
    return form({
        username: fields.string({ required: true }),
        email: fields.email({ required: true }),
        password: fields.password({ required: true }),
        confirm:  fields.password({
            required: true,
            validators: [validators.matchField('password')]
        })
    });
};

exports.apikey = function () {
    return form({
        keyID: fields.number({
            required: true,
            validators: [function (form, field, cb) {
                try {
                    check(field.data).isNumeric();
                    cb();
                } catch (e) {
                    cb("Invalid KeyID");
                }
            }]
        }),
        vCode: fields.string({
            required: true,
            validators: [function (form, field, cb) {
                try {
                    check(field.data).isAlphanumeric();
                    cb();
                } catch (e) {
                    cb("Invalid VCode " + e);
                }
            }]
        })
    });
};

function form (opt) {
    var addons = {
        render: function () {
            return this.toHTML(formatField)
        },
        handleAsync: function (req) {
            var form = this;
            return new Promise(function (resolve, reject) {
                form.handle(req, {
                    success: function (form) { resolve(form); },
                    empty: function (form) { resolve(form); },
                    error: function (form) { reject(form); }
                });
            });
        }
    };
    var f = forms.create(opt);
    _.extend(f, addons);
    var orig_bind = f.bind;
    f.bind = function (data) {
        var b = orig_bind.call(f, data);
        _.extend(b, addons);
        return b;
    };
    return f;
}

function formatField (name, object) {

    var label_for = 'id_' + name;
    var label_html = [
        '<label for="', label_for, '">',
        object.labelText(name),
        '</label>'
    ].join('');

    var outer_classes = ['form-group'];
    var error_html = '';
    if (object.error) {
        outer_classes.push('has-error');
        error_html = [
            '<p class="form-error-tooltip">',
            object.error,
            '</p>'
        ].join('');
    }

    var widget = object.widget;
    object.widget.classes = object.widget.classes || [];
    object.widget.classes.push('form-control');
    var widget_html = [
        object.widget.toHTML(name, object),
        error_html
    ].join('');

    return [
        '<div class="', outer_classes.join(' '), '">',
        label_html, widget_html,
        '</div>'
    ].join('');

}
