/*
Apps.js
-------
teleport home, random.
A way to delete created items. (from the edit modal)
Entry point for the server.
Handles serving the Client to users, user login
and user input.

TODO:
do we need expiration?
Add edit to the user cmds.
fix send_msg_to_room to not have the entity name as default.
add report abuse to user's cmds
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
*/

const SERVER_VERSION=  0.1;

const fs=         require('fs');
const Classes=    require('./classes');
const World=      require('./world');
const Utils=      require('./utils');

const express=    require('express');
const app=        express();
const http =      require('http');
const server =    http.createServer(app);
const { Server }= require("socket.io");

 
//Serving the client to the browser
//--------------------------------

app.use(express.static('public'));

app.get('/', (req, res) => {  
  res.sendFile(__dirname + '/index.html');
});

server.listen(5000, () => {
  console.log('listening on *:5000');
});

//Game Parameters
const ENABLE_USER_SAVE=       true;
const LOAD_GENERIC_WORLD=     true;
const LOAD_GENERIC_USERS_DB=  true;  
const USER_SAVE_INTERVAL=     10;
const WORLD_SAVE_INTERVAL=    10;
const HOLODECK_SIDE=          5;


//Init the game world, handle users login, process inputs.
class Game_Controller {
  constructor(){

    this.world=                   new World.World();
    this.io=                      new Server(server);
    this.FIRST_ROOM_ID=           "r0000000";
    this.last_room_in_corridor =  null;
    
    //Handle Socket.IO Connections and messages.
    //-----------------------------------------

    this.io.on('connection', (socket) => {
      console.log('a client connected');
    
      //Create a new user or load a new one.
      socket.on('Login Message', (msg)=>{
            
        //Try to find an active user with the same username.        
        let user_id = this.world.get_user_id_by_username(msg.content.username); //ADD VAR???
    
        if (user_id===null){
          //This is not an active player
          //Check if it is a preveiouly created player.
          let data = this.world.users_db.users[msg.content.username];          
          
          if (data===undefined){
            //This is a new player
            socket.user_id = this.create_new_user(
                                        socket, 
                                        msg.content.username, 
                                        msg.content.password);            
    
          } else {
            //This is a previously created player.
            //Check if the password is correct:
            if (data.password===msg.content.password){
              //Password is correct
              socket.user_id = this.load_existing_user(
                                        socket, 
                                        msg.content.username);
            } else {
              //Password incorrect
              let message = {            
                content: {is_login_successful: false}
              }    
              socket.emit('Login Message', message);          
            }        
          }
    
        } else {
          //This is an active player.
          //Check password
          let user = this.world.get_instance(user_id);
    
          if (user.password===msg.content.password){
            //Password correct, change socket
            socket.user_id = user_id;
            user.props.socket = socket;
            user.send_chat_msg_to_client('Reconnected.');
    
          } else {
            //Password incorrect
            let message = {          
              content: {is_login_successful: false}
            }    
            socket.emit('Login Message', message);
          }
        }
      });
    
      //Send text inputs for processing.
      socket.on('User Input Message', (msg)=>{        
        this.process_user_input(msg.content, socket.user_id);        
      });
    
      //Set the user's description field.
      socket.on('Settings Message', (msg)=>{
        let user = this.world.get_instance(socket.user_id);
        user.set_description(msg.content.description);
      });
    
      //Set the user's description field.
      socket.on('Edit Message', (msg)=>{
        let entity = this.world.get_instance(msg.id);
        entity.do_edit(msg.props, socket.user_id);    
      });
    
      socket.on('Disconnect Message', () => {
        //This is an unxpected close of connection (user didn't press 'close')
        //find the user with the socket and remove from the world.
        
        for (const user of this.world.users.values()){
          
          if (user.props.id===socket.user_id){ 
            user.disconnect_from_game();
          }
        }
      });
    });

    this.user_save_counter=   USER_SAVE_INTERVAL;
    this.world_save_counter=  WORLD_SAVE_INTERVAL;

    this.init_game();
  }

  //Runs when the server is created. 
  //Loads databases, starts the game loop.
  init_game(){ 
    
    this.load_users_db();
    this.load_entities_db();
    this.load_world(LOAD_GENERIC_WORLD);
        
    this.game_loop();      
  }

