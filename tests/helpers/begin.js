QUnit.begin(function() {
  Ember.testing = true;
  Ember.Test.adapter = Ember.Test.QUnitAdapter.create();
  Ember.RSVP.configure('onerror', function(reason) {
    // only print error messages if they're exceptions;
    // otherwise, let a future turn of the event loop
    // handle the error.
    if (reason && reason instanceof Error) {
      Ember.Logger.log(reason, reason.stack)
      throw reason;
    }
  });

  var transforms = {
    'boolean': DS.BooleanTransform.create(),
    'date':    DS.DateTransform.create(),
    'number':  DS.NumberTransform.create(),
    'string':  DS.StringTransform.create()
  };

  // Prevent all tests involving serialization to require a container
  DS.JSONSerializer.reopen({
    transformFor: function(attributeType) {
      return this._super(attributeType, true) || transforms[attributeType];
    }
  });
});

// Generate the jQuery expando on window ahead of time
// to make the QUnit global check run clean
jQuery(window).data('testing', true);
