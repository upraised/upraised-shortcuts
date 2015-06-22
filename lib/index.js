'use strict';

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

/*
  generate a random, 8-character lowercase alphanumeric key that
  excludes the letters l, o and u, all of which may be confused with
  another character (1, 0 and v)

  @returns {String} random id
*/

function safeId () {
  var i, s;
  var chars = '1234567890abcdefghjkmnpqrstvwxyz'; // missing o, l, u

  s = '';
  for (i = 8; i; i--) {
    s += chars[Math.random() * chars.length | 0];
  }
  return prettify(s);
}

/*
  normalizes a safe id, removing non-alphanumeric characters,
  lowercasing and mapping the confusable characters (o, l, u) to
  their canonical replacements (0, 1, v)

  @param {String} id to normalize
  @param {Strings} normalized safe id
*/

function normalize (id) {
  return id &&
  id.toLowerCase()
  .replace(/[^\w]/g, '')
  .replace('o', '0')
  .replace('l', '1')
  .replace('u', 'v');
}

/*
  reformats a safe id into a standard user-friendly
  format: upper case with two groups of four characters
  separated by a dash

  @param {String} safe id
  @returns {String} reformatted safe id
*/

function prettify (id) {
  id = normalize(id).toUpperCase();
  return id.slice(0, 4) + '-' + id.slice(4);
}

/*
  Shortcuts collection constructor function

  @param {Object} opts options
  @param {String} opts.collection mongodb collection name to use
*/

function Shortcuts (opts) {

  this.opts = opts || {};

  this.db = null;
  this.collection = null;

}


Shortcuts.prototype.normalize = normalize;

/*
  sets options for this Shortcuts collection that govern
  the collection name it uses

  @param {String} [opts.collection='shortcuts'] an alternate collection name

*/

Shortcuts.prototype.setOpts = function (opts) {
  this.opts = opts;
};

/*
  connect this shortcuts collection to a mongo database
  either by giving it a connection string, in which case
  a new connection is created, or by giving it a connected
  database, in which case the database connection is reused

  @param {mongodb.Db|String} db mongo database instance or connection string
  @param {Function} next success callback
*/

Shortcuts.prototype.connect = function (db, next) {
  var that = this;


  if (db instanceof mongodb.Db) {
    this._setDb(db, next);
  } else {
    MongoClient.connect(db, {
      'native_parser': true
    }, function (err, db2) {
      if (err) {
        if (next) next(err);
        return;
      }
      that._setDb(db2, next);
    });
  }

};

Shortcuts.prototype._setDb = function (db, next) {
  var collection = this.opts.collection || 'shortcuts';

  this.db = db;
  this.collection = db.collection(collection);
  if (next) return next(null);
};

/*
  add a shortcut to the database, with associated metadata.
  if no shortcut provided, a new safeid is created

  @param {String|null} cut shortcut code to use or null if a new one is to be created
  @param {Object} data shortcut metadata object
  @param {Function} next success callback, with code added or null if code already exists
*/

Shortcuts.prototype.add = function (cut, data, next) {
  var that = this, scut, retry;

  if (!cut) {
    retry = true;
    cut = safeId();
  }
  scut = normalize(cut);

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.insertOne({
    _id: scut,
    shortcut: cut,
    data: data,
    accesses: 0,
    lastAccessed: null
  }, {
    w: 1
  }, function (err, result) {
    if (err) {
      if (err.code === 11000) {
        if (retry) {
          return that.add(null, data, next);
        } else {
          return next(null, null);
        }
      } else {
        return next(err);
      }
    }
    if (result.ops && result.ops.length) {
      return next(null, cut);
    } else {
      return next(null);
    }
  });
};

/*
  find a shortcut, normalizing it, and return the shortcut
  record.  also increment the access count and the
  access with a timestamp

  @param {String} cut
  @param {Date} [time=Date.now] last accessed timestamp
  @param {Function} next success call back, passed the shortcut record
*/

Shortcuts.prototype.find = function (cut, time, next) {

  if (next === undefined) {
    next = time;
    time = new Date();
  }

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.findOneAndUpdate({
    _id: normalize(cut)
  }, {
    $set: {
      lastAccessed: time
    },
    $inc: {
      accesses: 1
    }
  }, {
    returnOriginal: false
  }, function (err, result) {
    if (err) return next(err);
    next(null, result.value);
  });

};

/*
  remove a shortcut

  @param {String} cut
  @param {Function} next success callback, passing back the shortcut record that was deleted, if one found
*/

Shortcuts.prototype.remove = function (cut, next) {
  var scut = normalize(cut);

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.findOneAndDelete({
    _id: scut
  }, {
    w: 1
  }, function (err, result) {
    if (err) return next(err);
    next(null, result && result.value);
  });
};

/*
  removes all shortcuts

  @param {Function} next success callback
*/

Shortcuts.prototype.removeAll = function (next) {

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.remove({}, {w: 1}, next);
};

Shortcuts.prototype.Shortcuts = Shortcuts;

module.exports = new Shortcuts();
