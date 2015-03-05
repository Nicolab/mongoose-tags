//Nodeunit tests

process.env.NODE_ENV = 'test';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    fixtures = require('pow-mongodb-fixtures').connect('mongoose-tags'),
    id = require('pow-mongodb-fixtures').createObjectId,
    sinon = require('sinon');

mongoose.connect('mongodb://localhost/mongoose-tags', function(err) {
  //if (err) throw err;
});


//The module under test
var taggable = require('./index.js');


//Create a model to test
var ItemSchema = new Schema({ title: String });
ItemSchema.plugin(taggable, { path: 'labels' });

var Item = mongoose.model('Item', ItemSchema);


exports['adds paths to schema'] = {
  'with defaults': function(test) {
    var schema = new Schema({ title: String });

    schema.plugin(taggable);

    test.ok(schema.paths.tags);

    test.done();
  },

  'with "path" option': function(test) {
    var schema = new Schema({ title: String });

    schema.plugin(taggable, { path: 'myTags' });

    test.ok(schema.paths.myTags);

    test.done();
  }
}


exports['addTag(tag)'] = {
  'when the tag does not exist': function(test) {
    var item = new Item({
      labels: ['foo', 'bar']
    });

    var addedTag = item.addTag('baz');

    test.same(addedTag, true);
    test.same(item.labels.slice(), ['foo', 'bar', 'baz']);

    test.done();
  },

  'when the tag already exists': function(test) {
    var item = new Item({
      labels: ['foo', 'bar', 'baz']
    });

    var addedTag = item.addTag('baz');

    test.same(addedTag, false);
    test.same(item.labels.slice(), ['foo', 'bar', 'baz']);

    test.done();
  }
}


exports['addTag(tag, cb)'] = {
  setUp: function(done) {
    this.item = new Item({ labels: ['foo'] });

    this.item.save(done);
  },

  'adds the tag to the local instance': function(test) {
    var item = this.item;

    item.addTag('baz', function(err) {
      if (err) return test.done(err);

      test.same(item.labels.slice(), ['foo', 'baz']);

      test.done();
    });
  },

  'adds a tag atomically to the document on the DB': function(test) {
    var item = this.item;

    item.addTag('bar', function(err, addedTag) {
      if (err) return test.done(err);

      test.same(addedTag, true);

      Item.findById(item._id, function(err, item) {
        if (err) return test.done(err);

        test.same(item.labels.slice(), ['foo', 'bar']);

        test.done();
      });
    });
  },

  'does not add again if the tag already exists': function(test) {
    var item = this.item;

    item.addTag('foo', function(err, addedTag) {
      if (err) return test.done(err);

      test.same(addedTag, false);

      Item.findById(item._id, function(err, item) {
        if (err) return test.done(err);

        test.same(item.labels.slice(), ['foo']);

        test.done();
      });
    });
  }
}


exports['removeTag(tag)'] = {
  'when the tag does not exist': function(test) {
    var item = new Item({
      labels: ['foo', 'bar']
    });

    var removedTag = item.removeTag('baz');

    test.same(removedTag, false);
    test.same(item.labels.slice(), ['foo', 'bar']);

    test.done();
  },

  'when the tag exists': function(test) {
    var item = new Item({
      labels: ['foo', 'bar', 'baz']
    });

    var removedTag = item.removeTag('baz');

    test.same(removedTag, true);
    test.same(item.labels.slice(), ['foo', 'bar']);

    test.done();
  }
}


exports['removeTag(tag, cb)'] = {
  setUp: function(done) {
    this.item = new Item({ labels: ['foo', 'bar', 'baz'] });

    this.item.save(done);
  },

  'adds the tag to from local instance': function(test) {
    var item = this.item;

    item.removeTag('bar', function(err) {
      if (err) return test.done(err);

      test.same(item.labels.slice(), ['foo', 'baz']);

      test.done();
    });
  },

  'removes a tag atomically': function(test) {
    var item = this.item;

    item.removeTag('bar', function(err, removedTag) {
      if (err) return test.done(err);

      test.same(removedTag, true);

      Item.findById(item._id, function(err, item) {
        if (err) return test.done(err);

        test.same(item.labels.slice(), ['foo', 'baz']);

        test.done();
      });
    });
  },

  'tagWasRemoved is false if tag didnt exist': function(test) {
    var item = this.item;

    item.removeTag('bla', function(err, removedTag) {
      if (err) return test.done(err);

      test.same(removedTag, false);

      test.done();
    });
  }
}


exports['hasTag'] = {
  'returns true when the tag exists': function(test) {
    var item = new Item({ labels: ['foo', 'bar'] });

    test.same(item.hasTag('bar'), true);

    test.done();
  },

  'returns false when the tag does not exist': function(test) {
    var item = new Item({ labels: ['bar', 'baz'] });

    test.same(item.hasTag('foo'), false);

    test.done();
  }
}


exports['filterByTags'] = {
  setUp: function(done) {
    var items = [
      { title: 'A', labels: ['a', 'b'] },
      { title: 'B', labels: [] },
      { title: 'C', labels: ['c', 'b'] },
      { title: 'D', labels: ['a', 'c'] },
      { title: 'E', labels: ['b'] },
      { title: 'F', labels: ['a', 'b', 'c'] }
    ];

    fixtures.clearAndLoad({ items: items }, done);
  },

  'with one includeTag': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, ['a']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');

      test.same(titles.join(' '), 'A D F');

      test.done();
    });
  },

  'with multiple includeTags': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, ['b', 'c']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');      

      test.same(titles.join(' '), 'C F');

      test.done();
    });
  },

  'with no includeTags, does not filter': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, []);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');      

      test.same(titles.join(' '), 'A B C D E F');

      test.done();
    });
  },

  'with one excludeTag': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, null, ['b']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');

      test.same(titles.join(' '), 'B D');

      test.done();
    });
  },

  'with multiple excludeTags': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, null, ['a', 'c']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');

      test.same(titles.join(' '), 'B E');

      test.done();
    });
  },

  'with includeTags and excludeTags': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, ['b'], ['c']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');

      test.same(titles.join(' '), 'A E');

      test.done();
    });
  },

  'with multiple includeTags and excludeTags': function(test) {
    var query = Item.find({});

    Item.filterByTags(query, ['b'], ['a', 'c']);

    query.exec(function(err, docs) {
      if (err) return test.done(err);

      var titles = _.pluck(docs, 'title');

      test.same(titles.join(' '), 'E');

      test.done();
    });
  }
}
