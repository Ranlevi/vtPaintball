const e = require('cors');
const Utils= require('./utils');
// const World= require('./world');

class Room {
  constructor(world, props=null){   
    
    this.world =          world;
    
    this.props = {
      type:               "Room",
      id:                 Utils.id_generator.get_new_id("room"),
      entities:           [],
      name:               "A Room",      
      subtype:            "Room",
      description:        "",      
      exits: {
        north:            null, //direction: {id: string, code: string}
        south:            null,
        west:             null,
        east:             null,
        up:               null,
        down:             null
      },
      lighting:           "white", //CSS colors 
      game_id:            null, //Or string 
    }

    //Overwrite the default props with the custome ones from the save file.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }      
  }
    
  //Inventory Manipulation Methods
  add_entity(entity_id){
    this.props.entities.push(entity_id);
  }
  
  //try to remove the given entity from the room.
  //Return True is successful, else False.
  remove_entity(entity_id){    
    let ix = this.props.entities.indexOf(entity_id);
    if (ix!==-1){
      this.props.entities.splice(ix,1);
      return true;
    } else {
      return false;
    }    
  }
  
  //Returns an array ids. 
  get_all_items(){    
    return this.props.entities;
  }  
    
  //Returns an HTML string for the name of the room.
  get_name(){
    
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.props.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Copy ID_Edit">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  //Returns a Look Command message (String)
  get_look_string(){   
        
    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>` + 
              `<p><span class="style1">Exits: `;
    
    let exits_exists = false;
    for (const [direction, obj] of Object.entries(this.props.exits)){   
      
      if (obj!==null){
        exits_exists = true;
        msg += `<span class="pn_link" data-element="pn_cmd" ` + 
                `data-actions="${direction.toUpperCase()}" >` +
                `${direction.toUpperCase()}</span> `
      }
    }
    
    if (!exits_exists){
      msg += "None.</span></p>"
    }

    msg += '<p>In the room: ';
    
    for (const entity_id of this.props.entities){
      let entity = this.world.get_instance(entity_id);      
      msg += `${entity.get_name()} `;
    }  

    msg += `</p>`

    return msg;
  }

  do_tick(){
    //TBD
  } 

  //Modify the room's props according to props recieved from the client.
  do_edit(props, user_id){
        
    this.props.name         = props.name;
    this.props.description  = props.description;
    this.props.lighting     = props.lighting;
    
    let exits = ["north", "south", "east", "west", "up", "down"];

    for (const exit of exits){
      if (props[exit]===undefined){
        //The exit was disabled by the user (checkbox not ticked)
        this.props.exits[exit] = null;
      } else if (props[exit]==="true"){
        //Exit was enabled by the user (or was already enabled)
        //We need to check if the exit was already enabled, as to not 
        //damage the existing connection between the two room.
        if (this.props.exits[exit]===null){
          //This is an exit that was not enabled before.
          this.props.exits[exit] = {id: null, code: null};
        }        
      }
    }

    let user = this.world.get_instance(user_id);
    user.send_chat_msg_to_client('Editing succesful.');
  }
  
}

class User {  
  constructor(world, props=null){
    //Create a generic user with default values, then override them with given props.  

    this.BODY_PARTS =     ["holding", "head", "torso", "legs", "feet"];

    this.world=           world;
    this.tick_counter=    0; //Provision for future ideas.

    this.props = {
      type:               "User",
      id:                 Utils.id_generator.get_new_id("user"),
      name:               "An Unnamed User",
      description:        "A (non-NPC) human.",
      subtype:            "Human",        
      password:           null, //String
      socket:             null,
      is_admin:           false,      
      container_id:       null,
      head:               null,//ID, String.
      torso:              null,
      legs:               null,
      feet:               null,
      holding:            null,
      slots:              [],
      slots_size_limit:   10,
      spawn_room_id:      null,
      current_game_id:    null,
      owned_game_id:      null,
      team:               null,
    }
    
    //Overwrite default props with saved props.         
    for (const [key, value] of Object.entries(props)){
      this.props[key]= value;
    }      
  }

  set_socket(socket){
    this.props.socket = socket;
  }

  set_container_id(container_id){
    this.props.container_id = container_id;
  }

  set_team(team_color){ //String (Blue / Red)
    this.props.team = team_color;
  }

  get_id(){
    return this.props.id;
  }

  do_tick(){    
    //Send a status message    
    this.send_status_msg_to_client();
  }   

  //Check if a shot hits the user, and if so, respawn
  //return true if hit, else false
  do_shot(shooter_id){
    //Shots have 70:30 chance of hitting
    let num = Math.random();

    if (num>=0.7){
      //Hit
      let shooter = this.world.get_instance(shooter_id);
      this.send_chat_msg_to_client(`You were HIT by ${shooter.get_name()}.`);

      this.spwan_in_room(this.props.spawn_room_id);
      return true;

    } else {
      //Miss
      return false;
    }

  }

  spwan_in_room(dest_id){
    //A room exists. Teleport to it.
    let origin_room = this.world.get_instance(this.props.container_id);
    this.send_msg_to_room(`disappears.`);
    origin_room.remove_entity(this.props.id);

    let dest_room = this.world.get_instance(dest_id);
    dest_room.add_entity(this.props.id);
    this.props.container_id = dest_room.props.id;
    this.send_chat_msg_to_client(`Poof!`);  
    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`appears in the room.`);
  }

  //Aux. Methods.
  //--------------
  
  //Returns an HTML string for the name of the entity.
  get_name(){    

    let team_class;
    if (this.props.team===null){
      team_class = "";
    } else if (this.props.team==="Blue"){
      team_class = "blue_team";
    } else if (this.props.team==="Red"){
      team_class = "red_team";
    }

    let html = 
      `<span `+
      `class="pn_link ${team_class}" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.props.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Copy ID">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  //Return a String message with what other see when they look at the user.
  get_look_string(){    

    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>` +
              `<p>Carrying: `;

    let text = '';

    for (const body_part of this.BODY_PARTS){
      if (this.props[body_part]!==null){
        let entity = World.world.get_instance(this.props[body_part]);
        text += `${entity.get_name()} `; 
      }
    }
    
    if (text==='') text = 'Nothing.';
    msg += text;
    msg += `</p>`;
    return msg;
  }
  
  //Inventory Manipulation Methods
  //--------------------------------
  
  //Returns an array of objects: {id: string, location: string}
  //Results will be ordered by holding->wearing->slots.
  get_all_items(){    
    let inv_arr = [];
    
    for (const part of this.BODY_PARTS){
      if (this.props[part]!==null) inv_arr.push({id: this.props[part], location: part});
    }

    for (const id of this.props.slots){
      inv_arr.push({id: id, location: "slots"});      
    }

    return inv_arr;
  }  

  //Remove the given id from the given location.  
  remove_item(id, location){
    if (location==="slots"){
      let ix = this.props.slots.indexOf(id);          
      this.props.slots.splice(ix,1);
    } else {
      this.props[location] = null;
    }   
  }

  //Handle Client Commands.
  //-----------------------------

  move_cmd(direction){

    let current_room=   this.world.get_instance(this.props.container_id);
    let next_room_obj=  current_room.props.exits[direction]; //null or {"id": str, "code": str/null}
  
    if (next_room_obj===null){
      //There's no exit in that direction.
      this.send_chat_msg_to_client(`There's no exit to ${direction}.`);
      return;
    }
    
    if (this.props.current_game_id!==null){
      let game = this.world.get_instance(this.props.current_game_id);
      if (!game.props.is_started){
        this.send_chat_msg_to_client(`You can only leave the room once the game has started.`);
        return;
      }
    }

    //An exit exists.    
    //Check if locked, and if true - check for key on the user's body.
    if (next_room_obj.code!==null){
      //This door requires a key.
      let inv_arr = this.get_all_items();
      
      //Check for a key
      let key_exists = false;
      for (const obj of inv_arr){
        //obj is of the form: {id: string, location: string}
        let entity = this.world.get_instance(obj.id);
        if (entity.props.key_code===next_room_obj.code){
          key_exists = true;
          break;
        }
      }
        
      if (!key_exists){
        //The user does not have a key on their body.
        this.send_chat_msg_to_client(`It's locked, and you don't have the key.`);        
        return;
      }
    }

    //Key found (or exit is not locked)
    //User can move to the next room.

    let next_room = this.world.get_instance(next_room_obj.id);

    //Send messages. 
    this.send_chat_msg_to_client(`You travel ${direction}.`);
    this.send_msg_to_room(`travels ${direction}.`);

    //Remove the player from the current room, add it to the next one.    
    current_room.remove_entity(this.props.id);    
    next_room.add_entity(this.props.id);

    this.props.container_id= next_room_obj.id;
    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`enters from ${Utils.get_opposite_direction(direction)}.`);
  }

