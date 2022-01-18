const fs=    require('fs');
const Utils= require('./utils');

class Entity {
  constructor(global_entities){
    this.global_entities=  global_entities;    
    this.type= "";
    this.name="";
    this.description="";
    this.container_id="";
    this.entities=  [];
    this.current_game_id = null;    
  }

  //Add to the containers. Set entity's container id.
  add_to_container(container_id){
    let container = this.global_entities.get(container_id);
    container.entities.push(this.id);
    this.container_id = container_id;
  }

  //Remove from current container. Zero entity's container id.
  remove_from_container(){
    let container = this.global_entities.get(this.container_id);

    if (container!==undefined){
      //Container exists. We assume the entity is in the container.
      container.entities.splice(container.entities.indexOf(this.id),1);        
    }
    
    this.container_id = null;
  }
}

class Room extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=        Utils.id_generator.get_new_id("room");

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

    this.global_entities.set(this.id, this);
  }

  get_look_string(){
        
    let msg = `${this.get_name()} `;

    //If in game, add the game name.
    // if (this.current_game_id!==null){
    //   let game = this.global_entities.get(this.current_game_id);
    //   msg += `(${game.get_name()})`;
    // }

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

    msg += `<p>${this.description}</p>`;
    msg += '<p>In the room: ';
  
    for (const entity_id of this.entities){            
      let entity = this.global_entities.get(entity_id);      
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
    this.id=        Utils.id_generator.get_new_id("user");

    this.socket;

    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }

    this.global_entities.set(this.id, this);
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

      let content = {
        html:         room.get_look_string(),
        is_flashing:  false
      };
      this.send_msg_to_client("Chat", content);      
      return;
    }

    //Target is specified.
    let entity = this.global_entities.get(target_id);

    if (entity.container_id===this.id || 
        entity.container_id===this.container_id){

      let content = {
        html:         entity.get_look_string(),
        is_flashing:  false
      };
      this.send_msg_to_client("Chat", content);      
    }

    //Target is not on the body or in the same room.
    let content = {
      html:         `It's not in the same room as you.`,
      is_flashing:  false
    };
    this.send_msg_to_client("Chat", content);    
  }

  destroy_user(){
    //Remove the user from his room.
    this.remove_from_container();
    
    let content = {
      html:        `Disconnected! To re-enter, refresh the page. Bye Bye!`,
      is_flashing: false
    }
    
    this.send_msg_to_client('Chat', content);
    this.global_entities.delete(this.id);
  }
}

class Item extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=        Utils.id_generator.get_new_id("item");

    this.cooldown_counter = 0;
    this.cooldown_period= null;
    this.action=null;

    //Overwrite the default props.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key]= value;
      }
    }

    this.global_entities.set(this.id, this);
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    return `<span class="tag is-primary clickable" data-id="${this.id}">${this.name}</span>`;
  }
}

exports.User=             User;
exports.Room=             Room;
exports.Item=             Item;
