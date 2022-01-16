const CLIENT_VERSION=     0.1;

//Mobile Check on init.
// const isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;

let modal=            document.getElementById("modal");
let modal_title=      document.getElementById("modal_title");
let modal_content=    document.getElementById("modal_content");
let modal_form=       document.getElementById("modal_form");
let modal_cancel_btn= document.getElementById("modal_cancel_btn");
let modal_submit_btn= document.getElementById("modal_submit_btn");
let main_window=      document.getElementById("main_window");


//Global Variables
let stop_chat_scroll=         false;
let sound_mute=               false;
let music_mute=               false;
let is_music_playing=         false;
let socket;
let game_music_obj=           new Audio('./assets/UpliftingMagicalTranceMain.mp3');

//Initialize the client.
init();

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

//Create a socket_io instance, and handle incoming messages
//this happens after a Login Reply (success) is recived.
function create_socket(){

  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{      
    
    switch(msg.type){      

      case "Login Reply":{ 
        if (msg.content.is_login_successful){
          //Clear the modal.
          modal_title.innerHTML   = '';
          modal_content.innerHTML = '';
          modal_form.innerHTML    = '';    
          modal.classList.remove('is-active'); 
          modal_cancel_btn.removeAttribute('disabled');

        } else {
          let warning_text=       document.getElementById("warning_text");
          warning_text.innerHTML= 'A User with this name already exists in the game.';
        }
        break;
      }

      case "Chat":{
        if (msg.content.is_flashing){
          insert_chat_box("flashing_box", msg.content.html);
        } else {
          insert_chat_box("box", msg.content.html);
        }        
        break;
      }
    
    }  
   
  }); 
  
  return socket_io;
}

//Handle form submisstions.
modal_submit_btn.addEventListener('click', ()=>{  

  //Check the content of the modal.
  switch(modal_title.innerHTML){

    case ("Login"):{
      //Create a WS socket, send a login msg.
      //Note: The modal will be closed when a reply msg will arrive.
      socket = create_socket();

      let msg = {
        type:       "Login",
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

//When the user presses enter on the modal form, 
//Emulate a 'modal_submit_btn' press 
modal_form.addEventListener('submit', (evt)=>{  
  evt.preventDefault();        
  modal_submit_btn.dispatchEvent(new Event('click'));
  }    
) 

//Close the modal without submission/
//Note: we don't clear the modal, in case the user clicked 'cancel' by mistake.
modal_cancel_btn.addEventListener('click', ()=>{  
  modal.classList.remove('is-active');
})


// Aux. Functions
//-------------------

//Insert a Chat Box to the Chat interface.
function insert_chat_box(type, content){

  let div = document.createElement("div");
  div.classList.add("box");

  switch(type){
    
    case "box":
      div.classList.add("box_server");
      break;

    case "flashing_box":
      div.classList.add("box_server");
      div.classList.add("flashing");
      break;
  }

  div.innerHTML = content;
  main_window.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }

  //On desktop, focus on the input 
  // if (!isMobile){
  //   input_form.focus();    
  // }

}
