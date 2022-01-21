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

  get_look_string(){
    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.description}</p>`;    
    return msg;
  }

  set_props(props){
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this[key] = value;
      }
    }    
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
    this.background = "white";

    this.set_props(props);
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
    return `<span class="room_name clickable" data-id="${this.id}">${this.name}</span>`;    
  }

  name_clicked(clicking_user_id){       
    let clicking_user = this.global_entities.get(clicking_user_id);

    if (clicking_user.container_id===this.id){
      //Only cmd is look
      clicking_user.look_cmd();
    }    
  }

  get_exits(){
    let obj = {
      north:  (this.exits.north===null? false:true),
      south:  (this.exits.south===null? false:true),
      east:   (this.exits.east===null?  false:true),
      west:   (this.exits.west===null?  false:true),
      up:     (this.exits.up===null?    false:true),
      down:   (this.exits.down===null?  false:true),
    }
    return obj;
  }
}

class User extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=            Utils.id_generator.get_new_id("user");
    this.description=   "A Human player.";

    this.socket;
    this.team_color = null;

    this.set_props(props);
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
      return;
    }

    //Target is not on the body or in the same room.
    let content = {
      html:         `It's not in the same room as you.`,
      is_flashing:  false
    };
    this.send_msg_to_client("Chat", content);    
  }
  
  //Get the exits from the current room and send them.
  send_exits_msg_to_client(){    
    let room = this.global_entities.get(this.container_id);
    let content = {
      type:     "Exits Message",
      content:  room.get_exits()
    }    
    this.send_msg_to_client('Exits Message', content);
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

  name_clicked(clicking_user_id){
    
    let availabe_cmds = [];  
    let clicking_user = this.global_entities.get(clicking_user_id);
  
    if (clicking_user_id===this.id){
      //The user clicked his own name.
      availabe_cmds.push('User Info');
      availabe_cmds.push('Edit User');      

      if (this.current_game_id===null){
        //user not in a game.
        availabe_cmds.push('Create A New Game');
        availabe_cmds.push('Join A Game');
      } else {
        //User is in a game
        availabe_cmds.push('Switch Sides');
        availabe_cmds.push('Quit To Lobby');
      }

    } else {
      //Another user clicked this user's name.
      if (this.props.current_game_id!==null &&
          clicking_user.props.holding!==null){
        //In a game and holding a gun
        let game = this.world.get_instance(this.props.current_game_id);
        if (game.props.is_started){
          availabe_cmds.push('Shot'); 
        }        
      }

      availabe_cmds.push('Look');
      availabe_cmds.push(`Tell`); 
    }
  
    let cmds_arr = [];
    for (const cmd of availabe_cmds){
      cmds_arr.push(`<span class="button is-small is-warning is-rounded cmd_button" data-id="${this.id}">${cmd}</span>`);
    }

    let content = {
      cmds_arr: cmds_arr      
    }
    
    clicking_user.send_msg_to_client("Commands Array", content);    
  }
  
  
}

