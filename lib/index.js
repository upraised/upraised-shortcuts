'use strict';

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

function prettify (id) {
  id = normalize(id).toUpperCase();
  return id.slice(0, 4) + '-' + id.slice(4);
}

function safeId () {
  var i, s;
  var chars = '1234567890abcdefghjkmnpqrstvwxyz';

  s = '';
  for (i = 8; i; i--) {
    s += chars[Math.random() * chars.length | 0];
  }
  return prettify(s);
}

function normalize (s) {
  return s &&
  s.toLowerCase()
  .replace(/[^\w]/g, '')
  .replace('o', '0')
  .replace('l', '1')
  .replace('u', 'v');
}


function Shortcuts (opts) {

  this.opts = opts || {};

  this.db = null;
  this.collection = null;

}

Shortcuts.prototype.normalize = normalize;

Shortcuts.prototype.setOpts = function (opts) {
  this.opts = opts;
};

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
  var prefix = this.opts.prefix ? this.opts.prefix + '.' : '';
  var collection = this.opts.collection || 'shortcuts';

  this.db = db;
  this.collection = db.collection(prefix + collection);
  if (next) return next(null);
};

Shortcuts.prototype.add = function (cut, data, next) {
  var that = this, scut;

  if (!cut) {
    cut = safeId();
  }
  scut = normalize(cut);

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
        return that.add(null, data, next);
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

Shortcuts.prototype.remove = function (cut, next) {
  var scut = normalize(cut);

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.deleteOne({
    _id: scut
  }, {
    w: 1
  }, function (err, result) {
    if (err) return next(err);
    next(null, result);
  });
};

Shortcuts.prototype.removeAll = function (next) {

  if (!this.collection) {
    return next(new Error('No connection'));
  }

  this.collection.remove({}, {w: 1}, next);
};

Shortcuts.prototype.Shortcuts = Shortcuts;

module.exports = new Shortcuts();
