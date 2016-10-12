#!/usr/bin/env node
var bodyParser = require("body-parser");
var bunyan = require("bunyan");
var errorhandler = require("errorhandler");
var express = require("express");
var http = require("http");
var morgan = require("morgan");

var log = bunyan.createLogger({name: "fitnesse_stub"});

function createApp(port, noLog) {
  var routes = require("./routes").getRoutes(log);
  var app = express();

  app.get("/status", function (req, res) {
    return res.end();
  });

  // all environments
  app.set("port", port);
  if (!noLog) {
    app.use(morgan("dev"));
  }
  app.use(function (error, req, res, next) {
    // Catch json error
    if (error) {
      log.error(error);
    } else {
      return next();
    }
  });

  // development only
  if (app.get("env") === "development") {
    app.use(errorhandler());
  }

  app.post("/configure", bodyParser.json(), routes.configure);
  app.post("/configure_content", bodyParser.json(), routes.configureContent);

  app.get("/routes/*/stats/*", routes.stats);

  app.all("*", bodyParser.text({type: "*/*"}), routes.serve);
  return app;
}

exports.createApp = createApp;

if (require.main === module) {

  var app = createApp(process.env.PORT || 3000);
  http.createServer(app).listen(app.get("port"), function () {
    log.info("Express server listening on port " + app.get("port"));
  });

}