  //Load the database of existing users.
  load_users_db(){   

    let path;
    if (LOAD_GENERIC_USERS_DB){
      path = `./generic_users_db.json`;
    } else {
      path = "./users_db.json";
    }

    if (fs.existsSync(path)){

      let text = fs.readFileSync(path);

      if (text.toString() !== ''){
        let data = JSON.parse(text);

        for (const [username, user_obj] of Object.entries(data.users)){
          //user_obj: {id: user.id, props: user.props};
          this.world.users_db.users[username] = user_obj;
        }
  
        for (const [id, obj] of Object.entries(data.items)){
          this.world.users_db.items[id] = obj;
        }        
      }
    }
  }
  
  //Load all rooms and entities (except users) from the database.
  load_world(is_generic_world=false){    

    let path;
    if (is_generic_world){
      path = `./generic_world.json`;
    } else {
      path = "./world_save.json";
    }

    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));
      
      this.last_room_in_corridor = parsed_info.last_room_in_corridor;

      for (const entity_props of parsed_info.entities){
        switch(entity_props.type){
          case "Room":
            let room = new Classes.Room(this.world, entity_props);
            this.world.add_to_world(room);            
            break;

          case "Item":
            let item = new Classes.Item(this.world, entity_props);
            this.world.add_to_world(item);
            break;

          case "NPC":
            let npc = new Classes.NPC(this.world, entity_props);
            this.world.add_to_world(npc);

          default:
            console.error(`app.js -> load_world(): unknown type: ${entity_props.type}`);
        }
      }      
      
    }  else {
      console.error(`app.load_world -> world_save.json does not exist.`);
    }
    
  }
  
  load_entities_db(){
    if (fs.existsSync(`./entities.json`)){      
      this.world.entities_db = JSON.parse(fs.readFileSync("./entities.json"));      
    } else {
      console.error(`app.load_entities -> entities.js does not exist.`);
    }

  }

  save_world(){

    let save_obj = {
      last_room_in_corridor:  this.last_room_in_corridor,
      entities:               []
    };

    for (const instance of this.world.world.values()){

      let entity_obj = Utils.deepCopyFunction(instance.props);

      if (instance.props.type==="Room"){
        //Remove the users from the Room's saved entities.
        entity_obj.entities = [];

        for (const id of instance.props.entities){
          let entity = this.world.get_instance(id);
          if (entity.props.type!=="User"){
            entity_obj.entities.push(id);
          }
        }
      }

      save_obj.entities.push(entity_obj);
    }
    
    fs.writeFile(`./world_save.json`, 
                  JSON.stringify(save_obj),  
                  function(err){if (err) console.log(err);}
                );
    console.log('world saved.');    
  }

  //Called periodicaly
  //Save all the users and the entities they carry on them.    
  save_users_to_file(){    

    if (!ENABLE_USER_SAVE) return;

    //Update the users_db object with new values
    for (const user_id of this.world.users.keys()){
      this.world.save_user_to_users_db(user_id);      
    }

    fs.writeFile(`./users_db.json`, 
                  JSON.stringify(this.world.users_db),  
                  function(err){if (err) console.log(err);}
                );
    console.log('Users saved.');    
  }  
  
  //Timer for game loop.
  //Note: the loop technique allows for a minimum fixed length between
  //loop iterations, regardless of content of the loop.
  game_loop(){   
    
    let timer_id = setTimeout(
      function update(){

        //Save Counters
        this.user_save_counter -= 1;
        if (this.user_save_counter===0){
          this.user_save_counter = USER_SAVE_INTERVAL;
          this.save_users_to_file();
        }

        this.world_save_counter -= 1;
        if (this.world_save_counter===0){
          this.world_save_counter = WORLD_SAVE_INTERVAL;
          this.save_world();
        }

        this.run_simulation_tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  //Iterate on all entities, and process their tick actions (or handle a fight)
  run_simulation_tick(){    

    this.world.world.forEach((entity) => {
      entity.do_tick();
    });

    this.world.users.forEach((user)=> {
      user.do_tick();      
    });
  }
    
  //Takes the text recived via the webSockets interface,
  //and the user_id who sent it. Parses the text, and calls the required 
  //command method from Use.
  process_user_input(text, user_id){    
    
    if (text==='') return;//Ignore empty messages.
  
    //All input text is changed to lower case, and split by
    //white spaces.
    let normalized_text=  text.trim().toLowerCase();  
    let re=               /\s+/g; //search for all white spaces.
    let input_arr =       normalized_text.split(re);
    
    //Assume the first word is always a Command, and everything that
    //comes after that is a target.
    let cmd = input_arr[0];
    let target;
    if (input_arr.length===1){
      target= null;
    } else {
      target = input_arr.slice(1).join(' ');
    } 
    
    let user = this.world.get_instance(user_id);    
    
    switch(cmd){
      case 'look':
      case 'l':
        user.look_cmd(target);
        break;

      case 'north':
      case 'n':
        user.move_cmd('north');
        break;

      case 'south':
      case 's':
        user.move_cmd('south');
        break;

      case 'east':
      case 'e':
        user.move_cmd('east');
        break;
      
      case 'west':
      case 'w':
        user.move_cmd('west');
        break;

      case 'up':
      case 'u':
        user.move_cmd('up');
        break;

      case 'down':
      case 'd':
        user.move_cmd('down');
        break;

      case 'get':
      case 'g':
        user.get_cmd(target);
        break;

      case 'drop':
      case 'dr':
        user.drop_cmd(target);
        break;

      case 'hold':
      case 'h':
        user.hold_cmd(target);
        break;

      case 'wear':
      case 'we':
        user.wear_cmd(target);
        break;

      case "remove":
      case "r":
        user.remove_cmd(target);
        break;      

      case "consume":
      case "c":      
        user.consume_cmd(target);      
        break;

      case "say":
      case "sa":
        user.say_cmd(target);
        break;

      case "emote":
      case "em":
        user.emote_cmd(target);
        break;

      case "tell":
      case "'":
      case "t":
        //Assumes the 2nd word is the username to send a message to.
        let username = input_arr[1];
        let content = input_arr.slice(2).join(' ');
        user.tell_cmd(username, content);
        break;

      case "create":
      case "cr":
        user.create_cmd(target);
        break;

      case "teleport":
      case "te":
        user.teleport_cmd(target);
        break;

      case "edit":
      case "ed":
        user.edit_cmd(target);
        break;

      case "use":
        user.use_cmd(target);
        break;

      default:
        user.send_chat_msg_to_client(`Unknown command: ${text}`);        
    }  
  }  

  //Create a new user, spawned at spawn room, and associate the socket with it.
  //Returns the ID of the created user (String)
  create_new_user(socket, username, password){
    
    let user_props = {
      socket:       socket,
      name:         username,
      password:     password,
      container_id: null
    }

    //We create a new room in the corridor, and spawn the user infront of it.
    let room_props = {
      name:         "The Infinite Corridor",
      description:  "It's an infinite corridor.",      
    }

    let corridor_room = new Classes.Room(this.world, room_props);

    //Connect the new room to the current last room of the corrider.
    corridor_room.props.exits.south = {id: this.last_room_in_corridor, code: null};

    let last_room_in_corridor = this.world.get_instance(this.last_room_in_corridor);
    last_room_in_corridor.props.exits.north = {id: corridor_room.props.id, code: null};

    this.world.add_to_world(corridor_room);

    let user= new Classes.User(this.world, user_props);
    user.set_container_id(corridor_room.props.id);    
    this.world.add_to_world(user);
    corridor_room.add_entity(user.get_id());

    let holodeck_entry_room_id = this.create_holodeck(user.props.id, corridor_room.props.id);
    
    //Create an exit from the corridor to the holodek.
    corridor_room.props.exits.east = {id: holodeck_entry_room_id, code: null};

    //Create an exit from the holodeck to the corridor.
    let holodeck_entry_room = this.world.get_instance(holodeck_entry_room_id);
    holodeck_entry_room.props.exits.west = {id: corridor_room.props.id, code: null};
    
    //update the last corridor:
    this.last_room_in_corridor = corridor_room.props.id;

    user.send_login_msg_to_client(true);

    //Send a welcome message, and a Status message to init the health bar.
    //Than perform a Look command on the room.
    user.send_chat_msg_to_client(`Welcome ${user.get_name()}!`);
    user.look_cmd();

    return user.get_id();
  }

  //Load the user from the registered users database, and associate
  //the socket with it.
  //Return the ID of the retrived user (String)
  load_existing_user(socket, username){
    
    console.log('Loading existing user');

    //Spawn the user, set the recived socket.
    let props=  this.world.users_db.users[username];
    let user=   new Classes.User(this.world, props); 
    user.set_container_id(user.props.spawn_room_id);
    this.world.add_to_world(user);   
    user.set_socket(socket);

    //Spawn the player infront of his holodeck.
    let corridor_room = this.world.get_instance(user.props.spawn_room_id);
    corridor_room.add_entity(user.get_id());    

    //Spwan the items held by the user 
    //Note: the item's container_id is already set to the user.      
    for (const part of user.BODY_PARTS){
      if (user.props[part]!==null){
        //Assume the entity is always an Item
        let props = this.world.users_db.items[user.props[part].props];
        let item = new Classes.Item(this.world, props);
        this.world.add_to_world(item);
      }
    }  
    
    //Spawn items in slots.
    for (const id of user.props.slots){
      let props = this.world.users_db.items[id].props;
      let item = new Classes.Item(this.world, props);
      this.world.add_to_world(item);
    }

    //Send a welcome message, and a status message to init the health bar.
    //Then do a Look command on the room.
    user.send_login_msg_to_client(true);
    user.send_chat_msg_to_client(`Welcome back, ${user.get_name()}.`);
    user.send_status_msg_to_client();
    
    user.look_cmd();
    return user.get_id();
  }

  create_holodeck(owner_id, corridor_room_id){
    //returns holodeck_entry_room_id
    //create rooms, connect to the corridor room.

    let holodeck = [];
    for (let p=0;p<HOLODECK_SIDE;p++){
      let plane = [];
      for (let r=0;r<HOLODECK_SIDE;r++){  
        let row = [];
        for (let i=0;i<HOLODECK_SIDE;i++){
          let props = {
            owner_id: owner_id
          }
          let room = new Classes.Room(this.world, props);
          this.world.add_to_world(room);
          row.push(room);
        }  
        plane.push(row);
      }
      holodeck.push(plane);
    }

    //We now have a 3D array of room.
    //Need to connect them to one another.
    for (let p=0;p<HOLODECK_SIDE;p++){      
      for (let r=0;r<HOLODECK_SIDE;r++){  
        for (let i=0;i<HOLODECK_SIDE;i++){
          let room = holodeck[p][r][i];
          
          if (i===0){
            room.props.exits.south = {id: holodeck[p][r][1], code: null};
          } else if (i===HOLODECK_SIDE-1){
            room.props.exits.north = {id: holodeck[p][r][HOLODECK_SIDE-2], code: null};
          } else {
            room.props.exits.south = {id: holodeck[p][r][i+1], code: null};
            room.props.exits.north = {id: holodeck[p][r][i-1], code: null};
          }

          if (r===0){
            room.props.exits.east = {id: holodeck[p][1][i], code: null};
          } else if (r===HOLODECK_SIDE-1){
            room.props.exits.west = {id: holodeck[p][HOLODECK_SIDE-2][i], code: null};
          } else {
            room.props.exits.east = {id: holodeck[p][r+1][i], code: null};
            room.props.exits.west = {id: holodeck[p][r-1][i], code: null};
          }

          if (p===0){
            room.props.exits.up = {id: holodeck[1][r][i], code: null};
          } else if (p===HOLODECK_SIDE-1){
            room.props.exits.down= {id: holodeck[HOLODECK_SIDE-2][r][i], code: null};
          } else {
            room.props.exits.up = {id: holodeck[p+1][r][i], code: null};
            room.props.exits.down= {id: holodeck[p-1][r][i], code: null};
          }          
        }


      }
    }

    //Connect the entry room to the corrider
    let center = Math.floor(HOLODECK_SIDE/2);
    let entry_room = holodeck[center][0][center];
    entry_room.props.exits.west = {id: corridor_room_id, code: null};

    let corridor_room = this.world.get_instance(corridor_room_id);
    corridor_room.props.exits.east = {id: entry_room.props.id, code: null};

    return entry_room.props.id;
  }

}

//Start Game Server
new Game_Controller();