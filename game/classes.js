const fs=    require('fs');
const Utils= require('./utils');

class Entity {
  constructor(global_entities){
    this.global_entities=  global_entities;
    this.id=        Utils.id_generator.get_new_id("room");
    this.type= "";
    this.name="";
    this.description="";
    this.container_id="";
    this.entities=  [];
    this.current_game_id = null;
  }

  add_entity(id){
    this.entities.push(id);
  }
}

class Room extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);

    this.exits= {
      north: null, //direction: id of next room.
      south: null,
      east:  null,
      west:  null,
      up:    null,
      down:  null
    }

    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }
  }

  get_look_string(){
        
    let msg = `${this.get_name()} `;

    //If in game, add the game name.
    if (this.current_game_id!==null){
      let game = this.global_entities.get(this.current_game_id);
      msg += `(${game.get_name()})`;
    }

    //Exits
    let exits_html = '';    
    for (const [direction, next_room_id] of Object.entries(this.exits)){         
      if (next_room_id!==null){
        switch(direction){
          case "north":
            exits_html += ' N';
            break;

          case "south":
            exits_html += ' S';
            break;

          case "east":
            exits_html += ' E';
            break;
          
          case "west":
            exits_html += ' W';
            break;

          case "up":
            exits_html += ' U';
            break;

          case "down":
            exits_html += ' D';
            break;
        }              
      }
    }
  
    if (exits_html!==''){
      exits_html = ` [` + exits_html + ' ]';        
    }
  
      msg += exits_html;   
  
      msg += `<p>${this.props.description}</p>`;
      msg += '<p>In the room: ';
          
      for (const entity_id of this.props.entities){            
        let entity = this.world.get_instance(entity_id);      
        msg += `${entity.get_name()} `;
      }  
  
      msg += `</p>`
  
      return msg;
    
  }

  get_name(){    
    return `<span class="room_name" data-id="${this.id}">${this.name}</span>`;    
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

  look_cmd(target_id=null){    
        
    if (target_id===null){
      //Look at the room the user is in.
      let room= this.global_entities.get(this.container_id);
      this.send_msg_to_client("Chat", room.get_look_string());      
      return;
    }

    // //Target was found.
    // let entity = this.world.get_instance(target_id);

    // if (entity.props.container_id===this.props.id || 
    //     entity.props.container_id===this.props.container_id){
    //   this.send_chat_msg_to_client(entity.get_look_string());
    //   return;
    // }

    // //Target is not on the body or in the same room.
    // this.send_chat_msg_to_client(`It's not in the same room as you.`);
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
