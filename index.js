var Accessory, Service, Characteristic;
var url = require('url')
var request = require("request");

var communicationError = new Error('Can not communicate with Home Assistant.')

var HomeAssistantLight;
var HomeAssistantSwitch;
var HomeAssistantLock;
var HomeAssistantMediaPlayer;


module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.platformAccessory;

  HomeAssistantLight = require('./accessories/light')(Service, Characteristic, communicationError);
  HomeAssistantSwitch = require('./accessories/switch')(Service, Characteristic, communicationError);
  HomeAssistantLock = require('./accessories/lock')(Service, Characteristic, communicationError);
  HomeAssistantMediaPlayer = require('./accessories/media_player')(Service, Characteristic, communicationError);

  homebridge.registerPlatform("homebridge-homeassistant", "HomeAssistant", HomeAssistantPlatform, false);
}

function HomeAssistantPlatform(log, config, api){
  // auth info
  console.log("Booting Platform");
  this.host = config.host;
  this.password = config.password;
  this.supportedTypes = config.supported_types;

  this.log = log;

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories
    this.api.on('didFinishLaunching', function() {
      console.log("Plugin - DidFinishLaunching");
    }.bind(this));
  }
}

HomeAssistantPlatform.prototype = {
  _request: function(method, path, options, callback) {
    var self = this
    var requestURL = this.host + '/api' + path
    options = options || {}
    options.query = options.query || {}

    var reqOpts = {
      url: url.parse(requestURL),
      method: method || 'GET',
      qs: options.query,
      body: JSON.stringify(options.body),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-ha-access': this.password
      }
    }

    request(reqOpts, function onResponse(error, response, body) {
      if (error) {
        callback(error, response)
        return
      }

      if (response.statusCode === 401) {
        callback(new Error('You are not authenticated'), response)
        return
      }

      json = JSON.parse(body)
      callback(error, response, json)
    })

  },
  fetchState: function(entity_id, callback){
    this._request('GET', '/states/' + entity_id, {}, function(error, response, data){
      if (error) {
        callback(null)
      }else{
        callback(data)
      }
    })
  },
  callService: function(domain, service, service_data, callback){
    var options = {}
    options.body = service_data

    this._request('POST', '/services/' + domain + '/' + service, options, function(error, response, data){
      if (error) {
        callback(null)
      }else{
        callback(data)
      }
    })
  },
  accessories: function(callback) {
    this.log("Fetching HomeAssistant devices.");

    var that = this;
    var foundAccessories = [];

    this._request('GET', '/states', {}, function(error, response, data){
      that.log(error)
      // that.log(response)
      that.log(data)

      for (var i = 0; i < data.length; i++) {
        entity = data[i]
        entity_type = entity.entity_id.split('.')[0]

        // ignore devices that are not in the list of supported types
        if (that.supportedTypes.indexOf(entity_type) == -1) {
          continue;
        }

        // ignore hidden devices
        if (entity.attributes && entity.attributes.hidden) {
          continue;
        }

        var accessory = null

        if (entity_type == 'light') {
          accessory = new HomeAssistantLight(that.log, entity, that)
        }else if (entity_type == 'switch'){
          accessory = new HomeAssistantSwitch(that.log, entity, that)
        }else if (entity_type == 'lock'){
          accessory = new HomeAssistantLock(that.log, entity, that)
        }else if (entity_type == 'scene'){
          accessory = new HomeAssistantSwitch(that.log, entity, that, 'scene')
        }else if (entity_type == 'media_player' && entity.attributes && entity.attributes.supported_media_commands){
          accessory = new HomeAssistantMediaPlayer(that.log, entity, that)
        }

        if (accessory) {
          foundAccessories.push(accessory)
        }
      }

      callback(foundAccessories)
    })

  }
}

module.exports.platform = HomeAssistantPlatform;