  //search for a target on the user's body or in the room.
  //target can be an id, a subtype or a name.
  //returns a string message.   
  look_cmd(target=null){    
    let room= this.world.get_instance(this.props.container_id);   

    if (target===null){
      //Look at the room the user is in.
      this.send_chat_msg_to_client(room.get_look_string());      
      return;
    }

    //Target is not null. Search for it.       
    let result = Utils.search_for_target(this.world, target, this.props.id);   
    
    if (result===null){
      this.send_chat_msg_to_client(`There is no such thing around.`);
        return;            
    }

    //Target was found.
    let entity = this.world.get_instance(result.id);
    this.send_chat_msg_to_client(entity.get_look_string());
  }

  //Pick an item from the room, and place it in a slot.
  get_cmd(target=null){    

    if (target===null){   
      this.send_chat_msg_to_client(`What do you want to get?`);   
      return;
    }

    //Target is not null. Search in the room.
    let room=     this.world.get_instance(this.props.container_id);
    let result=   Utils.search_for_target(this.world, target, this.props.id);


    if (this.BODY_PARTS.includes(result.location)){
      this.send_chat_msg_to_client(`You already have it.`);
      return;
    }
    
    if (result===null || result.location!=="in_room"){
      this.send_chat_msg_to_client(`There's no ${target} in the room with you.`);
      return;
    }

    //Target found.
    //Check if gettable
    let entity = this.world.get_instance(result.id);

    if (entity instanceof Room || entity instanceof User){
      this.send_chat_msg_to_client(`How do you want to pick THAT up?`);
      return;
    }

    //Target is an Item or an NPC    
    if (!entity.props.is_gettable){
      this.send_chat_msg_to_client(`You can't pick it up.`);
      return;
    }    
    
    //Check is misc_slots are full.
    if (this.props.slots_size_limit===this.props.slots.length){
      this.send_chat_msg_to_client(`You are carrying too many things already.`);
      return;
    }

    //The user can carry the item.
    //Remove it from the room, place it in the player's slots.
    room.remove_entity(entity.props.id);
    this.props.slots.push(entity.props.id);    
    entity.set_container_id(this.props.id);

    //Notify client and room
    this.send_chat_msg_to_client('You pick it up and place it in your slots.');
    this.send_msg_to_room(`gets ${entity.get_name()}`);
  }

