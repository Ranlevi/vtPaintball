const fs=         require('fs');
const Utils= require('./utils');

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
      current_game_id:    null, //Or string 
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
  
  //Remove the given entity from the room.
  //Note: assumes the entity is in the room.
  remove_entity(entity_id){    
    let ix = this.props.entities.indexOf(entity_id);
    this.props.entities.splice(ix,1);        
  }
  
  //Returns an array ids. 
  get_all_items(){    
    return this.props.entities;
  }
    
  //Returns an HTML string for the name of the room.
  get_name(){
    
    let html = `<span class="link" data-id="${this.props.id}">${this.props.name}</span>`;
    return html;
  }

  //Returns a Look Command message (String)
  get_look_string(){   
        
    let msg = `${this.get_name()} `;

    let exits_html = '';    
    for (const [direction, obj] of Object.entries(this.props.exits)){         
      if (obj!==null){
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
      exits_html = `[` + exits_html + ' ]';        
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

  do_tick(){
    //Called every game tick.
    //For future implementations.
  }   

  //Return an array of commands, to be displayed when a user clicks
  //on the room's name.
  get_cmds_arr(clicking_user_id){
    let arr = [
      `<span class="link" data-id="${this.props.id}">Look</span>`,
      `<span class="link" data-id="${this.props.id}">Copy ID</span>`,
    ];

    return arr;
  }

  //Returns an object with the state of exits.
  get_exits_state(){
    let obj = {
      north:  (this.props.exits.north===null? false:true),
      south:  (this.props.exits.south===null? false:true),
      east:   (this.props.exits.east===null? false:true),
      west:   (this.props.exits.west===null? false:true),
      up:     (this.props.exits.up===null? false:true),
      down:   (this.props.exits.down===null? false:true),
    }
    return obj;
  }
  
}

class User {  
  constructor(world, props=null){
    //Create a generic user with default values, then override them with given props.  

    this.BODY_PARTS =     ["holding", "head", "torso", "legs", "feet"];

    this.world=               world;
    this.tick_counter=        0; //Provision for future ideas.    

    this.props = {
      type:               "User",
      id:                 Utils.id_generator.get_new_id("user"),
      name:               "An Unnamed User",
      description:        "A (non-NPC) human.",
      subtype:            "Human",              
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
      defense_multiplier: 0, //Allowed Range: 0-9
      attack_multiplier:  0, //Allowed Range: 0-9
      noise_multiplier:   5, //Allowed Range: 0-9
    }
    
    //Overwrite default props with saved props.         
    for (const [key, value] of Object.entries(props)){
      this.props[key]= value;
    }      
  }  

  set_team(team_color){ //String (Blue / Red)
    this.props.team = team_color;
  }

  //Returns string
  get_id(){
    return this.props.id;
  }

  //Called each game tick.
  //Send a status message to client.   
  do_tick(){        
    this.send_status_msg_to_client();
  }     

  //Remove the user from the room, place in a new room. Send messages.
  spawn_in_room(dest_id){
    //A room exists. Teleport to it.
    let origin_room = this.world.get_instance(this.props.container_id);
    this.send_msg_to_room(`${this.get_name()} disappears.`);
    origin_room.remove_entity(this.props.id);
    
    let dest_room = this.world.get_instance(dest_id);
    dest_room.add_entity(this.props.id);
    this.props.container_id = dest_room.props.id;
    this.send_chat_msg_to_client(`**Poof!**`);
    this.send_exits_msg_to_client();
    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`${this.get_name()} appears in the room.`);
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

    return `<span class="link ${team_class}" data-id="${this.props.id}">${this.props.name}</span>`;
  }

  //A user has clicked this user's name. 
  //Retuns an array of available cmds for the cmds_box.
  get_cmds_arr(clicking_user_id){

    let arr = [];

    if (this.props.current_game_id!==null && this.props.id!==clicking_user_id){
      let game = this.world.get_instance(this.props.current_game_id);

      if (game.props.is_started){
        arr.push(`<span class="link" data-id="${this.props.id}">Shot</span>`);
      }
    }
    
    arr.push(
      `<span class="link" data-id="${this.props.id}">Look</span>`
    );

    //A user can edit and inventory himself.
    if (clicking_user_id===this.props.id){
      arr.push(
        `<span class="link" data-id="${this.props.id}">Edit</span>`,
        `<span class="link" data-id="${this.props.id}">Inventory</span>`
      );
    }

    return arr;
  }

  //Return a String message with what other see when they look at the user.
  get_look_string(){    

    let msg = `<h1>${this.get_name()}</h1>` +
              `<p>${this.props.description}</p>` +
              `<p>Carrying: `;

    let text = '';

    for (const body_part of this.BODY_PARTS){
      if (this.props[body_part]!==null){
        let entity = this.world.get_instance(this.props[body_part]);
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
  //Note: assumes the item exists in the inventory.
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

    //If in an active game, and this is the opposite team's spawn room - can't enter.
    if (this.props.current_game_id!==null){
      //In a game.
      let game = this.world.get_instance(this.props.current_game_id);

      let opposite_team_spawn_room_id = null;
      if (this.props.team==="Blue"){
        opposite_team_spawn_room_id = game.props.red_spawn_room_id;
      } else if (this.props.team==="Red"){
        opposite_team_spawn_room_id = game.props.blue_spawn_room_id;
      }

      if (next_room.props.id===opposite_team_spawn_room_id){
        this.send_chat_msg_to_client(`Can't enter opposite team's spawn room.`);        
        return;
      }
    }

    //Send messages. 
    this.send_chat_msg_to_client(`You travel ${direction}.`);
    this.send_msg_to_room(`travels ${direction}.`);

    //Remove the player from the current room, add it to the next one.    
    current_room.remove_entity(this.props.id);    
    next_room.add_entity(this.props.id);

    this.props.container_id= next_room_obj.id;
    this.send_exits_msg_to_client();
    this.look_cmd();

    //Send a message to the new room.
    this.send_msg_to_room(`enters from ${Utils.get_opposite_direction(direction)}.`);

    //Check if the user made noise when entering the new room.
    //Computation of Noise Chance:
    //Noise muliplier ranges: [0,9]
    
    let noise_threshold = (this.props.noise_multiplier+1)/10;
    //This grants a norm. hit thres. of ~0.1 to 0.9;
    
    let num = Math.random();    
    if (num<=noise_threshold){
      //Made noise
      this.make_sound("footsteps");       
    }    
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

    if (result===null || result.location==="room" || result.location==="game"){
      this.send_chat_msg_to_client(`There's no ${target} around to hold.`);
      return;            
    }

    //Target was found. Check if already held.
    if (result.location==="holding"){
      this.send_chat_msg_to_client(`You're already holding it!`);
      return;
    }

    //Check if already holding something
    if (this.props.holding!==null){
      this.send_chat_msg_to_client(`You're already holding something. Remove it to hold a new item.`);
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

    //Update defense & attack multipliers.
    this.update_thresholds();

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

    //Search for the target
    let result = Utils.search_for_target(this.world, target, this.props.id);    
    
    if (result===null || result.location==="room" || result.location==="game"){
      this.send_chat_msg_to_client(`There's no ${target} around to wear.`);
      return;            
    }

    //Target found
    let entity = this.world.get_instance(result.id);

    //Check if it's in the room and not gettable
    if (result.location==="room" && entity.props.is_gettable===false){
      this.send_chat_msg_to_client(`You can't pick it up.`);
      return;
    }

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

    let room = this.world.get_instance(this.props.container_id);

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

    //Update attack & defence multiplier.
    this.update_thresholds();

    //Send messages.
    this.send_chat_msg_to_client(`You wear it.`);
    this.send_msg_to_room(`wears ${entity.get_name()}`);
  }

  update_thresholds(){
    //Scan the user's items and update all the thresholds.
    //TDOD: update noise threshold as well (need to add noise mulityplier prop to items)

    for (const body_part of this.BODY_PARTS){
      let id = this.props[body_part];

      if (id!==null){
        let entity = this.world.get_instance(id);

        //Update attack & defence multiplier.
        this.props.defense_multiplier += entity.props.defense_rating;
        if (this.props.defense_multiplier>9){
          this.props.defense_multiplier = 9;
        }

        this.props.attack_multiplier += entity.props.attack_rating;
        if (this.props.attack_multiplier>9){
          this.props.attack_multiplier = 9;
        }
      }
    }

    
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
        result.location==="in_room" || 
        result.location==="game"){
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

    //Update the attack & defense multipliers.    
    let entity = this.world.get_instance(result.id);

    this.props.defense_multiplier -= entity.props.defense_rating;
    if (this.props.defense_multiplier<0){
      this.props.defense_multiplier = 0;
    }

    this.props.attack_multiplier -= entity.props.attack_rating;
    if (this.props.attack_multiplier<0){
      this.props.attack_multiplier = 0;
    }

    //Send messages.    
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

    if (result===null || result.location==="room" || result.location==="game"){
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }

    //Target exists
    //Check if it's edible
    let entity = this.world.get_instance(result.id);

    if (!entity.props.is_gettable){
      this.send_chat_msg_to_client(`You can't pick it up.`);
      return;
    }

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
    this.send_msg_to_room(`${this.get_name()} says: ${target}`);
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
    user.get_msg(this.props.id, `${this.get_name()} tells you: ${content}`);
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

    if (this.props.current_game_id!==null){
      this.send_chat_msg_to_client("You're already in a game.");
      return;
    }
    
    let props = {
      owner_id: this.props.id
    }

    let game = new Game(this.world, props);
    this.world.add_to_world(game);

    let obj = game.add_player(this.props.id);

    this.props.spawn_room_id=   obj.spawn_room_id;
    this.props.team=            obj.team;    
    this.props.current_game_id= game.props.id;
    this.props.owned_game_id =  game.props.id;

    //Remove the user from the current room. 
    //Add him to the spwan room of the game.
    //A room exists. Teleport to it.
    this.send_msg_to_room(`${this.get_name()} teleports to a new game.`);

    this.spawn_in_room(this.props.spawn_room_id);

    this.send_chat_msg_to_client(`You have been teleported to the game arena.`);
    this.send_chat_msg_to_client(`You are in team ${this.props.team}.`);
    
    this.game_cmd();
    this.send_chat_msg_to_client(`<span class="link" data-id="${game.props.id}">Copy</span> the game's ID and tell it to the other players. <span class="link">Start</span> the game when you're ready.`);
  }
  
  //Game and User can be edited: send an edit message if the user can edit them.
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
    let entity = this.world.get_instance(result.id);

    let props = null;
    if (entity.props.id===this.props.id){
      //The entity is the user: can edit.
      props = {
        type:         "User",
        description:  this.props.description
      }

    } else if (entity.props.type==="Game"){

      if (entity.props.id===this.props.owned_game_id){
        //The user owns the game.
        props = {
          type:       "Game",
          max_score:  entity.props.max_score
        }
        
      } else {
        //The user does not own the game.
        this.send_chat_msg_to_client(`You can only edit a game you created.`);
        return;      
      }

    } else {
      this.send_chat_msg_to_client(`You can't edit that.`);
      return;      
    }
        
    //Send the Edit Message    

    let msg = {      
      props:  props
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

  //Join a game by ID (only if didn't start already.)
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
    let obj = game.add_player(this.props.id);

    this.props.spawn_room_id=   obj.spawn_room_id;
    this.props.team=            obj.team;    
    this.props.current_game_id= game.props.id;

    this.send_msg_to_room(`${this.get_name()} teleports to a game.`);

    this.spawn_in_room(this.props.spawn_room_id);

    this.send_chat_msg_to_client(`You have been teleported to the game arena.`);
    this.send_chat_msg_to_client(`You are in team ${this.props.team}.`);

    this.look_cmd();
    this.game_cmd();  
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

    //The user can take the shot.

    let result = Utils.search_for_target(this.world,target, this.props.id);

    if (result===null){
      //Target not found
      this.send_chat_msg_to_client(`There's no ${target} around.`);
      return;      
    }

    if (result.id===this.props.id){
      this.send_chat_msg_to_client(`Do you want to shot YOURSELF?!`);
      return; 
    }

    //Target found.

    let entity = this.world.get_instance(result.id);

    if (entity.props.type!=="User"){
      this.send_chat_msg_to_client(`You can't shot that.`);
      return; 
    }

    //Target is a user.
    if (entity.props.team===this.props.team){
      this.send_chat_msg_to_client(`You can't shot your team mates.`);
      return; 
    }

    //Target is a user from the other team.

    //Check the cooldown counter of the held item.
    //Note: we assume the user holds something, else no shot.
    let item = this.world.get_instance(this.props.holding);
    
    if (item.cooldown_counter!==0){
      this.send_chat_msg_to_client(`Weapon Cooldown: wait ${item.cooldown_counter} more seconds.`);
      return; 
    }

    //Weapon can be fired. Reset the cooldown countdown.
    item.cooldown_counter=item.props.cooldown;

    //Make a noise
    this.make_sound('gunshot');
    
    //Computation of Hit Chance:
    //Attack & Defense mulipliers ranges: [0,9]
    let calculated_multiplier = 
      this.props.attack_multiplier - entity.props.defense_multiplier;
      //Range: [-9, 9]

    let normalized_hit_threshold = (calculated_multiplier+10)/20;
    //This grants a norm. hit thres. of ~0.1 to 0.9;
    
    let num = Math.random();    
    if (num<=normalized_hit_threshold){
      //Hit
      this.send_chat_msg_to_client(`You hit ${entity.get_name()}!`);
      entity.send_chat_msg_to_client(`${this.get_name()} hits you!`);

      let game = this.world.get_instance(this.props.current_game_id);
      game.do_hit(this.props.id, entity.props.id);

    } else {
      //Miss
      this.send_chat_msg_to_client('You miss!');
      entity.send_chat_msg_to_client(`${this.get_name()} misses you!`);
    }
   
  }

  //Send a message to all the users in the game - and start it.
  start_cmd(){

    //Check if user is in a game.
    if (this.props.current_game_id===null){
      this.send_chat_msg_to_client("You are not in game yet. Enter 'create' or 'join <some ID>' to play.");
      return;
    }
   
    let game = this.world.get_instance(this.props.current_game_id);
    
    if (game.props.owner_id!==this.props.id){
      this.send_chat_msg_to_client("Only the user who created the game can start it.");
      return;
    }
    
    if (game.props.is_started){
      this.send_chat_msg_to_client("Looks like you already started a game!");
      return;
    }


    //User can start the game.
    game.start_game();
  }

  //Switch the user to the other team and send messages.
  switch_cmd(){

    if (this.props.current_game_id===null){
      this.send_chat_msg_to_client("You are not in game yet. Enter 'create' or 'join <some ID>' to play.");
      return;
    }

    //User is in a game.

    let game = this.world.get_instance(this.props.current_game_id);

    if (this.props.team==="Red"){
      this.props.team=          "Blue";
      this.props.spawn_room_id= game.props.blue_spawn_room_id;
    } else {
      this.props.team=          "Red";
      this.props.spawn_room_id= game.props.red_spawn_room_id;
    }

    this.spawn_in_room(this.props.spawn_room_id);
    game.send_msg_to_all_players(`${this.get_name()} has join Team ${this.props.team}.`);

  }

  //Quit the current game and spawn in lobby.
  quit_cmd(){

    if (this.props.current_game_id===null){
      this.send_chat_msg_to_client("Quit what? You're not playing yet.");
      return;
    }

    //User is in a game.
    let game = this.world.get_instance(this.props.current_game_id);    

    this.send_chat_msg_to_client("You quit the game, and return to the Lobby.");
    this.props.team= null;
    this.props.current_game_id= null;
    this.props.owned_game_id=   null;

    this.spawn_in_room('r0000000');
    game.player_quit(this.props.id);
  }

  //Send the user information about the current game.
  game_cmd(){

    if (this.props.current_game_id===null){
      this.send_chat_msg_to_client("You're not in any game, currently.");
      return;
    }

    let game = this.world.get_instance(this.props.current_game_id);
    this.send_chat_msg_to_client(game.get_look_string());
  }

  //Display the inventory in the client.
  inventory_cmd(){

    let holding=  (this.props.holding===null)? "Nothing": this.world.get_instance(this.props.holding).get_name();
    let head=     (this.props.head===null)?    "Nothing": this.world.get_instance(this.props.head).get_name();
    let torso=    (this.props.torso===null)?   "Nothing": this.world.get_instance(this.props.torso).get_name();
    let legs=     (this.props.legs===null)?    "Nothing": this.world.get_instance(this.props.legs).get_name();  
    let feet=     (this.props.feet===null)?    "Nothing": this.world.get_instance(this.props.feet).get_name();  

    let slots = "Nothing";

    if (this.props.slots.length!==0){
      let html = '';
      for (const id of this.props.slots){
        let entity= this.world.get_instance(id);
        html += `${entity.get_name()} `;
      }
      slots = html;
    }

    let html = 
      `Your Inventory:`+
      `<p>&#9995; ${holding}</p>`+
      `<p>&#x1F3A9 ${head}</p>`+ 
      `<p>&#x1F455 ${torso}</p>`+ 
      `<p>&#x1F456 ${legs}</p>`+ 
      `<p>&#x1F45E ${feet}</p>`+
      `<p>&#x1F9F3 ${slots}</p>`;

    this.send_chat_msg_to_client(html);
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
      room_lighting: this.world.get_instance(this.props.container_id).props.lighting

    }   
        
    // for (const part of this.BODY_PARTS){
    //   if (this.props[part]!==null){        
    //     let entity= this.world.get_instance(this.props[part]);
    //     msg[part]=  entity.get_name();
    //   }
    // }
    
    // if (this.props.slots.length!==0){
    //   let html = '';
    //   for (const id of this.props.slots){
    //     let entity= this.world.get_instance(id);
    //     html += `${entity.get_name()} `;
    //   }
    //   msg.slots = html;
    // }
  
    this.props.socket.emit("Status Message", msg);
  }

  //Send a message to all entities in the room (including non-users)
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

  //Send an array of commands for display in a cmds box.
  send_cmds_arr_to_client(cmds_arr){
    let msg = {
      content: cmds_arr
    }
    this.props.socket.emit('Cmds Box Message', msg);
  }

  //Get the exits from the current room and send them.
  send_exits_msg_to_client(){
    let room = this.world.get_instance(this.props.container_id);
    let msg  = room.get_exits_state();
    this.props.socket.emit('Exits Message', msg);
  }

  //An admin can send a message to all users.
  admin_msg_cmd(msg){

    if (!this.props.is_admin){
      this.send_chat_msg_to_client("Only an Admin can do that.");
      return;
    }

    //The user is an admin
    for (const user of this.world.users.values()){
      user.get_msg(this.props.id, msg);
    }
  } 

  //Recive a message from another entity.
  get_msg(sender_id, content){
    //Forward the recived message to the client.
    this.send_chat_msg_to_client(content);
  }

  //remove user from the world.
  disconnect_from_game(){

    //If in game, quit it.
    if (this.props.current_game_id!==null){
      let game = this.world.get_instance(this.props.current_game_id);
      game.player_quit(this.props.id);
    }
    
    //Remove the user from his room.
    let room = this.world.get_instance(this.props.container_id);
    room.remove_entity(this.props.id);

    this.send_chat_msg_to_client(`Disconnected! To re-enter, refresh the page. Bye Bye!`);

    this.world.remove_from_world(this.props.id); 
  }

  //Updated descriptions, sends a confirmation message.
  set_description(text){
    this.props.description = text;
    this.send_chat_msg_to_client(`Description updated.`);
  }

  make_sound(noise_type){
    //Find the rooms around (two tiers around), check if users are there.
    //send them a noise msg.
    let msg;
    if (noise_type==="gunshot"){
      msg = `You hear GUNSHOT coming from`;
    } else if (noise_type==="footsteps"){
      msg = `You hear a footsteps coming from`;
    }

    let current_room = this.world.get_instance(this.props.container_id);

    for (const [direction, next_room_obj] of Object.entries(current_room.props.exits)){
      //Scan all the room's exits.
      
      if (next_room_obj!==null){
        let next_room = this.world.get_instance(next_room_obj.id);

        //Check if there are users in the room, and msg them.
        for (const id of next_room.props.entities){
          let entity = this.world.get_instance(id);
          if (entity.props.type==="User"){
            let opposite_dir = Utils.get_opposite_direction(direction);
            entity.get_msg(this.props.id, `${msg}: ${opposite_dir}.`);
          }
        }

        //Scan all the other exits of the room, same thing.
        for (const [dir, next_next_room_obj] of Object.entries(next_room.props.exits)){

          //Ignore the direction from which we are coming from in the loop.
          if (dir!==Utils.get_opposite_direction(direction) && next_next_room_obj!==null){

            let next_next_room = this.world.get_instance(next_next_room_obj.id);

            for (const id of next_next_room.props.entities){
              let entity = this.world.get_instance(id);
              if (entity.props.type==="User"){
                let opposite_dir = Utils.get_opposite_direction(dir);
                entity.get_msg(this.props.id, `${msg} ${opposite_dir}`);
              }
            }
          }
        }
      }
    }

  }
  
}

class Item { 

  constructor(world, props=null){

    this.world=               world;
    this.expiration_counter=  0; //For future implementations.
    this.cooldown_counter=    0;

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
      defense_rating:   0, //Allowed Range: 0-9
      attack_rating:    0,  //Allowed Range: 0-9
      current_game_id:  null, //The game the item belongs to.
      cooldown:         0 //In ticks.
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

  //An action performed when a user does a Use cmd on the item.
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
   
  //Find the item's container, and remove it from it.
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

  //Called every game tick.
  do_tick(){    

    //Cooldown
    if (this.cooldown_counter!==0){
      this.cooldown_counter -= 1;
    };

    //TODO: Expiration mechanism.

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

  //Recive a message from an entity.
  get_msg(sender_id, content){
    //Not implemented yet
  }

  get_name(){
    //Returns an HTML string for the name of the entity.
    return `<span class="link" data-id="${this.props.id}">${this.props.name}</span>`;
  }

  //Send a message to all entities in the room.
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

  //Returns an array of cmds for the cmds box, depending on the 
  //clicking user's identity.
  get_cmds_arr(clicking_user_id){
    let arr = [];
    let clicking_user = this.world.get_instance(clicking_user_id);

    if (this.props.container_id===clicking_user.props.container_id ||
        this.props.container_id===clicking_user_id){
      //Both item and user are in the same room, or on user's body.

      //Look
      arr.push(`<span class="link" data-id="${this.props.id}">Look</span>`);

      //Get
      if (this.props.is_gettable){
        arr.push(`<span class="link" data-id="${this.props.id}">Get</span>`);
      }
    }

    //Hold
    if (this.props.is_holdable){
      if (this.props.container_id===clicking_user.props.container_id || 
          //Item is in the same room as user
          (this.props.container_id===clicking_user.props.id && clicking_user.props.holding!==this.props.id)
          //Item is on the user's body but not held
          ){
          arr.push(`<span class="link" data-id="${this.props.id}">Hold</span>`);
        }
    }

    //Wear
    if (this.props.wear_slot!==null){
      //Item can be worn
      if ((this.props.container_id===clicking_user.props.container_id && 
          //Item in the same room as user
          this.props.is_gettable
          //Item can be picked up
        ) || (
          this.props.container_id===clicking_user.props.id && 
          //Item is on the user's body
          clicking_user.props[this.props.wear_slot]!==this.props.id
          //User is not already wearing the item
        )){
          arr.push(`<span class="link" data-id="${this.props.id}">Wear</span>`);
      }
    }

    //Remove
    if (clicking_user.props.holding===this.props.id ||
        //User is holding the item
        clicking_user.props[this.props.wear_slot]===this.props.id
        //User is wearing the item
      ){
        arr.push(`<span class="link" data-id="${this.props.id}">Remove</span>`);
      }   

    //Drop
    if (this.props.container_id===clicking_user.props.id){
      arr.push(`<span class="link" data-id="${this.props.id}">Drop</span>`);
    }

    //Consume
    if (this.props.is_consumable){
      //Item can be consume
      if ((this.props.container_id===clicking_user.props.container_id && 
          //Item in the same room as user
          this.props.is_gettable
          //Item can be picked up
        ) || this.props.container_id===clicking_user.props.id
            //Item is on the user's body
        ){
          arr.push(`<span class="link" data-id="${this.props.id}">Consume</span>`);
      }
    }

    //Use
    if (this.props.action!==null && 
        //Item can be used
        (this.props.container_id===clicking_user.props.container_id || 
         //Item is in the same room as the user
         this.props.container_id===clicking_user.props.id
         //Item is on the user's body
        )
      ){
        arr.push(`<span class="link" data-id="${this.props.id}">Use</span>`);
    }

    return arr;
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
      current_game_id:  null,
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
    return `<span class="link" data-id="${this.props.id}">Look</span>`;
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

  get_cmds_arr(clicking_user_id){
    let arr = [];
    let clicking_user = this.world.get_instance(clicking_user_id);

    if (this.props.container_id===clicking_user.props.container_id){
      //Both item and user are in the same room.
      //Look
      arr.push(
        `<span class="cmd_box_link" data-element="cmd_box_link" ` + 
        `data-action="Look" data-id="${this.props.id}" ` + 
        `data-name="${this.props.name}">Look</span>`      
      );
    }
  }
}

class Game {
  constructor(world, props=null){

    this.world =          world;
    this.props = {      
      type:               "Game",
      id:                 Utils.id_generator.get_new_id("Game"),
      name:               "Text Tag",
      owner_id:           null,
      blue_spawn_room_id: null,
      red_spawn_room_id:  null,
      entities:           [],
      is_started:         false,
      blue_points:        0,
      red_points:         0,
      max_score:          5,
      item_spawn_rooms:   {} // {entity_name: [room_id, room_id]}
    }

    //Overwrite the default props with the saved ones.
    if (props!==null){
      for (const [key, value] of Object.entries(props)){
        this.props[key]= value;
      }
    }

    this.init_map();
  }

  //Returns an HTML string to display in the chat.
  get_name(){
    return `<span class="link" data-id="${this.props.id}">Game</span>`;
  }

  //Retuns an array of cmds for the cmds_box, depending
  //on the clicking user's identity.
  get_cmds_arr(clicking_user_id){

    let arr = [      
      `Game <span class="link" data-id="${this.props.id}">Info</span>`,
      `<span class="link" data-id="${this.props.id}">Copy ID</span>`,
    ];

    //Only the game owner can edit or start the game.
    if (this.props.owner_id===clicking_user_id){
      arr.push(
        `<span class="link" data-id="${this.props.id}">Edit</span>`,
        `<span class="link" data-id="${this.props.id}">Start</span>`,
      );
    }
    
    //Check if user can switch teams.
    if (!this.props.is_started){
      arr.push(
        `<span class="link" data-id="${this.props.id}">Switch Teams</span>`);
    }

    arr.push(
      `<span class="link" data-id="${this.props.id}">Quit To Lobby</span>`);

    return arr;

  }

  init_map(){

    let path = `./pacman_map.json`;
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));    
      
      this.props.blue_spawn_room_id=  parsed_info.blue_spawn_room_id;
      this.props.red_spawn_room_id=   parsed_info.red_spawn_room_id;

      this.props.item_spawn_rooms= parsed_info.item_spawn_rooms;

      //Spawn Rooms
      for (const props of parsed_info.rooms){
        let room = new Room(this.world, props);
        room.props.current_game_id = this.props.id;
        this.props.entities.push(room.props.id);
        this.world.add_to_world(room);    
      }     

    }  else {
      console.error(`classes.game.init_map -> pacman.json does not exist.`);
    }

  }

  //Join a team according to balance.
  //Returns obj: {spawn_room_id: string, team: string};
  add_player(user_id){
    this.props.entities.push(user_id);

    //Find the current number of players in each team.
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
    }

    //Return result
    let obj = {
      spawn_room_id: null, 
      team:          ""
    }

    if (num_of_blue_players>=num_of_red_player){
      //Join Red
      obj.spawn_room_id=  this.props.red_spawn_room_id;
      obj.team=           "Red";
    } else {
      //Join Blue
      obj.spawn_room_id=  this.props.blue_spawn_room_id;
      obj.team=           "Blue";
    }

    return obj;
  }  

  do_tick(){
    //TBD
  }

  //Calculate score. If max score reached - finish the game.
  do_hit(shooter_id, victim_id){

    let shooter = this.world.get_instance(shooter_id);
    let victim  = this.world.get_instance(victim_id);    
    
    if (shooter.props.team==="Blue"){
      this.props.blue_points += 1;        
    } else if (shooter.props.team==="Red"){
      this.props.red_points += 1;
    }

    this.send_msg_to_all_players(`${shooter.get_name()} hits ${victim.get_name()}!`);
    this.send_msg_to_all_players(`BLUE: ${this.props.blue_points} - RED: ${this.props.red_points}`);

    if (this.props.blue_points===this.props.max_score){
      this.send_msg_to_all_players(`BLUE TEAM WINS!`);
      this.end_game();
    } else if (this.props.red_points===this.props.max_score){
      this.send_msg_to_all_players(`RED TEAM WINS!`);
      this.end_game();
    } else {
      //Remove all things worn and in slots.

      for (const body_part of victim.BODY_PARTS){
        if (victim.props[body_part]!==null){
          let item = this.world.get_instance(victim.props[body_part]);
          //Respawn the item in a room.
          let spawn_rooms_arr= this.item_spawn_rooms[item.props.name];
          let spawn_room_id=   spawn_rooms_arr[Math.floor(Math.random()*spawn_rooms_arr.length)];

          item.props.container_id = spawn_room_id;

          let spawn_room = this.world.get_instance(spawn_room_id);
          spawn_room.add_entity();
        }
      }      


      victim.spawn_in_room(victim.props.spawn_room_id);
    }
  }

  //Respawn all players in their spawn rooms.
  //Reset the game and start it.
  start_game(){

    for (const id of this.props.entities){

      let entity = this.world.get_instance(id);

      if (entity.props.type==="User"){
        //Spawn users in their spawn rooms.
        if (entity.props.container_id!==entity.props.spawn_room_id){
          entity.spawn_in_room(entity.props.spawn_room_id);          
        }

        //Remove all items on the user's body.
        for (const body_part of entity.BODY_PARTS){
          if (entity.props[body_part]!==null){
            this.world.remove_from_world(entity.props[body_part]);
            entity.props[body_part]=null;
          }
        }        

      } else if (entity.props.type==="Item"){
        //Remove existing items from the world.
        this.world.remove_from_world(entity.props.id);        
      }
    }
    
    //Spawn items    
    for (const [item_name, spawn_room_arr] of Object.entries(this.props.item_spawn_rooms)){
      //Spawn all the items in all their rooms.
      for (const room_id of spawn_room_arr){        
        let props = this.world.entities_db[item_name].props;
        let item = new Item(this.world, props);
        item.props.container_id=  room_id;       

        let room = this.world.get_instance(room_id);
        room.add_entity(item.props.id);
        
        item.props.current_game_id=  this.props.id;
        this.props.entities.push(item.props.id);
        this.world.add_to_world(item);
      }      
    }    

    this.props.is_started = true;
    this.props.blue_points = 0;
    this.props.red_points = 0;

    this.send_msg_to_all_players('THE GAME HAS STARTED!!');
  }
  
  end_game(){
    this.props.is_started = false;
  }

  send_msg_to_all_players(msg){
    for (const entity_id of this.props.entities){
      let entity = this.world.get_instance(entity_id);
      if (entity.props.type==="User"){
        entity.send_chat_msg_to_client(msg);
      }
    }
  }

  //Remove the user from the game.
  //If no players left in the game - close it.
  player_quit(user_id){

    let ix = this.props.entities.indexOf(user_id);
    if (ix!==-1){
      this.props.entities.splice(ix,1);
    }

    //Check how many players are left in the game.
    let num_of_players = 0;
    for (const id of this.props.entities){
      let entity = this.world.get_instance(id);

      if (entity.props.type==="User"){
        num_of_players += 1;
      }
    }

    if (num_of_players===0){
      //All player have quit the game. Close it.
      this.destroy_game();
    }
  }

  //remove rooms, items and the game itself from the world.
  destroy_game(){
    
    for (const id of this.props.entities){
      this.world.remove_from_world(id);
    }

    //remove the game itself
    this.world.remove_from_world(this.props.id);
  }

  //Update edited parameters.
  do_edit(msg){
    
    if (msg.props.max_score!==undefined){
      this.props.max_score = parseInt(msg.props.max_score, 10);
    }
  }

  //Returns an HTML string for 'Look' or 'Game' commands.
  get_look_string(){
    
    let html =  `<h1>${this.get_name()} Details:</h1>` +
                `<p><b>Type</b>: Red Vs. Blue</p>`+
                `<p>First team to reach the Max Score wins!</p>`+
                `<p><b>Max Score</b> is: ${this.props.max_score}`;
    return html;
  }
}

exports.Item=             Item;
exports.User=             User;
exports.Room=             Room;
exports.NPC=              NPC;
exports.Game=             Game;