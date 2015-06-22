/*eslint-disable no-shadow, handle-callback-err */

var Shortcuts = require('../lib');

var chai = require('chai');
var assert = chai.assert;

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

describe('Shortcuts', function () {

  it('creates a connection with a URL', function (next) {
    var url = 'mongodb://localhost:27017/test';
    var shortcuts = new Shortcuts.Shortcuts();
    shortcuts.connect(url, function (err) {
      if (err) return next(err);
      assert.ok(shortcuts.db instanceof mongodb.Db, 'No database created');
      assert.ok(shortcuts.collection instanceof mongodb.Collection,
        'No database created');
      next();
    });
  });

  it('reuses a db connection', function (next) {
    MongoClient.connect('mongodb://localhost:27017/test',
      function (err, db) {
        if (err) next(err);
        var shortcuts = new Shortcuts.Shortcuts();
        shortcuts.connect(db, function (err) {
          if (err) return next(err);
          assert.ok(db === shortcuts.db, 'New db connection created');
          next();
        });
      });
  });

  it('normalizes a key', function () {
    assert.equal('abcd1234', Shortcuts.normalize('ABCD-1234'));
    assert.equal('1230v', Shortcuts.normalize('l23ou'));
  });

  describe('Once connected', function () {

    var shortcuts;

    function createAndConnect (next) {
      var url = 'mongodb://localhost:27017/test';
      shortcuts = new Shortcuts.Shortcuts();
      shortcuts.connect(url, function (err) {
        if (err) return next(err);
        // next();
        shortcuts.removeAll(next);
      });
    }

    beforeEach(createAndConnect);

    it('creates a new key and adds it', function (next) {
      shortcuts.add(null, {foo: 'bar'}, function (err, cut) {
        var time;
        assert.isNull(err, 'Error adding shortcut');
        assert.isNotNull(cut, 'Shortcut not returned');
        time = new Date();
        shortcuts.find(cut, time, function (err, record) {
          assert.isNull(err, 'Error finding shortcut');
          assert.ok(record, 'No shortcut record found');
          assert.equal(record._id, Shortcuts.normalize(cut),
            'Different shortcut returned');
          assert.equal(record.lastAccessed.getTime(), time.getTime(),
            'Last accessed not set');
          assert.equal(record.accesses, 1, 'Accesses not incremented');
          assert.equal(record.data.foo, 'bar', 'Meta data not returned');
          next();
        });
      });
    });

    it('refuses to add the same key twice', function (next) {
      shortcuts.add('TEST', {foo: 'bar'}, function (err, cut) {
        assert.isNull(err, 'Error adding shortcut');
        assert.ok(cut, 'No shortcut returned');
        shortcuts.add('TEST', {foo: 'baz'}, function (err, cut2) {
          assert.ok(!cut2, 'Duplicate shortcut added');
          shortcuts.find('TEST', function (err, record) {
            assert.isNull(err, 'Error finding new shortcut');
            assert.ok(record, 'No new shortcut record found');
            assert.equal(record.data.foo, 'bar', 'Meta data overwritten');
            next();
          });
        });
      });
    });

    it('removes a shortcut', function (next) {
      shortcuts.add('TEST', {foo: 'bar'}, function (err, cut) {
        assert.isNull(err, 'Error adding shortcut');
        assert.ok(cut, 'No shortcut returned');
        shortcuts.remove('TEST', function (err) {
          assert.isNull(err, 'Error removing');
          shortcuts.find('TEST', function (err, record) {
            assert.isNull(err, 'Error finding new shortcut');
            assert.ok(!record, 'Shortcut record not removed');
            next();
          });
        });
      });
    });

  });

});
