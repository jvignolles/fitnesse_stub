var assert = require("assert");
var bunyan = require("bunyan");
var proxyquire = require("proxyquire");
var _ = require("lodash");

describe("routes", function () {

  var routesModule = proxyquire("../routes", {request: _.noop});

  var log = bunyan.createLogger({name: "fitnesse_stub_test"});
  var routes;

  beforeEach(function () {
    routes = routesModule.getRoutes(log);
  });

  it("should send a code 400 when the path parameter is missing", function (done) {
    // Given
    var req = {body: {path: null, file: "file", code: "code", method: "method"}};

    var res = {
      status: function (code) {
        assert.ok(code === 400);
        return res;
      },
      send: function (message) {
        assert.ok(message === "Configure must be called with path and file parameters");
        return done();
      }
    };

    // When
    routes.configure(req, res);
  });

  it("should send a code 400 when the file parameter is missing", function (done) {
    var req = {body: {path: "path", file: null, code: "code", method: "method"}};

    var res = {
      status: function (code) {
        assert.ok(code === 400);
        return res;
      },
      send: function (message) {
        assert.ok(message === "Configure must be called with path and file parameters");
        return done();
      }
    };

    routes.configure(req, res);
  });

  it("should send a code 201 when the file & path parameters are not missing", function (done) {
    var req = {body: {path: "path", file: "file", code: "code", method: "method"}};

    var res = {
      status: function (code) {
        assert.ok(code === 201);
        return res;
      },
      send: function (message) {
        assert.ok(message === "Configured");
        return done();
      }
    };

    routes.configure(req, res);
  });

  it("should send a code 418 when the requested path is not configured", function (done) {
    // Given
    var req = {body: {path: "path", file: "file", code: "code", method: "method"}};
    var res = {
      status: function () {
        return res;
      },
      send: function () {
      }
    };
    routes.configure(req, res);

    req = {originalUrl: "unknown-path"};
    res = {
      status: function (code) {
        assert.ok(code === 418, "sent code should be 418, got " + code);
        return res;
      },
      send: function (message) {
        assert.ok(message === "The requested service does not exist");
        return done();
      }
    };

    // When
    routes.serve(req, res);
  });

});
