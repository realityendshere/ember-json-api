var get = Ember.get;
var isNone = Ember.isNone;

function sysout(title) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.groupCollapsed(title);
  args.forEach(function(arg) {
    console.dir(arg);
  });
  console.groupEnd();
}

DS.JsonApiSerializer = DS.RESTSerializer.extend({
  keyForRelationship: function(key) {
    return key;
  },

  extractSingle: function() {
    console.log('extractSingle', arguments);
    return this._super.apply(this, arguments);
  },

  /**
   * Flatten links
   */
  normalize: function(type, hash, prop) {
    sysout('normalize start ' + type.typeKey, hash);
    var json = {};
    for (var key in hash) {
      // This is already normalized
      if (key === 'links') {
        json[key] = hash[key];
        continue;
      }

      var camelizedKey = Ember.String.camelize(key);
      json[camelizedKey] = hash[key];
    }
    sysout('normalize end ' + type.typeKey, json);
    return this._super(type, json, prop);
  },

  /**
   * Extract top-level "meta" & "links" before normalizing.
   */
  normalizePayload: function(payload) {
    console.log('PAYLOAD', Ember.$.extend({}, payload));
    var data = payload.data;
    if (data) {
      if(Ember.isArray(data)) {
        this.extractArrayData(data, payload);
      } else {
        this.extractSingleData(data, payload);
      }
      delete payload.data;
    }
    if (payload.meta) {
      this.extractMeta(payload.meta);
      delete payload.meta;
    }
    if (payload.links) {
      this.extractLinks(payload.links, payload);
      console.log('deleting links from payload');
      delete data.links;
    }
    if (payload.linked) {
      this.extractLinked(payload.linked);
      console.log('deleting payload links');
      delete payload.linked;
    }
    console.log('normalizePayload', Ember.$.extend({}, payload));
    return payload;
  },

  /**
   * Extract top-level "data" containing a single primary data
   */
  extractSingleData: function(data, payload) {
    if(data.links) {
      console.log('extracting links for single data');
      this.extractLinks(data.links, data);
      //delete data.links;
    }
    payload[data.type] = data;
    delete data.type;
  },

  /**
   * Extract top-level "data" containing a single primary data
   */
  extractArrayData: function(data, payload) {
    console.log('extractArrayData');
    var type = data.length > 0 ? data[0].type : null;
    data.forEach(function(item) {
      if(item.links) {
        this.extractLinks(data.links, data);
        //delete data.links;
      }
    }.bind(this));

    payload[type] = data;
  },

  /**
   * Extract top-level "linked" containing associated objects
   */
  extractLinked: function(linked) {
    var store = get(this, 'store'), models = {};

    linked.forEach(function(link) {
      var type = link.type;
      delete link.type;
      if(!models[type]) {
        models[type] = [];
      }
      models[type].push(link);
    });
    console.log('pushing payload', models);
    this.pushPayload(store, models);
  },

  /**
   * Parse the top-level "links" object.
   */
  extractLinks: function(links, resource) {
    sysout('extractLinks start', links, resource);
    var link, association, id, route, linkKey;
    // Used in unit test
    var extractedLinks = [], linkEntry;

    // Clear the old format
    delete resource.links;

    for (link in links) {
      association = links[link];
      link = Ember.String.camelize(link.split('.').pop());
      if(!association) { continue; }
      if (typeof association === 'string') {
        if (association.indexOf('/') > -1) {
          route = association;
          id = null;
        } else {
          route = null;
          id = association;
        }
      } else {
        route = association.resource || association.self;
        id = association.id || association.ids;
      }
      console.log('link', link, route, id);
      if (route) {
        if (!resource.links) {
          resource.links = {};
        }
        resource.links[link] = route;

        // strip base url
        if (route.substr(0, 4).toLowerCase() === 'http') {
          route = route.split('//').pop().split('/').slice(1).join('/');
        }
        // strip prefix slash
        if (route.charAt(0) === '/') {
          route = route.substr(1);
        }

        DS._routes[link] = route;
        linkEntry = {};
        linkEntry[link] = route;
        extractedLinks.push(linkEntry)
      }
      resource[link] = id;
    }
    sysout('extractLinks end', resource);
    return extractedLinks;
  },

  // SERIALIZATION

  serializeIntoHash: function(hash, type, snapshot, options) {
    console.log('hashing');
    var pluralType = Ember.String.pluralize(type.typeKey),
      data = this.serialize(snapshot, options);
    if(!data.hasOwnProperty('type')) {
      data.type = pluralType;
    }
    hash[type.typeKey] = data;
  },

  /**
   * Use "links" key, remove support for polymorphic type
   */
  serializeBelongsTo: function(record, json, relationship) {
    sysout('serializeBelongsTo', json);
    var attr = relationship.key;
    var belongsTo = record.belongsTo(attr);
    var type = this.keyForRelationship(relationship.type.typeKey);
    var key = this.keyForRelationship(attr);

    if (isNone(belongsTo)) return;

    json.links = json.links || {};
    json.links[key] = belongsToLink(key, type, get(belongsTo, 'id'));
  },

  /**
   * Use "links" key
   */
  serializeHasMany: function(record, json, relationship) {
    var attr = relationship.key,
      type = this.keyForRelationship(relationship.type.typeKey),
      key = this.keyForRelationship(attr);

    sysout('serializeHasMany', attr, type, key, record, relationship);
    if (relationship.kind === 'hasMany') {
      json.links = json.links || {};
      json.links[key] = hasManyLink(key, type, record, attr);
    }
  }
});

function belongsToLink(key, type, value) {
  sysout('belongsToLink', key, type, value);
  var link = value;
  if (link) {
    link = {
      id: link,
      type: Ember.String.pluralize(type)
    };
  }
  return link;
}

function hasManyLink(key, type, record, attr) {
  sysout('hasManyLink', key, type, record, attr);
  var link = record.hasMany(attr).mapBy('id');
  if (link) {
    link = {
      ids: link,
      type: Ember.String.pluralize(type)
    };
  }
  return link;
}

export default DS.JsonApiSerializer;
