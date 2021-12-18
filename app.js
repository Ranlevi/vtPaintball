/*
Apps.js
-------
Entry point for the server.
Handles serving the Client to users, user login
and user input.

TODO:
write help page.
add report abuse to user's cmds
*/

const SERVER_VERSION=  0.1;

const fs=         require('fs');
const Classes=    require('./classes');
const World=      require('./world');

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

app.get('/help', (req, res) => {
  res.sendFile(__dirname + '/public/help.html');
});

server.listen(5000, () => {
  console.log('listening on *:5000');
});

//Init the game world, handle users login, process inputs.
class Game_Controller {
  constructor(){

    this.world=                   new World.World();
    this.io=                      new Server(server);
    this.FIRST_ROOM_ID=           "r0000000";
    
    //Handle Socket.IO Connections and messages.
    //-----------------------------------------

    this.io.on('connection', (socket) => {
      console.log('a client connected');

      //Each socket is attached to a single user.
      socket.user_id = null;
    
      //Create a new user or load a new one.
      socket.on('Login Message', (msg)=>{
            
        //Try to find an active user with the same username.        
        let user_id = this.world.get_user_id_by_username(msg.username);
    
        if (user_id!==null){
          //A user with the same name exists in the game.
          let message = {is_login_successful: false};
          socket.emit('Login Message', message);         

        } else {
          //Username is not taken, player can enter.
          socket.user_id = this.create_new_user(socket, msg.username);

          //Report successful login to client
          let message = {is_login_successful: true};
          socket.emit('Login Message', message);         

          let user = this.world.get_instance(socket.user_id);
          user.send_chat_msg_to_client(`Welcome ${user.get_name()}!`);
          user.look_cmd();
        }
      });
    
      //Send text inputs for processing.
      socket.on('User Input Message', (msg)=>{            
        if (socket.user_id!==null){
          this.process_user_input(msg.content, socket.user_id);        
        }        
      });
    
      //Set the user's edited fields.
      socket.on('User Edit Message', (msg)=>{
        let user = this.world.get_instance(socket.user_id);
        user.set_description(msg.description);
      });

      socket.on('Game Edit Message', (msg)=>{        
        //Note: we assume the user is in a game and owns it, else he
        //would be able to edit it.
        let user = this.world.get_instance(socket.user_id);
        let game = this.world.get_instance(user.props.current_game_id);
        
        game.do_edit(msg);
        user.send_chat_msg_to_client('Done.');
      })

      //User clicked a name link
      //We return a list of commands, to be displayed as a Cmds Box.
      socket.on('Name Link Clicked', (msg)=>{        
        let user=   this.world.get_instance(socket.user_id);
        let entity= this.world.get_instance(msg.id);

        let cmds_list= entity.get_cmds_arr(socket.user_id);
        user.send_cmds_arr_to_client(cmds_list); 
      });     
    
      //Remove the user from the world.
      socket.on('Disconnect Message', () => {
        let user = this.world.get_instance(socket.user_id);
        user.disconnect_from_game();
      });
    });

    this.init_game();
  }

  //Runs when the server is created. 
  //Loads databases, starts the game loop.
  init_game(){     
    this.load_entities_db();
    this.load_world();        
    this.game_loop();      
  }
  
  //Load all rooms and entities (except users) from the database.
  load_world(){    

    let path = `./generic_world.json`;
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));           

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
      console.error(`app.load_world -> generic_world.json does not exist.`);
    }
    
  }
  
  //Loads the entities.json file into world.entities_db
  load_entities_db(){
    if (fs.existsSync(`./entities.json`)){      
      this.world.entities_db = JSON.parse(fs.readFileSync("./entities.json"));      
    } else {
      console.error(`app.load_entities -> entities.js does not exist.`);
    }
  }
  
  //Timer for game loop.
  //Note: the loop technique allows for a minimum fixed length between
  //loop iterations, regardless of content of the loop.
  game_loop(){   
    
    let timer_id = setTimeout(
      function update(){
      
        this.run_simulation_tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  //Iterate on all entities, and process their tick actions
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
        user.create_cmd();
        break;      

      case "edit":
      case "ed":
        user.edit_cmd(target);
        break;

      case "use":
        user.use_cmd(target);
        break;

      case "join":
      case "j":
        user.join_cmd(target);
        break;

      case "shot":
      case "sh":
        user.shot_cmd(target);
        break;

      case "start":
      case "st":
        user.start_cmd();
        break;

      case "switch":
        user.switch_cmd();
        break;

      case "quit":
        user.quit_cmd();
        break;

      case "adminsay":
        user.admin_msg_cmd(target);
        break;

      case "game":
      case "g":
        user.game_cmd();
        break;

      default:
        user.send_chat_msg_to_client(`Unknown command: ${text}`);        
    }  
  }  

  //Create a new user, spawned at spawn room, and associate the socket with it.
  //Returns the ID of the created user (String)
  create_new_user(socket, username){
    
    let user_props = {
      socket:       socket,
      name:         username,      
      container_id: this.FIRST_ROOM_ID
    }    
    
    let user= new Classes.User(this.world, user_props);    
    this.world.add_to_world(user);

    let lobby = this.world.get_instance(this.FIRST_ROOM_ID);
    lobby.add_entity(user.get_id());

    return user.get_id();
  }  
}

//Start Game Server
new Game_Controller();