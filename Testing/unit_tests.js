let tests_results_div = document.getElementById("tests_results");

let state_obj = {
  test_user_1: {
    name:                   "Test User 1",
    id:                     null,    
    recieved_msgs:          []
  },
  test_user_2: {
    name:                   "Test User 2",
    id:                     null,    
    recieved_msgs:          []
  },
}

const WAIT_TIME = 500; //in ms

function create_socket(user){
  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{    
    state_obj[user].recieved_msgs.push(msg);
  });
  
  return socket_io;
}

function sleep(){
  return new Promise(resolve => setTimeout(resolve, WAIT_TIME));
}

function htmlToTemplate(html){
  let template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function print_test_result(html){
  let div = document.createElement("div");
  div.innerHTML = html;
  tests_results_div.append(div);
}

async function run_test(){

  let socket_test_user1 = create_socket("test_user_1"); 
  let socket_test_user2 = create_socket("test_user_2"); 
  
  //Setup 1:
  //Action: Send a nominal login message. 
  //Expect: successful login.
  const setup_test_user_1 = async function(socket_test_user1){    

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user1.emit('Message From Client', msg);
  
    await sleep();

    let html = "Setup 1: Login Test User 1. --> ";  

    //Check if login was successful  
    let rcvd_msg = state_obj["test_user_1"].recieved_msgs.shift();

    let template = htmlToTemplate(rcvd_msg.content);

    let text = template.childNodes[0].textContent;
    if (text==="Welcome "){
      html += "Pass.";
    } else {
      html += `Fail.`;
    }
    print_test_result(html);   

    //Get the user id
    state_obj.test_user_1.id = template.childNodes[1].dataset.id;
  }
  await setup_test_user_1(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Clear message store
  state_obj.test_user_1.recieved_msgs = []; 

  //Test 1:
  //Action: Try to create another user with the same name.
  //Expect: login error message.
  const test_1 = async function(socket_test_user2){   

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user2.emit('Message From Client', msg);

    await sleep();

    let rcvd_msg = state_obj["test_user_2"].recieved_msgs.shift();
    
    let html = "Test 1: User with the same name. --> ";  
    if (rcvd_msg.content.is_login_successful){
      html += "Fail.";
    } else {
      html += "Pass.";
    }
    print_test_result(html);
  }
  await test_1(socket_test_user2);

  //------------------------------------------------------------
  //------------------------------------------------------------
  
  //Setup 2:
  //Setup 2nd User
  //Do a noraml login for test user 2
  const setup_test_user_2 = async function(socket_test_user2){
    let html = "Setup 2: Login Test User 2. --> ";  

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 2"
      }
    }
    socket_test_user2.emit('Message From Client', msg);
  
    await sleep();

    //Check if login was successful  
    let rcvd_msg = state_obj["test_user_2"].recieved_msgs.shift();

    let template = htmlToTemplate(rcvd_msg.content);

    let text = template.childNodes[0].textContent;
    if (text==="Welcome "){
      html += "Pass.";
    } else {
      html += `Fail.`;
    }
    print_test_result(html);   

    //Get the user id
    state_obj.test_user_2.id = template.childNodes[1].dataset.id;  
  }
  await setup_test_user_2(socket_test_user2);   
  
  //Clear message store
  state_obj.test_user_2.recieved_msgs = []; 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 2
  //Action: Test User 1 Clicking his own name
  //Expect: Cmd Box with User Info, Edit User, Create a New Game, Join a Game.
  const test_2 = async function(socket_test_user1){
    
    let msg = {
      type:         "Name Clicked",
      content: {
        id:   state_obj.test_user_1.id,
        cmd:  state_obj.test_user_1.name
      }
    }
    socket_test_user1.emit('Message From Client', msg);

    await sleep();
    
    //Get the CMD Box message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;       
    }

    let html = "Test 2: Test User 1 Clicking his name. --> ";  
    if (rcvd_cmds==="User InfoEdit UserCreate A New GameJoin A Game"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_2(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 3
  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with default user info.
  const test_3 = async function (socket_test_user1){
    
    let msg = {
      type:    "User Info",
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep(1000);

    let rcvd_msg=   state_obj.test_user_1.recieved_msgs.shift();
    let template=   htmlToTemplate(rcvd_msg.content)    
    let html = "Test 3: Test User 1 Clicked 'User Info'. --> ";
    if (template.children[1].childNodes[0].data==="A (non-NPC) human."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
  }
  await test_3(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 4
  //Action: Test User 1 Clicking Edit User.
  //Expect: Edit Modal User opens, with default user description.
  const test_4 = async function (socket_test_user1){
    
    let msg = {
      type: "Get User Details For Modal"
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the latest message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let html = "Test 4: Test User 1 Clicking Edit User. --> ";

    if (rcvd_msg.content.description==="A (non-NPC) human."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
  }
  await test_4(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 5
  //Action: Test User 1 Changes description and presses Submit.
  //Expect: Recive 'Description Updated' msg.
  const test_5 = async function (socket_test_user1){
    let html = "Test 5: ";

    let msg = {
      type:    "Edit User",
      content: {
        description: "A Test Description."
      }      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the latest message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs[state_obj.test_user_1.recieved_msgs.length-1];    
    if (rcvd_msg==="Description updated."){    
      html += "Passed.";
    } else {
      html += `Failed. Rcvd Msg: ${rcvd_msg}`;
    }

    let div = document.createElement("div");
    div.innerHTML = html
    tests_results_div.append(div);
  }
  // await test_5(socket_test_user1); 

  //Test 6
  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with the new info.
  const test_6 = async function (socket_test_user1){
    let html = "Test 6: ";

    let msg = {
      type:    "Command",
      content: {
        id:   state_obj.test_user_1.id,
        cmd:  "User Info"
      }      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the latest Chat message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs[state_obj.test_user_1.recieved_msgs.length-1];        
    let template= htmlToTemplate(rcvd_msg);
    
    if (template.children[1].innerHTML==="A Test Description."){    
      html += "Passed.";
    } else {
      html += `Failed. Rcvd Msg: ${template.children[1].innerHTML}`;
    }

    let div = document.createElement("div");
    div.innerHTML = html
    tests_results_div.append(div);
  }
  // await test_6(socket_test_user1); 

  //Test 7
  //Action: Test User 1 Clicking Create A New Game.
  //Expect: 
  
  const test_7 = async function (socket_test_user1){
    let html = "Test 7: ";
    let test_passed = true;
    let error_msg = "";

    let msg = {
      type:    "Command",
      content: {
        id:   state_obj.test_user_1.id,
        cmd:  "Create A New Game"
      }      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the Joined Game Chat message. 
    console.log(state_obj.test_user_1.recieved_msgs);
    
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs[7];
    let template= htmlToTemplate(rcvd_msg);

    if (template.childNodes[1].data!==" has joined team Red"){ //ChildNodes includes non-elements
      test_passed = false;
      error_msg = `Received: ${template.childNodes[1].data}`;
    }

    //Get The poof msg.
    rcvd_msg=  state_obj.test_user_1.recieved_msgs[7];
    if (rcvd_msg!=="**Poof!**"){ 
      test_passed = false;
      error_msg = `Received: ${rcvd_msg}`;
    }

    //Get the Spawn Room Message //continue: fix spawn weapons so it will be before start.


    //Get You have been teleported msg


    //Get Game Details msg


    //Get Game details for game edit modal msg


    if (test_passed){    
      html += "Passed.";
    } else {
      html += `Failed. ${error_msg}`;
    }

    let div = document.createElement("div");
    div.innerHTML = html
    tests_results_div.append(div);
  }
  // await test_7(socket_test_user1); 

  //Test 8
  //Action: Test User 1 Clicking Create A New Game.
  //Expect: Server Message with Game Details

}

run_test();