  //search for target on body and drop the target to the room.
  drop_cmd(target=null){    

    if (target===null){      
      this.send_chat_msg_to_client(`What do you want to drop?`);
      return;
    }

    let result=   Utils.search_for_target(this.world, target, this.props.id);

    if (result===null || !(["holding", "head", "torso", "legs", "feet", "slots"].includes(result.location))){
      //target not found on the user's body.
      this.send_chat_msg_to_client(`You don't have it on you.`);
      return;
    }

    //Target found, remove it from the user's body.
    this.remove_item(result.id, result.location);

    //Place it in the room.
    let room = this.world.get_instance(this.props.container_id);
    room.add_entity(result.id);

    let entity = this.world.get_instance(result.id);
    entity.set_container_id(room.props.id);

    //Send messages.
    this.send_chat_msg_to_client('You drop it to the floor.');
    this.send_msg_to_room(`drops ${entity.get_name}.`);    
  }

  //Search for target on body and room, and hold it.
  hold_cmd(target=null){    
    
    if (target===null){
      this.send_chat_msg_to_client(`What do you want to hold?`);      
      return;
    }

    let result= Utils.search_for_target(this.world, target, this.props.id);

    if (result===null || result.location==="room"){
      this.send_chat_msg_to_client(`There's no ${target} around to hold.`);
      return;            
    }

    //Target was found. Check if already held.
    if (result.location==="holding"){
      this.send_chat_msg_to_client(`You're already holding it!`);
      return;
    }
 
    //Check if target is holdable
    let entity = this.world.get_instance(result.id);

    if (!entity.props.is_holdable){
      this.send_chat_msg_to_client(`You can't hold it.`);
      return;
    }

    //Target is holdable.
    //Remove it from it's container. 
    if (result.location==="in_room"){
      let room = this.world.get_instance(this.props.container_id);
      room.remove_entity(result.id);
    } else {
      //Must be on the user
      this.remove_item(result.id, result.location);
    }    
    //Set new location of entity.    
    entity.set_container_id(this.props.id);

    //Place it in the user's hands.
    this.props.holding = result.id;

    //Send messgaes
    this.send_chat_msg_to_client(`You hold it.`);
    this.send_msg_to_room(`holds ${entity.get_name()}.`);
  }

  //get an item from the slots or room, and wear it.
  wear_cmd(target=null){    

    if (target===null){
      this.send_chat_msg_to_client(`What do you want to wear?`);      
      return;
    }

    //Search for the target on the user's body.
    let result = Utils.search_for_target(this.world, target, this.props.id);

    let room = this.world.get_instance(this.props.container_id);
    
    if (result===null || result.location==="room"){
      this.send_chat_msg_to_client(`There's no ${target} around to wear.`);
      return;            
    }

    //Target found
    let entity = this.world.get_instance(result.id);

    //Check that it's an Item (all others can't be worn)
    if (!(entity instanceof Item) || entity.props.wear_slot===null){
      this.send_chat_msg_to_client(`You can't wear that.`);
      return;
    }

    //Check that the user isn't already wearing/holding it.    
    if (result.location==="Holding"){
      this.send_chat_msg_to_client(`You're holding it, you can't wear it.`); 
      return;
    }

    if (["head", "torso", "legs", "feet"].includes(result.location)){
      this.send_chat_msg_to_client(`You're already wearing it!`);
      return;
    }

    //Check if target can be worn
    
    if (entity.props.wear_slot===null){
      this.send_chat_msg_to_client(`You can't wear that!`);
      return;
    }

    //Check if required slot is taken
    if (this.props[entity.props.wear_slot]!==null){
      this.send_chat_msg_to_client(`You're already wearing something on your ${entity.props.wear_slot}.`);
      return;
    }

    //Target can be worn.

    //Remove the target from its current location
    switch(result.location){
      case("in_room"):        
        room.remove_entity(result.id);
        break;    

      case("slots"):
        let ix = this.props.slots.indexOf(result.id);
        this.props.slots.splice(ix,1);
        break;      
    }

    //Wear the target
    this.props[entity.props.wear_slot]= result.id;

    entity.set_container_id(this.props.id);

    //Send messages.
    this.send_chat_msg_to_client(`You wear it.`);
    this.send_msg_to_room(`wears ${entity.get_name()}`);
  }

