/*
Utils.js
--------
Various utility functions.
*/

// const World=    require('./world');

//Keeps tracks of current ID, and generates a new one.
//IDs are Strings, generated from randnom lowercase & numerical chars.
//Each entity type has it's own prefix.
//There is a single ID_Generator instance.
class ID_Generator {
  constructor(){
    this.LENGTH=      7; 
    this.characters= 'abcdefghijklmnopqrstuvwxyz0123456789';//lowercase since input is always lowercase.  
  }
  
  //Returns a random char string with a pre-determined prefix.
  //entity_type: String
  //id: String
  get_new_id(entity_type){
    let id = ``;

    switch(entity_type){
      case "room":
        id = 'r';
        break;
      
      case "user":
        id = 'u';
        break;

      case 'item':
        id = 'i';
        break;

      case "npc":
        id = 'n';
        break;

      case "holodeck":
        id = 'h';
        break;
    }

    let charactersLength = this.characters.length;
    for (let i = 0; i < this.LENGTH-1; i++ ) {
      id += this.characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return id;
  }
}
const id_generator_instance = new ID_Generator();

//Returns the opposite from a given direction.
//direction: string
//return: string
function get_opposite_direction(direction){  
  switch(direction){
    case('north'):
      return 'south';
    case('south'):
      return 'north';
    case('east'):
      return 'west';
    case('west'):
      return 'east';
    case('up'):
      return 'down';
    case('down'):
      return 'up';
  }
}

//Deep Copy of a given Object.
//Returns an object.
function deepCopyFunction(inObject){
  let outObject, value, key;

  if (typeof inObject !== "object" || inObject === null) {
    return inObject // Return the value if inObject is not an object
  }

  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {}

  for (key in inObject) {
    value = inObject[key]

    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = deepCopyFunction(value)
  }

  return outObject
}

//State Machine for NPCs.
//A machine as a current state, and a function that transition it 
//from the current state to the next state according to given event.
class StateMachine {
  
  constructor(owner_id, world, stm_definition){

    this.world=         world;
    this.owner_id=      owner_id;
    this.initial_state= stm_definition.initialState;
    this.machine=       this.createMachine(owner_id, stm_definition);    
  }

  //Create an instance of a state machine, according to definition
  
  createMachine(owner_id, stm_definition){
    const machine = {
      current_state: {}, //entitiy_id: current state

      transition(current_state, event){        
        const current_state_definition= stm_definition[current_state];
        const event_defenition=         current_state_definition.transitions[event.type];    
        
        //Check if the event triggered a transition to new state.
        //If the given event does not trigger a transition, return early.
        if (event_defenition===undefined){          
          return;
        }

        let next_state=null;

        switch(event.type){
          case ("user_enters_room"):
            next_state = event_defenition.next_state;
            break;

          case ("user speaks"):
            if (event.content.toLowerCase().includes(event_defenition.parameters.content)){
              next_state = event_defenition.next_state;
            } else {
              return;
            }
            break;

          case ("tick"):
            next_state = event_defenition.next_state;
            break;

          default:
            return;
        }

        const next_state_definition = stm_definition[next_state];
        
        //Perform the actions.
        let owner=  this.world.get_instance(owner_id);
        let entity= this.world.get_instance(event.sender_id);

        for (const action_obj of next_state_definition.actions){

          switch(action_obj["function"]){
            case ("emote"):
              owner.emote_cmd(action_obj.parameters.content);
              break;
              
            case ("say"):
              owner.say_cmd(action_obj.parameters.content);
              break;  
              
            case ("text response hint"):
              let html =  `<p><span class="pn_link" data-element="pn_cmd" `+
                          `data-actions="${action_obj.parameters.content}"`+
                          `>${action_obj.parameters.content}</span></p>`;
              entity.send_chat_msg_to_client(html);
              break;
          }
        }

        //return the next state.
        machine.current_state[event.sender_id] = next_state;
        return machine.current_state[event.sender_id];
      }      
    }
    
    return machine;
  }

  //A current state is tied to a given sender_id, so that
  //the NPC can have multiple interactrions with multiple users.
  //This method get's an event and transitions the STM for the specified user.
  recive_event(event){
    
    if (this.machine.current_state[event.sender_id]===undefined){
      this.machine.current_state[event.sender_id] = this.initial_state;
    }

    let current_state = this.machine.current_state[event.sender_id];
    //Now we have the current state for the specific entity.    
    this.machine.transition(current_state, event);
  }
  
  //A tick is a sort of an event that can trigger the state machine.
  do_tick(){

    for (const id of Object.keys(this.machine.current_state)){   
      
      let event = {
        type:       "tick",
        content:    null,
        sender_id:  id
      }

      this.recive_event(event);
    }

  }
   
}

function search_for_target(world, target, user_id){
  //search order -> body, room, holodeck
  //return {id: str, location: string = body part or null if not on body}
  //or null if not found  
  let user=     world.get_instance(user_id);
  let inv_arr = user.get_all_items();

    //Search for the target.
    for (const obj of inv_arr){      
      let entity = world.get_instance(obj.id);

      if ((entity.props.name.toLowerCase()===target) ||
          (entity.props.subtype.toLowerCase()===target) ||
          (target===entity.props.id)){
        return obj;
      }  
    }

    //Target not on body.
    let room = world.get_instance(user.props.container_id);
    inv_arr = room.get_all_items();    

    for (const id of inv_arr){
      
      let entity = world.get_instance(id);  
      
      if ((entity.props.name.toLowerCase()===target) ||
          (entity.props.subtype.toLowerCase()===target) ||
          (target===entity.props.id)){
        return {id: id, location: "in_room"};
      }
    }
    
    //Check if this is the room itself
    if ((room.props.name.toLowerCase()===target) ||
        (room.props.subtype.toLowerCase()===target) ||
        (target===room.props.id)){
      return {id: room.props.id, location: "room"};
    }

    //target not found
    return null;

}
    
exports.id_generator=           id_generator_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.StateMachine=           StateMachine;
exports.deepCopyFunction=       deepCopyFunction;
exports.search_for_target=      search_for_target;