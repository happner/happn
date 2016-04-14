var expect = require('expect.js');

describe('c8_cloning_tests', function() {

  before('it creates 2 test dss', function(callback){
    callback();
  });

  after('it shuts down the test dss, and unlinks their file', function(callback){
   callback();
  });

  var async = require('async');

  var objToClone = {
    "definitions": {
      "address": {
        "type": "object",
        "properties": {
          "street_address": { "type": "string" },
          "city":           { "type": "string" },
          "state":          { "type": "string" }
        },
        "required": ["street_address", "city", "state"]
      }
    },

    "type": "object",

    "properties": {
      "billing_address": { "$ref": "#/definitions/address" },
      "shipping_address": {
        "allOf": [
          { "$ref": "#/definitions/address" },
          { "properties":
            { "type": { "enum": [ "residential", "business" ] } },
            "required": ["type"]
          }
        ]
      }
    }
  }

  var objToCheck = {
    "definitions": {
      "address": {
        "type": "object",
        "properties": {
          "street_address": { "type": "string" },
          "city":           { "type": "string" },
          "state":          { "type": "string" }
        },
        "required": ["street_address", "city", "state"]
      }
    },

    "type": "object",

    "properties": {
      "billing_address": { "$ref": "#/definitions/address" },
      "shipping_address": {
        "allOf": [
          { "$ref": "#/definitions/address" },
          { "properties":
            { "type": { "enum": [ "residential", "business" ] } },
            "required": ["type"]
          }
        ]
      }
    }
  }

  var checkRandomItem = function(array, callback){
    try{
      var random = Math.floor(Math.random() * 999);
      expect(array[random]).to.eql(objToCheck);
      callback();
    }catch(e){
      callback(e);
    }
  }

  it('tests JSON stringify parse', function(callback){

    var itemsArray = [];

    console.time("tests JSON stringify parse");

    for (var i = 0;i < 1000;i++)
      itemsArray.push(JSON.parse(JSON.stringify(objToClone)));

    console.timeEnd("tests JSON stringify parse");

    checkRandomItem(itemsArray, callback);

  });

  it('tests JSON stringify once, then parse multiple', function(callback){

    var itemsArray = [];

    console.time("tests JSON stringify once, then parse multiple");

    var serialized = JSON.stringify(objToClone);

    for (var i = 0;i < 1000;i++)
      itemsArray.push(JSON.parse(serialized));

    console.timeEnd("tests JSON stringify once, then parse multiple");

    checkRandomItem(itemsArray, callback);

  });

  xit('tests deepcopy', function(callback){

  });

  xit('tests Clone', function(callback){

  });

  xit('tests structured-clone', function(callback){

  });

  xit('tests structured-clone serialize once, deserialize multiple', function(callback){

  });



});