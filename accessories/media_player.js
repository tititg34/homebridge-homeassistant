var Service, Characteristic;

module.exports = function (oService, oCharacteristic) {
  Service = oService;
  Characteristic = oCharacteristic;

  return HomeAssistantMediaPlayer;
};
module.exports.HomeAssistantMediaPlayer = HomeAssistantMediaPlayer;

function HomeAssistantMediaPlayer(log, data, client) {
  var SUPPORT_PAUSE = 1
  var SUPPORT_SEEK = 2
  var SUPPORT_VOLUME_SET = 4
  var SUPPORT_VOLUME_MUTE = 8
  var SUPPORT_PREVIOUS_TRACK = 16
  var SUPPORT_NEXT_TRACK = 32
  var SUPPORT_YOUTUBE = 64
  var SUPPORT_TURN_ON = 128
  var SUPPORT_TURN_OFF = 256

  // device info
  this.domain = "media_player"
  this.data = data
  this.entity_id = data.entity_id
  this.supportsVolume = false
  this.supportedMediaCommands = data.attributes.supported_media_commands

  if (data.attributes && data.attributes.friendly_name) {
    this.name = data.attributes.friendly_name
  }else{
    this.name = data.entity_id.split('.').pop().replace(/_/g, ' ')
  }

  if ((this.supportedMediaCommands | SUPPORT_PAUSE) == this.supportedMediaCommands) {
    this.onState = "playing"
    this.offState = "paused"
    this.onService = "media_play"
    this.offService = "media_pause"
  }else if ((this.supportedMediaCommands | SUPPORT_TURN_ON) == this.supportedMediaCommands && (this.supportedMediaCommands | SUPPORT_TURN_OFF) == this.supportedMediaCommands) {
    this.onState = "on"
    this.offState = "off"
    this.onService = "turn_on"
    this.offService = "turn_off"
  }

  if ((this.supportedMediaCommands | SUPPORT_VOLUME_SET) == this.supportedMediaCommands) {
    this.supportsVolume = true
  }

  this.client = client
  this.log = log;
}

HomeAssistantMediaPlayer.prototype = {
  getPowerState: function(callback){
    this.log("fetching power state for: " + this.name);

    this.client.fetchState(this.entity_id, function(data){
      if (data) {
        powerState = data.state == this.onState
        callback(null, powerState)
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  getVolume: function(callback){
    this.log("fetching volume for: " + this.name);
    that = this
    this.client.fetchState(this.entity_id, function(data){
      if (data && data.attributes) {
        that.log(JSON.stringify(data.attributes))
        level = data.attributes.volume_level ? data.attributes.volume_level*100 : 0
        callback(null, level)
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  setPowerState: function(powerOn, callback) {
    var that = this;
    var service_data = {}
    service_data.entity_id = this.entity_id

    if (powerOn) {
      this.log("Setting power state on the '"+this.name+"' to on");

      this.client.callService(this.domain, this.onService, service_data, function(data){
        if (data) {
          that.log("Successfully set power state on the '"+that.name+"' to on");
          callback()
        }else{
          callback(communicationError)
        }
      }.bind(this))
    }else{
      this.log("Setting power state on the '"+this.name+"' to off");

      this.client.callService(this.domain, this.offService, service_data, function(data){
        if (data) {
          that.log("Successfully set power state on the '"+that.name+"' to off");
          callback()
        }else{
          callback(communicationError)
        }
      }.bind(this))
    }
  },
  setVolume: function(level, callback) {
    var that = this;
    var service_data = {}
    service_data.entity_id = this.entity_id

    service_data.volume_level = level/100.0

    this.log("Setting volume on the '"+this.name+"' to " + level);

    this.client.callService(this.domain, 'volume_set', service_data, function(data){
      if (data) {
        that.log("Successfully set volume on the '"+that.name+"' to " + level);
        callback()
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  getServices: function() {
    var lightbulbService = new Service.Lightbulb();
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Home Assistant")
      .setCharacteristic(Characteristic.Model, "Media Player")
      .setCharacteristic(Characteristic.SerialNumber, "xxx");

    lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));


    if (this.supportsVolume) {
      lightbulbService
        .addCharacteristic(Characteristic.Brightness)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));
    }

    return [informationService, lightbulbService];
  }

}
