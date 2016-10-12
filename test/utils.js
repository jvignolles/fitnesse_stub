var supertest = require("supertest");

function configureContent(options, callback) {
  supertest("http://localhost:9990").post("/configure_content").send(options).expect(201).end(callback);
}

function configureJsonContent(path, content, callback) {
  var options = {path: path, content: content, type: "json"};
  return configureContent(options, callback);
}

function configureContentSample(callback) {
  var sampleContent = {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}};
  return configureJsonContent("/something", sampleContent, callback);
}

function configureContentPostSample(callback) {
  var options = {
    path: "/something",
    content: {key1: "value1", key2: "value2", key3: {subkey1: "subvalue1"}},
    type: "json",
    method: "POST"
  };
  return configureContent(options, callback);
}

module.exports = {
  configureContent: configureContent,
  configureContentSample: configureContentSample,
  configureContentPostSample: configureContentPostSample
};
