var util = require('util');
var _ = require('underscore');
var forms = require('forms'),
    fields = forms.fields,
    widgets = forms.widgets,
    validators = forms.validators;

exports.signup = function () {
    return form({
        username: fields.string({ required: true }),
        email: fields.email(),
        password: fields.password({ required: true }),
        confirm:  fields.password({
            required: true,
            validators: [validators.matchField('password')]
        })
    });
};

function form (opt) {
    var form = forms.create(opt);
    var orig_toHTML = form.toHTML;
    form.toHTML = function () {
        util.debug("MY TO HTML " + util.inspect(form));
        return orig_toHTML.call(form, formatField);
    };
    return form;
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