  //get a target from the wearing or holding slots and place it in the slots.
  remove_cmd(target=null){    

    if (target===null){  
      this.send_chat_msg_to_client(`What do you want to remove?`);    
      return;
    }

    //Target is not null. Search for it on the user's body.
    let result = Utils.search_for_target(this.world, target, this.props.id);

    if (result===null || 
        result.location==="room" || 
        result.location==="in_room"){
      this.send_chat_msg_to_client(`You don't have it on you.`);
      return;            
    }

    if (result.location==="slots"){
      this.send_chat_msg_to_client(`It's already in the slots.`);
      return;
    }

    //Target exists
    //Check if the slots are not full
    if (this.props.slots.length===this.props.slots_size_limit){
      this.send_chat_msg_to_client(`You are carrying too many things in your slots already.`);
      return;
    }

    //Slots not full. 
    //Remove the item from it's current location.
    this.remove_item(result.id, result.location);

    //Add it to slots.
    this.props.slots.push(result.id);

    //Send messages.
    let entity = this.world.get_instance(result.id);
    this.send_chat_msg_to_client(`You remove it and place it in your slots.`);
    this.send_msg_to_room(`removes ${entity.get_name()}`); 
  }
 
  //eat/drink food that's in the wear,hold or slots or room.
  consume_cmd(target=null){    

    if (target===null){  
      this.send_chat_msg_to_client(`What do you want to consume?`);    
      return;
    }

    //Target is not null
    //Search for it on the user's body or room
    let result= Utils.search_for_target(this.world, target, this.props.id);
    let room=   this.world.get_instance(this.props.container_id);

    if (result===null || result.location==="room"){
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }

    //Target exists
    //Check if it's edible
    let entity = this.world.get_instance(result.id);

    if (!entity.props.is_consumable){
      this.send_chat_msg_to_client(`You can't eat THAT!`);
      return;
    }

    //Target is edible. Remove it from its container.
    if (result.location==="room"){
      room.remove_entity(result.id);
    } else {
      //Must be on the user's body
      this.remove_item(result.id, result.location);
    }

    this.world.remove_from_world(result.id);

    //Send messages.
    this.send_chat_msg_to_client(`You consume it.`);
    this.send_msg_to_room(`consumes ${entity.get_name()}`);    
  }

