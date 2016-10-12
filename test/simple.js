var createApp = require("../app").createApp;
var http = require("http");
var nock = require("nock");
var supertest = require("supertest");

describe("simple", function () {

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

  describe("Simple stubbing", function () {
    it("should send a 418 when the route is not configured", function () {
      return supertest("http://localhost:9990").get("/something").expect(418);
    });

    describe("/configure", function () {
      it("should send a 400 when trying to configure with bad arguments", function () {
        return supertest("http://localhost:9990").post("/configure").send({hello: "world"}).expect(400);
      });

      it("should return a 200 OK by default with the file when configured", function (done) {
        var get = nock("http://some.other.location.com").get("/file.xml").reply(215, "<xml><my-data></my-data></xml>");

        supertest("http://localhost:9990").post("/configure")
          .send({path: "/something", file: "http://some.other.location.com/file.xml"}).expect(201).end(function (err) {
            if (err) {
              return done(err);
            }
            return supertest("http://localhost:9990").get("/something").expect("<xml><my-data></my-data></xml>")
              .expect(215).expect(function () {
                get.done();
              }).end(done);
          }
        );
      });

      it("should return the file with a certain response code when configured", function (done) {
        var get = nock("http://some.other.location.com").get("/file.xml").reply(205, "<xml><my-data></my-data></xml>");

        supertest("http://localhost:9990").post("/configure")
          .send({path: "/something", file: "http://some.other.location.com/file.xml", code: 223}).expect(201)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            return supertest("http://localhost:9990").get("/something").expect("<xml><my-data></my-data></xml>")
              .expect(223).expect(function () {
                get.done();
              }).end(done);
          });
      });

      it("should return a 418 when the query parameters do not match the configured path", function (done) {
        supertest("http://localhost:9990").post("/configure")
          .send({path: "/something", file: "http://some.other.location.com/file.xml"}).expect(201).end(function (err) {
            if (err) {
              return done(err);
            }
            return supertest("http://localhost:9990").get("/something?param=true").expect(418).end(done);
          }
        );
      });

      it("if skipQueryParams is used, the query parameters should not be taken into account", function (done) {
        var get = nock("http://some.other.location.com").get("/file.xml").reply(215, "<xml><my-data></my-data></xml>");

        supertest("http://localhost:9990").post("/configure")
          .send({path: "/something", file: "http://some.other.location.com/file.xml", skipQueryParams: true})
          .expect(201).end(function (err) {
            if (err) {
              return done(err);
            }
            return supertest("http://localhost:9990").get("/something?param=true")
              .expect("<xml><my-data></my-data></xml>").expect(215).expect(function () {
                get.done();
              }).end(done);
          });
      });
    });

    describe("/configure_content", function () {
      it("should send a 400 when trying to configure a JSON response with bad arguments", function () {
        return supertest("http://localhost:9990").post("/configure_content").send({hello: "world"}).expect(400);
      });

      it("should return a 200 OK by default with the JSON content when configured", function (done) {
        supertest("http://localhost:9990").post("/configure_content").send({
          path: "/something",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json"
        }).expect(201).end(function (err) {
          if (err) {
            return done(err);
          }
          return supertest("http://localhost:9990").get("/something")
            .expect({key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}}).end(done);
        });
      });

      it("should return the configured status code with the JSON content", function (done) {
        supertest("http://localhost:9990").post("/configure_content").send({
          path: "/something",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json",
          code: 234
        }).expect(201).end(function (err) {
          if (err) {
            return done(err);
          }
          return supertest("http://localhost:9990").get("/something").expect(234)
            .expect({key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}}).end(done);
        });
      });

      it("should return a 418 when the configured content does not match the request method", function (done) {
        var jsonBody = {
          json: {
            my: "data"
          }
        };
        supertest("http://localhost:9990").post("/configure_content").send({
          path: "/some-other-thing",
          method: "POST",
          body: jsonBody,
          bodyType: "json",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json"
        }).expect(201).end(function (err) {
          if (err) {
            return done(err);
          }
          return supertest("http://localhost:9990").get("/some-other-thing").send(jsonBody).expect(418).end(done);
        });
      });

      it("should return a 418 KO when the query parameters do not match", function (done) {
        supertest("http://localhost:9990").post("/configure_content").send({
          path: "/something",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json"
        }).expect(201).end(function (err) {
          if (err) {
            return done(err);
          }
          return supertest("http://localhost:9990").get("/something?param=true").expect(418).end(done);
        });
      });

      it("if skipQueryParams is used, should return a the JSON content despite of the query params", function (done) {
        supertest("http://localhost:9990").post("/configure_content").send({
          path: "/something",
          content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
          type: "json",
          skipQueryParams: true
        }).expect(201).end(function (err) {
          if (err) {
            return done(err);
          }
          return supertest("http://localhost:9990").get("/something?param=true")
            .expect({key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}}).end(done);
        });
      });

      it("if two contents are configured for the same route, it should return them alternatively", function (done) {
        var firstResponse = {order: "first", number: 1};
        var secondResponse = {order: "second", number: 2};

        function configureAResponse(response, callback) {
          supertest("http://localhost:9990").post("/configure_content").send({
            path: "/something",
            content: response,
            type: "json"
          }).expect(201).end(function (err) {
            if (err) {
              return done(err);
            }
            return callback();
          });
        }

        function requestContent(expectedBody, callback) {
          supertest("http://localhost:9990").get("/something").expect(expectedBody).end(function (err) {
            if (err) {
              return done(err);
            }
            return callback();
          });
        }

        // Test: two different contents configured for the same route (/something)...
        configureAResponse(firstResponse, function () {
          configureAResponse(secondResponse, function () {
            // ...when the route is requested the two responses are sent alternatively
            requestContent(firstResponse, function () {
              requestContent(secondResponse, function () {
                requestContent(firstResponse, done);
              });
            });
          });
        });
      });
    });
  });

});
