let chat=                       document.getElementById('Chat');
let disconnect_btn=             document.getElementById('disconnect_btn');
let freeze_btn=                 document.getElementById('freeze_btn');
let parent=                     document.getElementById('Parent');

let perm_link_north=            document.getElementById("perm_link_north");
let perm_link_south=            document.getElementById("perm_link_south");
let perm_link_east=             document.getElementById("perm_link_east");
let perm_link_west=             document.getElementById("perm_link_west");
let perm_link_up=               document.getElementById("perm_link_up");
let perm_link_down=             document.getElementById("perm_link_down");
let perm_links_container=       document.getElementById("perm_links_container");

let modal=              document.getElementById('modal');
let modal_title=        document.getElementById('modal_title');
let modal_content=      document.getElementById('modal_content');
let modal_form=         document.getElementById('modal_form');
let modal_submit_btn=   document.getElementById("modal_submit_btn");
let modal_cancel_btn=   document.getElementById("modal_cancel_btn");

const CLIENT_VERSION=     0.1;

//Mobile Check on init.
// const isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;

//Global Variables
let stop_chat_scroll=         false;
let currently_edited_item_id= null;
let socket;

//Initialize the client.
init();

//When index.html loads, the Login Modal appears. 
//Focus on the username field of the Login Modal.
function init(){
  
  modal_title.innerHTML = "Login";

  modal_content.innerHTML = 
    `<div class="has-text-centered">Welcome to</div>` +
    `<div class="has-text-danger-dark is-size-2 has-text-centered">Text Tag</div>` +
    `<div class="has-text-centered">A textual, mobile-friendly, multiplayer</div>` +
    `<div class="has-text-centered">Lastertag game!</div>` +
    `<div class="has-text-centered">` +
    `(<a class="has-text-primary" href="/help" target="_blank">More Info.</a>)` +
    `</div>` +
    `<div class="is-italic is-size-7 has-text-centered">(Version: 0.1 Alpha)</div>` +
    `<div class="block"></div>` +
    `<div class="has-text-centered">Enter your username:</div>`+
    `<div id="warning_text" class="has-text-warning has-text-centered is-size-6"></div>`;

  modal_form.innerHTML =   
    ` <div class="control">`+
    `   <input `+
    `     id=           "username_input"`+    
    `     autocomplete= "off"`+ 
    `     class=        "input"`+ 
    `     type=         "text"`+ 
    `     placeholder=  "e.g Morpheus, Neo...">`+
    `  </div>`;
  
  modal_cancel_btn.setAttribute('disabled', true);
  modal.classList.add('is-active');

  let username_input = document.getElementById("username_input");
  username_input.focus();
}

//Appears when the 'say' command is clicked.
function load_say_modal(){
  modal_title.innerHTML = "Say";

  modal_form.innerHTML =   
    `<label class="label" id="comm_moda_label"></label>`+
    `<div class="control">`+    
    ` <textarea `+
    `   id=           "comm_modal_input"`+
    `   class=        "textarea"`+
    `   rows=         "3"></textarea>`+    
    `</div>`;
  
  modal.classList.add('is-active');

  let comm_modal_input = document.getElementById("comm_modal_input");
  comm_modal_input.focus();
}

//Appears when the 'tell' command is clicked.
function load_tell_modal(target_id){
  modal_title.innerHTML = "Tell";

  modal_form.innerHTML =   
    `<label class="label">Write You Message Here:</label>`+
    `<div class="control">`+    
    ` <textarea `+
    `   id=           "tell_modal_input"`+
       `dataset-id=   ${target_id}`+
    `   class=        "textarea"`+
    `   rows=         "3"></textarea>`+  
        
    `</div>`;
  
  modal.classList.add('is-active');

  let tell_modal_input = document.getElementById("tell_modal_input");
  tell_modal_input.focus();

}

//Appears when the 'edit' (user) command is clicked.
function load_edit_modal(){

  modal_title.innerHTML = "Edit User";

  modal_form.innerHTML =   
    `<label class="label">Enter a new description for your charecter:</label>`+    
    `<div class="control">`+
    ` <textarea `+
    `   id=           "user_description_input"`+
    `   class=        "textarea"`+
    `   rows=         "3"></textarea>`+
    `</div>`;    
  
  modal.classList.add('is-active');

  let user_description_input = document.getElementById("user_description_input");
  user_description_input.focus();

}

//Appears when the 'join game' command is clicked.
function load_join_game_modal(){
  modal_title.innerHTML = "Join Game";

  modal_form.innerHTML =   
    `<label class="label">Enter the Game ID:</label>`+    
    `<div class="control">`+    
    `   <input `+
    `     id=           "game_id_input"`+    
    `     autocomplete= "off"`+ 
    `     class=        "input"`+ 
    `     type=         "text"`+ 
    `     placeholder=  "e.g. gXXXXXXX">`+
    `  </div>`;   
  
  modal.classList.add('is-active');

  let game_id_input = document.getElementById("game_id_input");
  game_id_input.focus();
}