class Item extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=        Utils.id_generator.get_new_id("item");

    this.cooldown_counter = 0;
    this.cooldown_period= null;
    this.action=null;
    this.is_consumable= false;
    this.is_gettable= false;
    this.is_holdable= false;
    this.wear_slot= null;
    
    this.set_props(props);
    this.global_entities.set(this.id, this);
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    return `<span class="tag is-primary clickable" data-id="${this.id}">${this.name}</span>`;
  }

  name_clicked(clicking_user_id){
    
    let clicking_user = this.global_entities.get(clicking_user_id);
    let availabe_cmds = [];

    if (this.container_id===clicking_user.container_id || 
        this.container_id===clicking_user_id){
      //Item is in the same room as user (on or off the body)
      availabe_cmds.push('Look');

      if (this.action!==null){
        availabe_cmds.push("Use");
      }

      if (this.is_consumable){
        availabe_cmds.push('Consume');
      }

      if (this.container_id===clicking_user_id){
        //The item is on the user's body
        availabe_cmds.push('Drop');

        let ix = clicking_user.entities.indexOf(this.id);
        if (ix===-1){
          //Item is not in the user's slot
          availabe_cmds.push('Remove');
        } else {
          //Item is in the user's slots
          if (this.is_holdable){
            availabe_cmds.push('Hold');        
          }
    
          if (this.wear_slot!==null){
            availabe_cmds.push('Wear');        
          }
        }

      } else {
        //The item is not on the user's body
        if (this.is_holdable){
          availabe_cmds.push('Hold');        
        }
  
        if (this.wear_slot!==null){
          availabe_cmds.push('Wear');        
        }

        if (this.is_gettable){
          availabe_cmds.push('Get');        
        }
      }

    }
    
    if (availabe_cmds.length===0){
      //Do nothing
      return;
    } else if (availabe_cmds.length===1){
      //If only one cmd exists - it must be Look.
      clicking_user.look_cmd(this.id);
    } else {
      //Send the user an array of available cmds.
      let cmds_arr = [];
      for (const cmd of availabe_cmds){
        cmds_arr.push(`<span class="button is-small is-primary is-rounded cmd_button" data-id="${this.id}">${cmd}</span>`);
      }

      let content = {
        cmds_arr: cmds_arr
      }
      clicking_user.send_msg_to_client("Commands Array", content);
    }
  }
  
}

class Game extends Entity {
  constructor(global_entities, entities_db, props=null){
    super(global_entities);
    this.entities_db= entities_db;
    this.id=          Utils.id_generator.get_new_id("game");

    this.owner_id=        null;
    this.spawn_rooms=     {
      red:  [],
      blue: []
    };
    this.game_has_started= false;
    this.score=           {
      red:  0,
      blue: 0
    };
    this.max_score=         5;
    this.is_private=        false;
    this.items_spawn_rooms= {}; //entity_name: room array
    this.teams = {
      red:  [], //user_ids
      blue: []
    }
    this.map_name = null;

    this.set_props(props);
    this.global_entities.set(this.id, this);
  }

  init(){
    let path = `./maps/pacman_map.json`;
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));    
      
      this.spawn_rooms.blue=  parsed_info.blue_spawn_room_id;
      this.spawn_rooms.red=   parsed_info.red_spawn_room_id;
      this.item_spawn_rooms=  parsed_info.item_spawn_rooms;
      this.map_name= "Pacman";

      //Spawn Rooms
      for (const props of parsed_info.rooms){
        let room = new Room(this.global_entities, props);
        room.current_game_id = this.id;
        room.add_to_container(this.id);
        
        //spawn items in the room. Add them to the game.
        let items_arr = this.item_spawn_rooms[room.id];
        if (items_arr!==undefined){
          for (const item_name of items_arr){
            let props=  this.entities_db[item_name];
            let item=   new Item(this.global_entities, props);
            item.add_to_container(room.id);
            item.current_game_id=  this.id;
            item.add_to_container(this.id);
          }
        }
      }     

    }  else {
      console.error(`classes.game.init_map -> pacman.json does not exist.`);
    }
  }

  add_player(user_id){
    
    this.add_to_container(user_id);
    
    let user = this.global_entities.get(user_id);    

    if (this.teams.red.length<= this.teams.blue.length){
      //i.e., game owner is always Red.
      this.teams.red.push(user_id);
      user.team_color = "Red";
    } else {
      this.teams.blue.push(user_id);
      user.team_color = "Blue";
    }

    //Spawn in Team's room.
    
    
    //Announce to all existing players.
    let content = {
      html:       `${user.get_name()} has joined team ${user.team_color}`,
      is_flashing: false
    };
    this.send_msg_to_all_players(content);
  }

  send_msg_to_all_players(content){
    for (const user_id of this.teams.red){
      let user = this.global_entities.get(user_id);
      user.send_msg_to_client("Chat", content);
    }

    for (const user_id of this.teams.blue){
      let user = this.global_entities.get(user_id);
      user.send_msg_to_client("Chat", content);
    }
  }
}

exports.User=             User;
exports.Room=             Room;
exports.Item=             Item;
exports.Game=             Game;
