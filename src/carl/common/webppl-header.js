var _ = require('lodash');
var assert = require('assert');


module.exports = function(env) {

  var Tensor = T['__Tensor'];
  assert.ok(Tensor); // webppl puts T in global scope
  
  function serializeParams(s, k, a, paramObj) {
    var prms = _.mapValues(paramObj, function(lst) {
      return lst.map(function(tensor) {
        var tcopy = _.clone(tensor);
        tcopy.data = tensor.toFlatArray();
        return tcopy;
      });
    });
    return k(s, prms);
  }

  function deserializeParams(s, k, a, paramObj) {
    var prms = {};
    for (var name in paramObj) {
      prms[name] = paramObj[name].map(function(tensor) {
        return new Tensor(tensor.dims).fromFlatArray(tensor.data);
      });
    }
    return k(s, paramObj);
  }

  return { serializeParams, deserializeParams };
};
