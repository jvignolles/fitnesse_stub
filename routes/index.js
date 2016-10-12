var chai = require("chai");
var chaiXml = require("chai-xml");
var pump = require("pump");
var request = require("request").defaults({timeout: 30000});
var _ = require("lodash");

chai.use(chaiXml);

function getRoutes(log) {
  var routes = {};
  var services = [];
  var contents = [];
  var stats = [];

  // Deprecated. Use configureContent instead
  routes.configure = function (req, res) {
    log.warn("Deprecated route for configuring files. Use configure_content instead");
    var path = req.body.path;
    var file = req.body.file;
    var code = req.body.code;
    var method = req.body.method || "GET";
    var skipQueryParams = req.body.skipQueryParams || false;

    log.info("configure_content parameters: (path, file, code, method, skipQueryParams)",
      path, file, code, method, skipQueryParams);

    if (!path || !file) {
      return res.status(400).send("Configure must be called with path and file parameters");
    }

    services.push({path: path, file: file, code: code, method: method, skipQueryParams: skipQueryParams});

    return res.status(201).send("Configured");
  };

  function searchAndReturnFile(path, method, originalResponse, next) {
    var service;
    var pathWithoutQueryParameters = path.split("?")[0];
    // Look for the path and method in the configured files
    for (var i = 0; i < services.length; ++i) {
      var searchedPath = services[i].skipQueryParams ? pathWithoutQueryParameters : path;
      if (services[i].path === searchedPath && services[i].method === method) {
        service = services[i];
      }
    }
    if (!service) {
      return false;
    }

    // Returning a file
    request.get(service.file).on("response", function (response) {
      originalResponse.status(service.code || response.statusCode);
      return pump(response, originalResponse, next);
    });
    return true;
  }

  function searchAndReturnContent(path, method, body, callback) {
    var service;
    var pathWithoutQueryParameters = path.split("?")[0];
    // Look for the path and method in the configured contents
    var found = [];
    for (var i = 0; i < contents.length; ++i) {
      var searchedPath = contents[i].skipQueryParams ? pathWithoutQueryParameters : path;
      if (contents[i].path === searchedPath && contents[i].method === method) {
        found.push({index: i, content: contents[i]});
      }
    }
    if (found.length === 0) {
      return callback(null, false);
    }
    // The first found element is returned
    service = found[0].content;
    if (found.length > 1) {
      // The elements are shifted in the original array so next time, the second one will be returned (and so on...)
      for (var j = 0; j < found.length; j++) {
        contents[found[j].index] = found[(j + 1) % found.length].content;
      }
    }

    // Deprecated: Comparing the request body. Get a request body using the stat route and compare it outside WS stub
    if (service.body) {
      log.warn("Deprecated! Get the request body using the stat routes and compare it by your own.");
    }
    if (service.body && service.bodyType === "xml") {
      // Compare XML
      try {
        chai.expect(body).xml.to.deep.equal(service.body);
      } catch (e) {
        log.error("WS STUB BODY COMPARISON (XML) FAILED: The request body:", body,
          "\ndoes not match the expected one:", service.body);
        return callback(null, false);
      }
      return callback(null, true, service);
    } else if (service.body && service.body !== body) {
      log.error("WS STUB BODY COMPARISON FAILED: The request body:", body,
        "\ndoes not match the expected one:", service.body);
      return callback(null, false);
    }
    return callback(null, true, service);
  }

  routes.serve = function (req, res, next) {
    var path = req.originalUrl;
    var body = req.body;
    var method = req.method || "GET";

    var fileFound = searchAndReturnFile(path, method, res, next);
    if (fileFound) {
      return;
    }

    searchAndReturnContent(path, method, body, function (error, contentFound, service) {
      if (error || !contentFound) {
        return res.status(418).send("The requested service does not exist");
      }
      // Return content
      updateStats(path, method, body, service);
      if (service.code) {
        res.status(service.code);
      }
      if (service.type === "json") {
        log.info(service.path + " is about to return JSON:", service.content);
        res.set("Content-Type", "application/json");
      } else {
        log.info(service.path + " is about to return content:", service.content);
      }
      return res.send(service.content);
    });
  };

  routes.configureContent = function (req, res) {
    var path = req.body.path;
    var bodyType = req.body.bodyType;
    var body = req.body.body;
    var code = req.body.code;
    var type = req.body.type;
    var content = req.body.content;
    var method = req.body.method || "GET";
    var skipQueryParams = req.body.skipQueryParams || false;

    log.info("configure_content parameters: (path, code, type, content, method, bodyType, body, skipQueryParams)",
      path, code, type, content, method, bodyType, body, skipQueryParams);

    if (!path || !content) {
      return res.status(400).send("Configure must be called with path and content parameters");
    }

    if (bodyType === "json") {
      body = JSON.stringify(body);
    }
    var statsInit = {count: 0, requests: {}};
    contents.push({
      path: path, body: body, bodyType: bodyType, content: content, code: code, type: type,
      method: method, skipQueryParams: skipQueryParams
    });
    // Avoids to have two stats object for the same path and method (case of different response)
    if (!_.find(stats,
        function (statElement) {
          return statElement.path === path && statElement.method === method;
        })) {
      stats.push({path: path, method: method, skipQueryParams: skipQueryParams, stats: statsInit});
    }
    return res.status(201).send("Configured");
  };

  function updateStats(path, method, body) {
    var service;
    var pathWithoutQueryParameters = path.split("?")[0];
    // Look for the path and method in the configured contents' stats
    for (var i = 0; i < stats.length; ++i) {
      var searchedPath = stats[i].skipQueryParams ? pathWithoutQueryParameters : path;
      if (stats[i].path === searchedPath && stats[i].method === method) {
        service = stats[i];
        break;
      }
    }
    service.stats.count++;
    service.stats.requests[service.stats.count] = {requestBody: body};
    service.stats.requests.last = service.stats.requests[service.stats.count];
  }

  function getStatParamsFromStatRequest(req) {
    var path = req.originalUrl;
    // /routes/:routethatcanhaveslashes/methods/:method/stats/:stat
    var info = path.split(/\/routes|\/methods\/|\/stats\//);
    var stat = info[3].split(/\//);
    return {
      route: info[1],
      method: _.toUpper(info[2]),
      stat: stat
    };
  }

  routes.stats = function routeStats(req, res) {
    var statParams = getStatParamsFromStatRequest(req);

    var service;
    // Look for the path and method in the configured contents
    for (var i = 0; i < stats.length; ++i) {
      if (stats[i].path === statParams.route && stats[i].method === statParams.method) {
        service = stats[i];
      }
    }
    if (!service) {
      return res.status(418).send("Route " + statParams.route + " not configured for method " + statParams.method);
    }
    var statResult = service.stats;
    for (var j = 0; j < statParams.stat.length; j++) {
      if (!statResult.hasOwnProperty(statParams.stat[j])) {
        return res.status(404).send("No stat " + statParams.stat + " for service: " + JSON.stringify(service));
      }
      statResult = statResult[statParams.stat[j]];
    }
    // Returning the requested stat
    if (typeof statResult === "object") {
      return res.send(statResult);
    }
    return res.send(statResult.toString());
  };

  return routes;
}

exports.getRoutes = getRoutes;
