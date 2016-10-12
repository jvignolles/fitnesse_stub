var async = require("async");
var createApp = require("../app").createApp;
var http = require("http");
var nock = require("nock");
var request = require("request").defaults({timeout: 30000});
var supertest = require("supertest");
var utils = require("./utils");

describe("stats", function () {

  var server;
  nock.enableNetConnect("localhost");

  beforeEach(function (done) {
    var app = createApp(9990, true);
    server = http.createServer(app);
    return server.listen(app.get("port"), done);
  });

  afterEach(function (done) {
    return server.close(done);
  });

  function sampleRequest(n, next) {
    return request.get("http://localhost:9990/something", next);
  }

  describe("Stubbing stats", function () {
    it("should return a 418 KO when the request route is not configured", function () {
      return supertest("http://localhost:9990").get("/routes/test/methods/get/stats/count").expect(418);
    });

    it("should return a 404 when the requested stat does not exist", function (done) {
      return utils.configureContentSample(function (configureError) {
        if (configureError) {
          return done(configureError);
        }
        return supertest("http://localhost:9990").get("/routes/something/methods/get/stats/sheep").expect(404)
          .end(done);
      });
    });

    describe("the count stats", function () {
      it("should return the number of times the route was called", function (done) {
        return utils.configureContentSample(function (configureError) {
          if (configureError) {
            return done(configureError);
          }
          return async.times(3, sampleRequest, function (asyncError) {
            if (asyncError) {
              return done(asyncError);
            }
            return supertest("http://localhost:9990").get("/routes/something/methods/get/stats/count").expect("3")
              .expect(200).end(done);
          });
        });
      });

      it("should return the number of times the route was called. Even if it is zero", function (done) {
        return utils.configureContentSample(function (configureError) {
          if (configureError) {
            return done(configureError);
          }
          return supertest("http://localhost:9990").get("/routes/something/methods/get/stats/count").expect("0")
            .expect(200).end(done);
        });
      });

      it("should work with paths having slashes on them", function (done) {
        var options = {
          path: "/something/with/slashes",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json"
        };
        return utils.configureContent(options, function (configureError) {
          if (configureError) {
            return done(configureError);
          }
          return async.times(3,
            function (n, next) {
              return request.get("http://localhost:9990/something/with/slashes", next);
            },
            function (asyncError) {
              if (asyncError) {
                return done(asyncError);
              }
              return supertest("http://localhost:9990").get("/routes/something/with/slashes/methods/get/stats/count")
                .expect("3").expect(200).end(done);
            }
          );
        });
      });
    });

    describe("the last request stat", function () {
      it("should return the last request's body", function (done) {
        return utils.configureContentPostSample(function (configureError) {
          if (configureError) {
            return done(configureError);
          }
          var bodySent = {test: true};
          return request.post({url: "http://localhost:9990/something", json: bodySent}, function (requestError) {
            if (requestError) {
              return done(requestError);
            }
            var expectedBody = {requestBody: JSON.stringify(bodySent)};
            return supertest("http://localhost:9990").get("/routes/something/methods/post/stats/requests/last")
              .expect(expectedBody).expect(200).end(done);
          });
        });
      });
    });

    describe("the n-th request stat", function () {
      it("should return the n-th request's body", function (done) {
        return utils.configureContentPostSample(function (configureError) {
          if (configureError) {
            return done(configureError);
          }
          var test = false;
          var bodySent = {};
          return async.times(3,
            function (n, next) {
              test = !test;
              bodySent = {test: test};
              return request.post({url: "http://localhost:9990/something", json: bodySent}, next);
            },
            function (asyncPostError) {
              if (asyncPostError) {
                return done(asyncPostError);
              }
              return supertest("http://localhost:9990").get("/routes/something/methods/post/stats/requests/1")
                .expect({requestBody: JSON.stringify({test: true})}).expect(200).end(function (firstRequestError) {
                  if (firstRequestError) {
                    return done(firstRequestError);
                  }
                  return supertest("http://localhost:9990").get("/routes/something/methods/post/stats/requests/2")
                    .expect({requestBody: JSON.stringify({test: false})}).expect(200).end(done);
                });
            }
          );
        });
      });
    });
  });

  describe("Stats for a route with several responses", function () {
    describe("the count stats", function () {
      it("should return the number of times the route was called", function (done) {
        return async.times(2, function (n, next) {
          utils.configureContentSample(next);
        }, function (asyncConfError) {
          if (asyncConfError) {
            return done(asyncConfError);
          }
          return async.times(3, sampleRequest,
            function (asyncRequestError) {
              if (asyncRequestError) {
                return done(asyncRequestError);
              }
              return supertest("http://localhost:9990").get("/routes/something/methods/get/stats/count").expect("3")
                .expect(200).end(done);
            }
          );
        });
      });
    });
    describe("the last request stat", function () {
      it("should return the last request's body", function (done) {
        return async.times(2, function (n, next) {
          utils.configureContentPostSample(next);
        }, function (asyncConfError) {
          if (asyncConfError) {
            return done(asyncConfError);
          }
          var test = false;
          var lastBodySent = {};
          return async.times(3,
            function (n, next) {
              test = !test;
              lastBodySent = {test: test};
              return request.post({url: "http://localhost:9990/something", json: lastBodySent}, next);
            },
            function (asyncPostError) {
              if (asyncPostError) {
                return done(asyncPostError);
              }
              var expectedBody = {requestBody: JSON.stringify(lastBodySent)};
              return supertest("http://localhost:9990").get("/routes/something/methods/post/stats/requests/last")
                .expect(expectedBody).expect(200).end(done);
            }
          );
        });
      });
    });
  });
});
