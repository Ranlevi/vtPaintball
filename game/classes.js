const fs=    require('fs');
const Utils= require('./utils');

class Entity {
  constructor(global_entities){
    this.global_entities=  global_entities;
    this.id=        Utils.id_generator.get_new_id("room");
    this.type;
    this.name;
    this.description;
    this.container_id;
    this.entities=  [];
  }

  add_entity(id){
    this.entities.push(id);
  }
}

class Room extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);

    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }
  }
}

class User extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);

    this.socket;

    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }
  }

  send_msg_to_client(msg_type, content){
    let msg = {
      type:     msg_type,
      content:  content
    };

    this.socket.emit('Message From Server', msg);
  }

  get_name(){
    return `<span class="tag is-warning clickable" data-id="${this.id}">${this.name}</span>`;
  }
}

class Item extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);

    this.cooldown_counter = 0;
    this.cooldown_period;
    this.action;


    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }
  }
}

exports.User=             User;
exports.Room=             Room;
exports.Item=             Item;
