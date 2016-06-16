var Service, Characteristic, communicationError;

module.exports = function (oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return HomeAssistantRollershutter;
};
module.exports.HomeAssistantRollershutter = HomeAssistantRollershutter;

function HomeAssistantRollershutter(log, data, client, type) {
  // device info
  this.domain = "rollershutter"
  this.data = data
  this.entity_id = data.entity_id
  if (data.attributes && data.attributes.friendly_name) {
    this.name = data.attributes.friendly_name
  }else{
    this.name = data.entity_id.split('.').pop().replace(/_/g, ' ')
  }

  this.client = client
  this.log = log;
}

HomeAssistantRollershutter.prototype = {

  getCurrentPosition: function(callback){
    this.client.fetchState(this.entity_id, function(data){
      if (data && data.attributes) {
        currentPosition = data.attributes.current_position
        callback(null, currentPosition)
      } else {
        callback(communicationError)
      }
    }.bind(this))
  },
  getTargetPosition: function(callback){
    // HA doesn't provide targePosition yet so just reporting the currentPosition instead
    this.client.fetchState(this.entity_id, function(data){
      if (data && data.attributes) {
        targetPosition = data.attributes.current_position
        callback(null, targetPosition)
      } else {
        callback(communicationError)
      }
    }.bind(this))
  },
  getPositionState: function(callback){
    // HA also doesn't support increasing or decreasing state so we always have to pretend the shutters are already at there targetPosition and stopped
    /*this.client.fetchState(this.entity_id, function(data){
      if (data) {
        positionState = 2
        callback(null, positionState)
      } else {
        callback(communicationError)
      }
    }.bind(this))*/
    positionState = 2;
    callback(null, positionState)
  },
  setTargetPosition: function(position, callback){
    // Seems like HA also doesn't support setting a specific position so just setting to open for values <50 and closed for >=50
    var that = this;
    var service_data = {}

    service_data.entity_id = this.entity_id
    
    if (position < 50) {
      this.log("Setting'"+this.name+"' open");
      this.client.callService(this.domain, 'move_up', service_data, function(data){
      if (data) {
        that.log("Successfully opened '"+that.name+"'");
        callback()
      }else{
        callback(communicationError)
      }
      }.bind(this))
    } else {
      this.log("Setting '"+this.name+"' closed");
      this.client.callService(this.domain, 'move_down', service_data, function(data){
      if (data) {
        that.log("Successfully closed '"+that.name+"'");
        callback()
      }else{
        callback(communicationError)
      }
      }.bind(this))
    }
  },
  getServices: function() {
    var shutterService = new Service.WindowCovering();
    var informationService = new Service.AccessoryInformation();
    var model;
    
    model = "WindowCovering"
    
    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Home Assistant")
      .setCharacteristic(Characteristic.Model, model)
      .setCharacteristic(Characteristic.SerialNumber, "xxx");

    shutterService
      .getCharacteristic(Characteristic.CurrentPosition)
      .on('get', this.getCurrentPosition.bind(this))

    shutterService
      .getCharacteristic(Characteristic.TargetPosition)
      .on('get', this.getTargetPosition.bind(this))
      .on('set', this.setTargetPosition.bind(this))
      
    shutterService
      .getCharacteristic(Characteristic.PositionState)
      .on('get', this.getPositionState.bind(this))

    return [informationService, shutterService];
  }
}