  //Say something that will be heard by all entities in the room.
  say_cmd(target=null){

    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to say?`);  
      return;
    }

    //Send messages.
    this.send_chat_msg_to_client(`You say: <span class="say_text">${target}</span`);
    this.send_msg_to_room(`says: ${target}`);
  }

  //Say something to a specific user.
  tell_cmd(username, content=null){    

    if (username===undefined){
      this.send_chat_msg_to_client(`Who do you want to talk to?`);
      return;
    }

    let user_id = this.world.get_user_id_by_username(username);

    if (user_id===null){
      this.send_chat_msg_to_client('No User by this name is online.');
      return;
    }
    
    let user = this.world.get_instance(user_id);

    if (content===''){
      this.send_chat_msg_to_client(`What do you want to tell ${user.get_name()}?`);
      return;
    }
    
    this.send_chat_msg_to_client(`You tell ${user.get_name()}: ${content}`);
    user.get_msg(this.props.id, `tells you: ${content}`);
  }

  //Emote something that will be seen by all the room.
  emote_cmd(target=null){
    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to emote?`);  
      return;
    }

    this.send_chat_msg_to_client(`You emote: ${target}`);
    this.send_msg_to_room(`${target}`);
  }

  //Create a game, with the user as the owner.
  create_cmd(){
    
    let props = {
      owner_id: this.props.id
    }

    let game = new Game(this.world, props);
    this.world.add_to_world(game);
    game.props.entities.push(this.props.id);
    this.props.owned_game_id = game.props.id;

    //Remove the user from the current room. 
    //Add him to the spwan room of the game.
    //A room exists. Teleport to it.
    let origin_room = this.world.get_instance(this.props.container_id);
    this.send_msg_to_room(`teleports to a new game.`);
    origin_room.remove_entity(this.props.id);

    let dest_room = this.world.get_instance(game.props.blue_spawn_room_id);
    dest_room.add_entity(this.props.id);
    this.props.container_id = dest_room.props.id;
    this.props.current_game_id = game.props.id;
    this.props.team=          "Blue";
    this.send_chat_msg_to_client(`You have spawned in the blue room.`);
    this.send_chat_msg_to_client("Enter 'start' to begin the game.")
    this.send_chat_msg_to_client(`Game ID is: ${this.props.owned_game_id}`);
    this.look_cmd();

  }
 
  //Teleport the user to another room. Target is an ID.
  teleport_cmd(target=null){

    if (target===null){    
      this.send_chat_msg_to_client(`Where do you want to teleport to?`);  
      return;
    }

    //Target in not null. Check if a room with given ID exists.
    let dest_room = this.world.get_instance(target);

    if (dest_room===undefined){
      this.send_chat_msg_to_client(`There's no room with that ID.`);  
      return;
    }

    //A room exists. Teleport to it.
    let origin_room = this.world.get_instance(this.props.container_id);
    this.send_msg_to_room(`teleports away.`);
    origin_room.remove_entity(this.props.id);

    dest_room.add_entity(this.props.id);
    this.props.container_id = dest_room.props.id;
    this.send_chat_msg_to_client(`Poof!`);  
    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`teleports into the room.`);
  }
  
  //If the entity is owned by the user, send a message to enable the edit modal.
  edit_cmd(target=null){
    
    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to edit?`);  
      return;
    }

    let result = Utils.search_for_target(this.world,target, this.props.id);

    if (result===null){
      //Target not found
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }
    
    //Target exists
    //Check if it's owned by the user.
    let entity = this.world.get_instance(result.id);
        
    if (this.props.id!==entity.props.owner_id){
      this.send_chat_msg_to_client(`You're not it's owner, you can't edit it.`);
      return;
    }

    //User can edit the entity.

    let msg = {
      id:     entity.props.id,
      type:   null,
      props:  entity.props
    }

    if (entity instanceof Room){
      msg.type = "Room";
    } else if (entity instanceof Item){
      msg.type = "Item";
    } else if (entity instanceof NPC){
      msg.type = "NPC";
    } 

    this.props.socket.emit("Edit Message", msg);
  }

  //Call the item's action.
  use_cmd(target=null){
    //The item's action is called.

    if (target===null){    
      this.send_chat_msg_to_client(`What do you want to use?`);  
      return;
    }

    //Search for the target on the user and in the current room.
    let result= Utils.search_for_target(this.world, target, this.props.id);
    
    if (result===null || result.location==="room"){
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }

    //Target exists    
    let entity = this.world.get_instance(result.id);

    if (!(entity instanceof Item)){
      this.send_chat_msg_to_client(`You can't use it.`);
      return;
    }

    //Target is useable.
    this.send_msg_to_room(`uses ${entity.get_name()}.`);

    if (entity.props.action===null){
      this.send_chat_msg_to_client(`Nothing happens.`);
      return;
    }

    //Target has an action.
    entity.do_action(this.props.id);    
  }

  join_cmd(target=null){

    if (target===null){    
      this.send_chat_msg_to_client(`JOIN needs the Game ID (e.g. 'join g1234567).'`);  
      return;
    }

    //Target is not null.
    let game = this.world.get_instance(target);

    if (game===undefined || game.props.type!=="Game"){
      //No game with given ID
      this.send_chat_msg_to_client(`No game with id: ${target}.`);  
      return;
    }

    //Game found.
    //Check if game has already started.
    if (game.props.is_started){
      this.send_chat_msg_to_client(`Can't join: The game has already started...`);  
      return;
    }

    //User can join the game.
    //Add the user to the game
    let spawn_room_id =  game.join_game(this.props.id);
    this.props.spawn_room_id = spawn_room_id;
    this.props.current_game_id = game.props.id;

    //Remove the user from the current room. 
    //Add him to the spwan room of the game.

    let origin_room = this.world.get_instance(this.props.container_id);
    this.send_msg_to_room(`teleports to join a game.`);
    origin_room.remove_entity(this.props.id);

    let dest_room = this.world.get_instance(spawn_room_id);
    dest_room.add_entity(this.props.id);
    this.props.container_id = dest_room.props.id;    
    this.send_chat_msg_to_client(`You have spawned in the game.`);    
    this.look_cmd();

  }

  //If the user is holding a gun, shot the target
  shot_cmd(target=null){

    if (target===null){    
      this.send_chat_msg_to_client(`Who do you want to shot?`);  
      return;
    }

    if (this.props.holding===null){
      this.send_chat_msg_to_client(`With what? You're not holding anything in your hands.`);  
      return;
    }

    let result = Utils.search_for_target(this.world,target, this.props.id);

    if (result===null){
      //Target not found
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }

    let entity = this.world.get_instance(result.id);

    result = entity.do_shot(this.props.id);

    if (result===true){
      this.send_chat_msg_to_client(`You hit ${entity.get_name()}!`);
      return;
    } else {
      this.send_chat_msg_to_client(`You miss!`);
      return;
    }
  }

  //Send a message to all the users in the game - and start it.
  start_cmd(){

    let game = this.world.get_instance(this.props.current_game_id);
    
    if (game.props.owner_id!==this.props.id){
      this.send_chat_msg_to_client("Only the user who created the game can start it.");
      return;
    }

    //User can start the game.
    game.props.is_started = true;

    for (const user_id of game.props.entities){
      let user = this.world.get_instance(user_id);
      user.send_chat_msg_to_client("THE GAME HAS STARTED!!");
    }

  }
  
  //Handle Messages
  //--------------------

  //Send text that will be displayed in the Chat.
  send_chat_msg_to_client(content){
    let message = {      
      content: content
    }    
    this.props.socket.emit('Chat Message', message);
  }

  //Send a status msg to the client.
  send_status_msg_to_client(){

    let msg = {      
      content:  {        
        holding:      'Nothing.',        
        head:         'Nothing.',
        torso:        'Nothing.',
        legs:         'Nothing.',
        feet:         'Nothing.',        
        slots:        'Nothing.',
        room_lighting: this.world.get_instance(this.props.container_id).props.lighting,
      }
    }   
        
    for (const part of this.BODY_PARTS){
      if (this.props[part]!==null){        
        let entity=         this.world.get_instance(this.props[part]);
        msg.content[part]=  entity.get_name();
      }
    }
    
    if (this.props.slots.length!==0){
      let html = '';
      for (const id of this.props.slots){
        let entity= this.world.get_instance(id);
        html += `${entity.get_name()} `;
      }
      msg.content.slots = html;
    }
  
    this.props.socket.emit("Status Message", msg);
  }

  send_msg_to_room(content){
    let room=     this.world.get_instance(this.props.container_id);
    let ids_arr=  room.get_all_items();

    for (const id of ids_arr){
      if (id!==this.props.id){ //Don't send to yourself.
        let entity = this.world.get_instance(id);
        entity.get_msg(this.props.id, content);
      }
    }
  }

  send_login_msg_to_client(is_login_successful){
    let message = {      
      content: {is_login_successful: is_login_successful}
    }    
    
    this.props.socket.emit('Login Message', message);
  }

  //Recive a message from another entity.
  get_msg(sender_id, content){
    //Forward the recived message to the client.
    let entity= this.world.get_instance(sender_id);    
    let msg=    `${entity.get_name()} ${content}`;

    this.send_chat_msg_to_client(msg);
  }

  //Save user state to users_db, and remove him from the world.
  disconnect_from_game(){

    this.world.save_user_to_users_db(this.props.id);
    
    let room = this.world.get_instance(this.props.container_id);
    room.remove_entity(this.props.id);

    this.send_chat_msg_to_client(`Disconnected! User details saved. To re-enter, refresh the page. Bye Bye!`);

    this.world.remove_from_world(this.props.id); 
  }

  set_description(text){
    this.props.description = text;
    this.send_chat_msg_to_client(`Description updated.`);
  }
  
}

