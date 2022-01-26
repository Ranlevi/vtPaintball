const fs=    require('fs');
const Utils= require('./utils');

//Base class for all entities in the game. Holds generic props and methods.
class Entity {
  constructor(global_entities){
    this.global_entities=   global_entities;//Pointer to all entities in the app.
    this.type=              "";
    this.name=              "";
    this.description=       "";
    this.container_id=      "";
    this.entities=          [];//Ids of entities contained inside the entity.
    this.current_game_id =  null;//ID of the game the entity belongs to (if exists)    
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

  //Returns an html string with the entity's name and description.
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

  //Spawn the entity in the given container. If it's a room - notify other users in it.
  spawn(container_id){      

    this.add_to_container(container_id);

    let container = this.global_entities.get(container_id);
    if (container.type==="Room"){
      
      //If the spawned entity is a user, don't send the message to him.
      let sender_id = null;
      if (this.type==="User"){
        sender_id = this.id;
      }

      container.send_msg_to_all_users_in_the_room(`${this.get_name()} has spawned here.`, sender_id);
    }
  }  

  tick(){
    //Implement for each class.
  }
}

//All activity in the game happens in rooms, that users move between.
class Room extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=        Utils.id_generator.get_new_id("room");

    this.type =     "Room";
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

  //Returns an HTML string describing the room and its contents.
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

    msg += `<p>${this.description}</p>`;
    msg += '<p>In the room: ';
  
    for (const entity_id of this.entities){            
      let entity = this.global_entities.get(entity_id);      
      msg += `${entity.get_name()} `;
    }  
  
    msg += `</p>`;

    //If the room is the lobby - display available public games.
    if (this.id==="r0000000"){
      msg += "<p><b>Publicly available games:</b></p>";

      let games_arr = [];
      for (const entity of this.global_entities.values()){
        if (entity.type==="Game" && !entity.is_private){
          games_arr.push(entity.get_name());
        }
      }

      if (games_arr.length===0){
        msg += "<p>None.</p>"
      } else {
        for (const item of games_arr){
          msg += `<p>${item}</p>`;
        }
      }
    }

    return msg;    
  }

  //Returns an HTML string with the room's name and relevant CSS classes.
  get_name(){    
    return `<span class="room_name clickable" data-id="${this.id}">${this.name}</span>`;    
  }

  //Handle clicks on the room's name.
  name_clicked(clicking_user_id){       
    let clicking_user = this.global_entities.get(clicking_user_id);

    if (clicking_user.container_id===this.id){
      //Only cmd is look
      clicking_user.look_cmd();
    }    
  }

  //Returns an object with the state of room's exits (true===exit available.)
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

  send_msg_to_all_users_in_the_room(html, sender_id=null){

    let content = {
      html:         html,
      is_flashing:  false
    };

    for (const entity_id of this.entities){

      if (entity_id===sender_id){
        //If sender_id is specified, don't send the message to that sender.
        return;
      }

      let entity = this.global_entities.get(entity_id);
      if (entity.type==="User"){
        entity.send_msg_to_client("Chat", content);
      }
    }
  }
}

//Logged in users.
class User extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=            Utils.id_generator.get_new_id("user");
    this.socket;

    this.description=   "A Human player.";
    this.type=          "User";    
    this.team_color=    null;

    this.set_props(props);
    this.global_entities.set(this.id, this);
  }

  //Generic method to handle all comm to client.
  send_msg_to_client(msg_type, content){
    let msg = {
      type:     msg_type,
      content:  content
    };

    this.socket.emit('Message From Server', msg);
  }

  //HTML string of user's name and description.
  get_name(){
    return `<span class="tag is-warning clickable" data-id="${this.id}">${this.name}</span>`;
  }

  //Handle click on "Look" command.
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
      //Target is on the user or in the same room as he.

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

  //Note: move cmd - can't move from spawn room before game starts.
  
  //Get the exits from the current room and send them.
  send_exits_msg_to_client(){    
    let room = this.global_entities.get(this.container_id);
    let content = {
      type:         "Exits Message",
      exits_state:  room.get_exits()
    }    
    this.send_msg_to_client('Exits Message', content);
  }

  //Remove user from the current room and from the app.  
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
  
  //Pop out of current room. Spawn in destination room.
  teleport(dest_container_id){

    let current_room = this.global_entities.get(this.container_id);
    current_room.send_msg_to_all_users_in_the_room(`${this.get_name()} has teleported away.`, this.id);
    this.remove_from_container();
        
    this.spawn(dest_container_id);
    
    let dest_room = this.global_entities.get(dest_container_id);
    let content = {
        background: dest_room.background
    }
    this.send_msg_to_client("Change Background", content);
    this.look_cmd();
  }
  
}

class Item extends Entity {
  constructor(global_entities, props=null){
    super(global_entities);
    this.id=                Utils.id_generator.get_new_id("item");

    this.type=              "Item";
    this.cooldown_counter=  0;
    this.cooldown_period=   null;
    this.action=            null;
    this.is_consumable=     false;
    this.is_gettable=       false;
    this.is_holdable=       false;
    this.wear_slot=         null;
    
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

    this.countdown_enabled = false;
    this.countdown_counter = 60;//seconds.
    this.type=        "Game";
    this.minimum_num_of_players = 2;
    this.current_num_of_players = 0;
    this.spawn_rooms=     {
      red:  null,
      blue: null
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
    this.init();
  }

  init(){

    let path;
    if (this.map_name==="Pacman"){
      path = __dirname + `/maps/pacman_map.json`;
    }
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));    
      