//Appears when the 'edit game' command is clicked.
function load_edit_game_modal(){
  modal_title.innerHTML = "Edit Game";

  modal_form.innerHTML =   
    `<label class="label">Max Score</label>`+
    `<div class="control">`+
      `<div class="select">`+
        `<select name="max_score">`+
          `<option id="game_current_max_score"></option>`+
          `<option value="5">5</option>`+
          `<option value="10">10</option>`+
          `<option value="10">15</option>`+
        `</select>`+
      `</div>`+
    `</div>`;
  
  modal.classList.add('is-active');  
}

//Create a socket_io instance, and handle incoming messages
//this happens after a Login Reply (success) is recived.
function create_socket(){
  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{

    switch(msg.type){

      case "Login Reply":{ 
        if (msg.content.is_login_successful){
          modal.classList.remove('is-active'); 
          modal_cancel_btn.removeAttribute('disabled');

        } else {
          let warning_text = document.getElementById("warning_text");
          warning_text.innerHTML = 'A User with this name already exists in the game.';
        }
        break;
      }

      case "Chat Message":{
        insert_chat_box("box_server", msg.content);
        break;
      }

      case "Change Background":{
        chat.style.backgroundColor = msg.content.background;
        break;
      }

      case "Exits Message":{
        //{perm_link_north: bol...}
        for (const [key, value] of Object.entries(msg.content)){
          switch(key){
            case "north":{
              if (value===true){
                perm_link_north.classList.remove("perm_links_off");
                perm_link_north.classList.add("perm_links_on")
              } else {
                perm_link_north.classList.remove("perm_links_on");
                perm_link_north.classList.add("perm_links_off")
              }
              break;
            }      

            case "south":{
              if (value===true){
                perm_link_south.classList.remove("perm_links_off");
                perm_link_south.classList.add("perm_links_on")
              } else {
                perm_link_south.classList.remove("perm_links_on");
                perm_link_south.classList.add("perm_links_off")
              }
              break;
            }

            case "east":{
              if (value===true){
                perm_link_east.classList.remove("perm_links_off");
                perm_link_east.classList.add("perm_links_on")
              } else {
                perm_link_east.classList.remove("perm_links_on");
                perm_link_east.classList.add("perm_links_off")
              }
              break;
            }

            case "west":{
              if (value===true){
                perm_link_west.classList.remove("perm_links_off");
                perm_link_west.classList.add("perm_links_on")
              } else {
                perm_link_west.classList.remove("perm_links_on");
                perm_link_west.classList.add("perm_links_off")
              }
              break;
            }

            case "up":{
              if (value===true){
                perm_link_up.classList.remove("perm_links_off");
                perm_link_up.classList.add("perm_links_on")
              } else {
                perm_link_up.classList.remove("perm_links_on");
                perm_link_up.classList.add("perm_links_off")
              }
              break;
            }

            case "down":{
              if (value===true){
                perm_link_down.classList.remove("perm_links_off");
                perm_link_down.classList.add("perm_links_on")
              } else {
                perm_link_down.classList.remove("perm_links_on");
                perm_link_down.classList.add("perm_links_off")
              }
              break;
            }
          }
        }
        break;
      }

    }  
   
  }); 
  



  //Display a Cmd Box with the recived cmds.
  socket_io.on('Cmds Box Message', (msg)=>{
    let list = "";
    for (const item of msg.content){
      list += `<li>${item}</li>`;
    }
    insert_chat_box('cmd_box', `<ul>${list}</ul>`);      
  });

  //Display a Disconnect message to the user.
  socket_io.on('disconnect', ()=>{
    console.log(`Connection Closed By Server.`);
    socket = null;
    // input_form.setAttribute("disabled", true);
  });

  return socket_io;
}

//When the user presses enter on the modal form, 
//Emulate a 'modal_submit_btn' press 
modal_form.addEventListener('submit', (evt)=>{
  
  evt.preventDefault();      
  let event = new Event('click');
  modal_submit_btn.dispatchEvent(event);
  }    
) 