class Item { 

  constructor(world, props=null){

    this.world=               world;
    this.expiration_counter=  0;

    this.props = {
      type:             "Item",
      id:               Utils.id_generator.get_new_id("item"),
      name:             "Unnamed Item",
      description:      "This is an unnamed Item.",
      subtype:          "Item",
      container_id:     null,      
      key_code:         null,      
      action:           null,
      expiration_limit: null,
      wear_slot:        null,
      is_consumable:    false,
      is_holdable:      false,
      is_gettable:      false,
      game_id:          null
    }
      
    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

  }

  set_container_id(new_container_id){
    this.props.container_id= new_container_id;
  }

  do_action(user_id){

    if (this.props.action!==null){

      switch(this.props.action){
        default:
          console.error(`User.do_action()-> ${this.props.action} not implemented.`);        
      }
    }   
    
  }

  //Returns a message with what a user sees when looking at the Item.
  get_look_string(){
    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>`;    
    return msg;
  }
   
  do_disintegrate(){
    //Remove the item from its container, and the world.

    let container = this.world.get_instance(this.props.container_id);

    if (container instanceof User){
      //Find the location of the item on the user's body.
      let inv_arr = container.get_all_items();
      for (const obj of inv_arr){
        //{id, location}
        if (this.props.id===obj.id){
          container.remove_item(obj.id, obj.location);
          container.get_msg(this.props.id, `${this.props.name} has disintegrated.`);
          break;
        }
      }

    } else if (container instanceof NPC){
      //Find the location of the item on the NPC's body.
      let inv_arr = container.get_all_items_on_body();
      for (const obj of inv_arr){
        //{id, location}
        if (this.props.id===obj.id){
          container.remove_item(obj.id, obj.location);
          container.get_msg(this.props.id, `${this.props.name} has disintegrated.`);
          break;
        }
      }

    } else if (container instanceof Room){
      container.remove_entity(this.props.id);      
      this.send_msg_to_room(`${this.props.name} has disintegrated.`);
    }

    this.world.remove_from_world(this.props.id);
  }

  do_tick(){    
    //Expiration mechanism.

    //If the item is on the floor outside of it's holodeck, enable expiration.
    // let container = this.world.get_instance(this.props.container_id);

    // if ((container instanceof Room) && 
    //     (container.props.holodeck_id!==this.props.holodeck_id)){
    //       //Enable expiration
    //       if (this.props.expiration_limit!==null){
    //         this.expiration_counter += 1;
    //         if (this.expiration_counter===this.props.expiration_limit){
    //           this.do_disintegrate();
    //         }
    //       }
    // }   
  }

  get_msg(sender_id, content){
    //Not implemented yet
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.props.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Get_Drop_Wear_Hold_Consume_Remove_Use_Edit">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  send_msg_to_room(content){
    //Check if the item is in a room (i.e. not on user, etc)
    //and send a message to all entities.
    let container = this.world.get_instance(this.props.container_id);

    if (container instanceof Room){
      let ids_arr=  container.get_all_items();
      
      for (const id of ids_arr){
        if (id!==this.props.id){ //Don't send to yourself.          
          let entity = this.world.get_instance(id);          
          entity.get_msg(this.props.id, content);
        }
      }
    }    
  }

  do_edit(props, user_id){

    for (let [key,value] of Object.entries(props)){
      if (value==="true"){
        value = true;        
      }

      if (value==="false"){
        value = false;
      }

      this.props[key] = value;
    }

    let user = this.world.get_instance(user_id);
    user.send_chat_msg_to_client('Editing succesful.');

  }
  
}

class NPC {
  constructor(world, props=null){

    this.world = world;

    this.props = {
      type:             "NPC",
      id:               Utils.id_generator.get_new_id("npc"),
      container_id:     null,
      name:             "An unnamed NPC",
      description:      "A generic NPC.",
      subtype:          "NPC",
      slots:            [],
      slots_size_limit: 10,
    }
    
    //Load the subtype
    switch(props.subtype){
      case("NPC"):
        break;

      case ("Human"):
        this.props["head"]=     null;
        this.props["torso"]=    null;
        this.props["legs"]=     null;
        this.props["feet"]=     null;
        this.props["holding"]=  null;
        break;
    }

    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }
        
    this.state_machine = null;

    // if (stm_definition!==null){
    //   this.state_machine= new Utils.StateMachine(this.props.id, stm_definition);
    // }
  }

  //Inventory manipulation Methods

  //returns an array of {id, location}
  get_all_items_on_body(){    
    let inv_arr = [];

    if (this.props.subtype==="Human"){
      let body_parts = ["holding", "head", "torso", "legs", "feet"];

      for (const part of body_parts){
        if (this.props[part]!==null){
          inv_arr.push({id: this.props[part], location: part});
        }
      }
    }

    if (this.props.slots!==null){
      for (const id of this.props.slots){
        inv_arr.push({id: id, location: "slots"});
      }
    }    

    return inv_arr;
  }

  //Removes an item from given position.
  remove_item(id, position){
    //Assumes the item exists in the given position

    if (position==="slots"){
      let ix = this.props.slots.indexOf(id);          
      this.props.slots.splice(ix,1);
      return;
    } else if (this.props.subtype==="Human"){
      if (["holding", "head", "torso", "legs", "feet"].includes(position)){
        this.props[position] = null;
        return;
      } 
    }
  }

  //Aux Methods.

  set_container_id(new_container_id){
    this.props.container_id = new_container_id;
  }

  //Returns a string with what a user sees when looking at the NPC.
  get_look_string(){
    
    let msg = `<h1>${this.get_name()}</h1>`;
    msg += `<p>${this.props.description}</p>`;

    if (this.props.subtype==="Human"){
      msg += `<p>On body:  `;

      let text = '';
      let body_parts = ["holding", "head", "torso", "legs", "feet"];
      for (const part of body_parts){
        if (this.props[part]!==null){
          let entity = this.world.get_instance(this.props[part]);
          text += `<p>${part}: ${entity.get_name()}</p>`;
        }        
      }

      if (text===''){
        msg += `Nothing.</p>`;
      } else {
        msg += text + `</p>`;
      }
    }      
    
    return msg;
  }  

  do_tick(){

    // if (this.state_machine!==null){
    //   this.state_machine.do_tick();
    // }    
  }
  
  get_msg(sender_id, msg){

    // if (this.state_machine!==null){
    //   let event = {
    //     type:       null,
    //     content:    null,
    //     sender_id:  sender_id
    //   };
  
    //   if (msg.includes('enters from')){
    //     event.type = "user_enters_room";
    //   } else if (msg.includes('says')){
    //       event.type=     "user speaks";
    //       event.content=  msg;
    //   }
  
    //   this.state_machine.recive_event(event);    
    // }    
  }

  say_cmd(msg){
    this.send_msg_to_room(`says: <span class="say_text">${msg}</span>`);    
  }

  emote_cmd(emote){
    this.send_msg_to_room(emote);    
  }

  //Returns an HTML string for the name of the entity.
  get_name(){    
    let html = 
      `<span `+
      `class="pn_link" `+
      `data-element="pn_link" `+
      `data-type="${this.props.subtype}" `+
      `data-id="${this.props.id}" `+
      `data-name="${this.props.name}" `+
      `data-actions="Look_Edit">`+
      `${this.props.name}`+
      `</span>`;

    return html;
  }

  ///Send a message to all entities in the room.
  send_msg_to_room(content){    
    let room=  this.world.get_instance(this.props.container_id);
    
    let ids_arr=  room.get_all_items();
    //array of objects, of the form: {id: string, location: "room"}

    for (const id of ids_arr){
      if (id!==this.props.id){ //Don't send to yourself.
        let entity = this.world.get_instance(id);
        entity.get_msg(this.props.id, content);
      }
    }    
  }

  do_edit(props, user_id){
    
    for (let [key,value] of Object.entries(props)){
      if (value==="true"){
        value = true;        
      }

      if (value==="false"){
        value = false;
      }

      this.props[key] = value;
    }

    let user = this.world.get_instance(user_id);
    user.send_chat_msg_to_client('Editing succesful.');
  }

}

class Game {
  constructor(world, props=null){

    this.world =          world;
    this.props = {
      owner_id:           null,
      type:               "Game",
      id:                 Utils.id_generator.get_new_id("Game"),
      blue_spawn_room_id: null,
      red_spawn_room_id:  null,
      entities:           [],
      is_started:         false,
    }

    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    this.init_map();
  }

  init_map(){
    //Temporary implementation: change later to dynamic load.
    let props = {
      game_id: this.props.id      
    };

    let blue_spawn_room = new Room(this.world, props);
    this.world.add_to_world(blue_spawn_room);
    this.props.blue_spawn_room_id = blue_spawn_room.props.id;
    blue_spawn_room.props.name = "Blue Team Spawn";
    blue_spawn_room.props.lighting = "blue";

    let mid_room = new Room(this.world, props);
    this.world.add_to_world(mid_room);      
    mid_room.props.lighting = "black"; 

    let red_spawn_room = new Room(this.world, props);
    this.world.add_to_world(red_spawn_room);
    this.props.red_spawn_room_id = red_spawn_room.props.id;
    red_spawn_room.props.name = "Red Team Spawn";
    red_spawn_room.props.lighting = "red";

    //Connect the rooms
    blue_spawn_room.props.exits.north=  {id: mid_room.props.id, code: null};
    mid_room.props.exits.south=          {id: blue_spawn_room.props.id, code: null};
    mid_room.props.exits.north=          {id: red_spawn_room.props.id, code: null};
    red_spawn_room.props.exits.south=   {id: mid_room.props.id, code: null};

    //Add a gun in the mid room.
    props = this.world.entities_db.gun.props;
    let gun = new Item(this.world, props);
    this.world.add_to_world(gun);
    gun.props.container_id = mid_room.props.id;
    mid_room.add_entity(gun.props.id);
  }

  //Join a team according to the team parameter, or if null - in balance.
  //Returns the spawn room id.
  join_game(user_id, team=null){
    this.props.entities.push(user_id);

    let user = this.world.get_instance(user_id);
    
    if (team===null){
      //Find the smaller team and have the user join it.
      let num_of_blue_players = 0;
      let num_of_red_player   = 0;

      for (const id of this.props.entities){
        let entity = this.world.get_instance(id);
        if (entity.props.type==="User"){
          if (entity.props.team==="Blue"){
            num_of_blue_players += 1;            
          } else if (entity.props.team==="Red"){
            num_of_red_player += 1;
          }
        }

        if (num_of_blue_players>=num_of_red_player){
          user.set_team("Red");
          return this.props.red_spawn_room_id;
        } else {
          user.set_team("Blue");
          return this.props.blue_spawn_room_id;    
        }
      }


    } else if (team==="Blue"){
      user.set_team("Blue");
      return this.props.blue_spawn_room_id;
    } else if (team==="Read"){
      user.set_team("Red");
      return this.props.red_spawn_room_id;
    }
  }

  do_tick(){
    //TBD
  }
}

exports.Item=             Item;
exports.User=             User;
exports.Room=             Room;
exports.NPC=              NPC;
exports.Game=             Game;