      this.minimum_num_of_players=  parsed_info.minimum_num_of_players;
      this.spawn_rooms.blue=        parsed_info.blue_spawn_room_id;
      this.spawn_rooms.red=         parsed_info.red_spawn_room_id;
      this.item_spawn_rooms=        parsed_info.item_spawn_rooms;      

      //Spawn Rooms
      for (const props of parsed_info.rooms){

        //Create the room, add it to the game.
        let room = new Room(this.global_entities, props);
        room.current_game_id = this.id;
        room.add_to_container(this.id);
        
        //spawn items in the room. Add them to the game.
        let items_arr = this.item_spawn_rooms[room.id];
        if (items_arr!==undefined){
          for (const item_name of items_arr){

            //Create the item. Add to room. Add to game.
            let props=  this.entities_db[item_name];
            let item=   new Item(this.global_entities, props);
            item.spawn(room.id);

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
    
    //Add user to game.
    this.add_to_container(user_id);
    
    //Remove the user from the lobby
    let user = this.global_entities.get(user_id);
    user.current_game_id= this.id;    

    //Determine the team the user is in, teleport him to the spawn room.
    if (this.teams.red.length<= this.teams.blue.length){
      //i.e., game owner is always Red.
      this.teams.red.push(user_id);
      user.team_color = "Red";      
      user.teleport(this.spawn_rooms.red);
    } else {
      this.teams.blue.push(user_id);
      user.team_color = "Blue";
      user.teleport(this.spawn_rooms.blue);
    }   

    
    //Announce to all existing players.
    let content = {
      html:       `${user.get_name()} has joined team ${user.team_color}`,
      is_flashing: false
    };
    this.send_msg_to_all_players(content);

    //Check if enough users have joined the game.
    if (this.current_num_of_players===this.minimum_num_of_players){
      this.countdown_enabled = true;
    } else {
      content.html = `<p>Waiting for more players to join the game.</p><p>Minimum number of players for this map: ${this.minimum_num_of_players}.</p>`;
      this.send_msg_to_all_players(content);
    }    
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

  get_name(){
    //Returns an HTML string for the name of the entity.
    return `<span class="link clickable" data-id="${this.id}">${this.name}</span>`;
  }

  //Remove a user from the current game. If no more users exist, destroy the game.
  remove_player(user_id){    

    let user = this.global_entities.get(user_id);

    //Remove user from the teams.
    if (user.team_color==="Red"){
      let ix = this.teams.red.indexOf(user_id);
      this.teams.red.splice(ix,1);
    } else if (user.team_color==="Blue"){
      let ix = this.teams.blue.indexOf(user_id);
      this.teams.blue.splice(ix,1);
    }

    //Remove user from the game.
    let ix = this.entities.indexOf(user_id);
    this.entities.splice(ix,1);

    user.current_game_id = null;

    //Check if other users exist. If not - close the game.
    if (this.current_num_of_players===0){      
      this.destroy_game();
    }
  }

  //remove rooms, items and the game itself from the world.
  destroy_game(){
    //Assumes no users are left in the game.    
    for (const id of this.entities){
      this.global_entities.delete(id);
    }

    //remove the game itself
    this.global_entities.delete(this.id);
  }

  tick(){

    if (this.countdown_enabled){

      if ([60,45,30,20,10,5,3,2,1].includes(this.countdown_counter)){
        this.send_msg_to_all_players(`Game starts in ${this.countdown_counter} seconds.`);
      }

      if (this.countdown_counter!==0){
        this.countdown_counter -= 1;
      } else {
        //Count down reached zero.
        this.countdown_enabled = false;
        this.countdown_counter = 60;
        this.start_game();
      }
    }
  }

  start_game(){
 
    this.game_has_started  = true;
    this.score= {
      red:  0,
      blue: 0
    };
    
    this.send_msg_to_all_players('THE GAME HAS STARTED!!');
    // this.send_music_msg_to_all_players('On');
  }

  name_clicked(clicking_user_id){

    let clicking_user = this.global_entities.get(clicking_user_id);
    let availabe_cmds = [];    
    
    availabe_cmds.push('Game Info');
    availabe_cmds.push('Copy ID');       
    
    if (clicking_user.current_game_id===null){
      availabe_cmds.push("Join This Game");      
    } else {
      availabe_cmds.push("Quit To Lobby");
    }

    let cmds_arr = [];
      for (const cmd of availabe_cmds){
        cmds_arr.push(`<span class="button is-small is-danger is-rounded cmd_button" data-id="${this.id}">${cmd}</span>`);
      }

    let content = {
      cmds_arr: cmds_arr
    }
    clicking_user.send_msg_to_client("Commands Array", content);         
  }
}

exports.User=             User;
exports.Room=             Room;
exports.Item=             Item;
exports.Game=             Game;
