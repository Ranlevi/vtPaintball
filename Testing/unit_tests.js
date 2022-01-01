let tests_results_div = document.getElementById("tests_results");

let state_obj = {
  test_user_1: {
    login_reply_successful: null,
  },
  test_user_2: {
    login_reply_successful: null,
  },
}

function create_socket(user){
  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{

    switch(msg.type){

      case "Login Reply":{ 
        if (msg.content.is_login_successful){
          state_obj[user].login_reply_successful = true;
        } else {
          state_obj[user].login_reply_successful = false;
        }        
        break;
      }

      case "Chat Message":{
        
      }
    }  
   
  }); 
  
  return socket_io;
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run_test(){

  let socket_test_user1 = create_socket("test_user_1"); 
  let socket_test_user2 = create_socket("test_user_2"); 

  let test_user1_id = null;
  let test_user2_id = null;

  //Setup 1:
  //Action: Send a nominal login message. 
  //Expect: successful login.
  const setup_test_user_1 = async function(socket_test_user1){

    let html = "Setup 1: ";  

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user1.emit('Message From Client', msg);
  
    await sleep(1000);
  
    if (state_obj["test_user_1"].login_reply_successful){
      html += "Pass.";
    } else {
      html += "Fail.";
    }
    let div = document.createElement("div");
    div.innerHTML = html;
    tests_results_div.append(div);
  }
  await setup_test_user_1(socket_test_user1);

  //Test 1:
  //Action: Try to create another user with the same name.
  //Expect: login error message.
  const test_1 = async function(socket_test_user2){
    let html = "Test 1: ";  

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user2.emit('Message From Client', msg);

    await sleep(1000);

    if (state_obj["test_user_2"].login_reply_successful){
      html += "Fail.";
    } else {
      html += "Pass.";
    }
    let div = document.createElement("div");
    div.innerHTML = html;
    tests_results_div.append(div);
  }
  await test_1(socket_test_user2);
  
  //Setup 2:
  //Setup 2nd User
  //Do a noraml login for test user 2
  const setup_test_user_2 = async function(socket_test_user2){
    let html = "Setup 2: ";  

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 2"
      }
    }
    socket_test_user2.emit('Message From Client', msg);
  
    await sleep(1000);
  
    if (state_obj["test_user_2"].login_reply_successful){
      html += "Pass.";
    } else {
      html += "Fail.";
    }
    let div = document.createElement("div");
    div.innerHTML = html;
    tests_results_div.append(div);
  }
  await setup_test_user_2(socket_test_user2);  

  //Test 2
  //Action: Test User 1 Clicking his own name
  //Expect: Cmd Box with User Info, Edit User, Create a New Game, Join a Game.
  const test_2 = async function(socket_test_user1){
    let html = "Test 2: ";  

    let msg = {
      type:         "Command",
      content: {
        id:   evt.target.dataset.id,
        cmd:  evt.target.innerHTML
      }
    }
    socket_test_user2.emit('Message From Client', msg);

    await sleep(1000);

    if (state_obj["test_user_2"].login_reply_successful){
      html += "Fail.";
    } else {
      html += "Pass.";
    }
    let div = document.createElement("div");
    div.innerHTML = html;
    tests_results_div.append(div);
  }
  await test_2(socket_test_user1);


  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with default user info.

  //Action: Test User 1 Clicking Edit User.
  //Expect: Edit Modal User opens, with default user description.

  //Action: Test User 1 Changes description and presses Submit.
  //Expect: Recive 'Description Updated' msg.

  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with the new info.

}

run_test();