//Handle form submisstions.
modal_submit_btn.addEventListener('click', (evt)=>{

  //Check the content of the modal.
  switch(modal_title.innerHTML){

    case ("Login"):{
      //Create a WS socket, send a login msg.
      //Note: The modal will be closed when a reply msg will arrive.
      socket = create_socket();
      let msg = {
        type: "Login",
        content: {
          username : null
        }
      }

      let username_input = document.getElementById("username_input");

      if (username_input.value===""){
        let warning_text = document.getElementById("warning_text");
        warning_text.innerHTML = "Please enter a Name.";
      }

      msg.content.username = username_input.value;
      socket.emit('Message From Client', msg);
      break;
    }

    case "Say":{
      let msg = {
        type: "Say",
        content: comm_modal_input.value
      }
      socket.emit('Message From Client', msg);
      break;
    }

    case "Edit User":{
      let user_description_input = document.getElementById("user_description_input");
      let msg = {
        type: "Edit User",
        content: {
          description: user_description_input.value
        }
      }      
      socket.emit('Message From Client', msg);      
      break;
    }

    case "Join Game":{
      let game_id_input = document.getElementById("game_id_input");
      let msg = {
        type: "Join Game",
        content: {
          game_id: game_id_input.value
        }
      }
      console.log(msg);
      socket.emit('Message From Client', msg); 
      break;
    }

    case "Edit Game":{
      let formData = new FormData(modal_form);

      let msg = {
        type: "Edit Game",
        content: {
          props: {}
        }        
      }

      for (const [key, value] of formData.entries()){
        msg.content.props[key] = value;
      }

      socket.emit('Message From Client', msg);
      break;
    }

    case "Tell":{
      let msg = {
        type: "Tell",
        content: {
          target_id: evt.target.dataset.id,
          message:   tell_modal_input.value
        }
      }
      socket.emit('Message From Client', msg);
      break;
    }
  }
  
  //When the Submit btn is pressed, we want the modal
  //to do away - except for the Login modal, who will go away
  //only after a successful login message from the server.
  if (modal_title.innerHTML!=="Login"){
    //Clear the modal.
    modal_title.innerHTML = '';
    modal_content.innerHTML = ``;
    modal_form.innerHTML =  '';
    modal.classList.remove('is-active');
  }
  
})

//Close the modal without submission/
//Note: we don't clear the modal, in case the user clicked 'cancel' by mistake.
modal_cancel_btn.addEventListener('click', (evt)=>{
  modal.classList.remove('is-active');
})

//Game Controls
//------------------

//A button that freezes the Chat display, for players to read easier.
freeze_btn.addEventListener('click', ()=>{
  stop_chat_scroll = !stop_chat_scroll;

  if (stop_chat_scroll===true){
    freeze_btn.classList.remove(`has-text-success`);
    freeze_btn.classList.add('has-text-danger');    
  } else {
    freeze_btn.classList.add(`has-text-success`);
    freeze_btn.classList.remove('has-text-danger');    
    
    chat.lastElementChild.scrollIntoView();
  }
})

//Emit a disconnect message, and disable the interface.
disconnect_btn.addEventListener('click', ()=>{

  let msg = {
    type:   "Disconnect",
    content: null
  }

  socket.emit('Message From Client', msg);
  socket = null;  
});

//Handle clicks on the Exits Perm Links.
perm_links_container.addEventListener('click', (evt)=>{
  
  let clicked_exit = null;
  switch(evt.target.id){
    case "perm_link_north":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'North';
      }
      break;

    case "perm_link_south":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'South';
      }
      break;

    case "perm_link_east":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'East';
      }
      break;

    case "perm_link_west":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'West';
      }
      break;

    case "perm_link_up":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'Up';
      }
      break;

    case "perm_link_down":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'Down';
      }
      break;    
  }

  if (clicked_exit!==null){
    let msg = {
      type:    "Command",
      content: {
        id:   null,
        cmd:  clicked_exit
      }      
    }
    socket.emit('Message From Client', msg); 
  }  
  
})

//Chat Interface
//--------------------

//Handle clicks on hyperlinks
chat.addEventListener('click', (evt)=>{
  evt.preventDefault(); //to prevent Chrome Mobile from selecting the text.

  if (evt.target.classList[0]!=="link"){
    //User clicked on a non-link text
    return;
  }

  switch(evt.target.innerHTML){

    case "Say":{
      //Enable the Comm Modal.
      load_say_modal();
      break;
    }

    case "Tell":{
      load_tell_modal(evt.target.dataset.id);
      break;
    }

    case "Edit User":{
      load_edit_modal();
      break;
    }

    case "Join A Game":{
      load_join_game_modal();
      break;
    }

    case "Edit Game":{
      load_edit_game_modal();
      break;
    }

    case "Copy ID":
    case "Copy":{
      navigator.clipboard.writeText(evt.target.dataset.id).then(function() {
        let messsage = `Copied ID ${evt.target.dataset.id} to Clipboard.`;
        insert_chat_box('box_server', messsage);            
      }, function() {
        console.error('Copy ID failed.');
      });
      break;
    }

    case "Look":
    case "Inventory":
    case "Create A New Game":{
      let msg = {
        type:    "Command",
        content: {
          id:   evt.target.dataset.id,
          cmd:  evt.target.innerHTML
        }      
      }
      socket.emit('Message From Client', msg); 
      break;
    }

    default:{
      //Any other link clicked.
      let msg = {
        type: "Name Clicked",
        content: {
          id:     evt.target.dataset.id,
          target: evt.target.innerHTML        
        }
      }
      socket.emit('Message From Client', msg); 
    }
  }

});


// Aux. Functions
//-------------------

//Insert a Chat Box to the Chat interface.
function insert_chat_box(type, content){

  let div = document.createElement("div");
  div.classList.add("box");

  switch(type){
    case "cmd_box":
      div.classList.add("box_cmds");      
      break;

    case "box_server":
      div.classList.add("box_server");
      break;
  }

  div.innerHTML = content;
  chat.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }

  //On desktop, focus on the input 
  // if (!isMobile){
  //   input_form.focus();    
  // }

}