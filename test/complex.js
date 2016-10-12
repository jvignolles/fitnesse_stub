var createApp = require("../app").createApp;
var http = require("http");
var nock = require("nock");
var supertest = require("supertest");

describe("complex", function () {

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

  describe("Complex stubbing (body validation)", function () {
    it("should return a 418 KO when the request body does not match", function (done) {
      supertest("http://localhost:9990").post("/configure_content").send({
        path: "/something",
        body: "<xml><my-data></my-data></xml>",
        content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
        type: "json"
      }).expect(201).end(function (err) {
        if (err) {
          return done(err);
        }
        return supertest("http://localhost:9990").get("/something").send("<xml><my-other-data></my-other-data></xml>")
          .expect(418).end(done);
      });
    });

    it("should return a 200 OK when the request text body does match", function (done) {
      supertest("http://localhost:9990").post("/configure_content").send({
        path: "/something",
        body: "My expected data sent",
        content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
        type: "json"
      }).expect(201).end(function (err) {
        if (err) {
          return done(err);
        }
        return supertest("http://localhost:9990").get("/something").send("My expected data sent").expect(200).end(done);
      });
    });

    it("should return a 200 OK when the request XML body does match", function (done) {
      supertest("http://localhost:9990").post("/configure_content").send({
        path: "/something",
        body: "<xml><my-data></my-data></xml>",
        bodyType: "xml",
        content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
        type: "json",
        method: "POST"
      }).expect(201).end(function (err) {
        if (err) {
          return done(err);
        }
        return supertest("http://localhost:9990").post("/something").send("<xml><my-data></my-data></xml>").expect(200)
          .end(done);
      });
    });

    it("should return a 200 OK when the request JSON body does match", function (done) {
      var jsonBody = {json: {my: "data"}};
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
        return supertest("http://localhost:9990").post("/some-other-thing").send({json: {my: "data"}}).expect(200)
          .end(done);
      });
    });
  });
});
