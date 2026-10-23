// Custom blocks use the official Scratch VM extension contract. The isolated
// iframe requests device/model operations from its same-origin parent shell.
import {boardMenus} from '../../../src/programming/board-menus.js';
export function registerDuetExtensions(vm, rpc) {
  let pins = boardMenus();
  let hardwareInstance;
  const decisionBlocks=kind=>[
    {opcode:'setMinimumConfidence',blockType:'command',text:`set ${kind} minimum confidence [PERCENT] %`,arguments:{PERCENT:{type:'number',defaultValue:70}}},
    {opcode:'setMinimumMargin',blockType:'command',text:`set ${kind} minimum lead [PERCENT] %`,arguments:{PERCENT:{type:'number',defaultValue:10}}},
    {opcode:'isAccepted',blockType:'Boolean',text:`${kind} prediction accepted?`}
  ];
  class Hardware {
    constructor(runtime) { this.runtime = runtime; }
    getInfo() {
      return {id: 'duetHardware', name: 'Boards and robots', color1: '#0e9b92', color2: '#087b74', color3: '#065e59', blocks: [
        {opcode: 'whenBoardStarts', blockType: 'hat', text: 'when board starts (upload only)', isEdgeActivated: false},
        {opcode: 'setPinMode', blockType: 'command', text: 'set pin [PIN] mode [MODE]', arguments: {PIN: {type: 'number', menu: 'digitalPin', defaultValue: pins.defaults.output}, MODE: {type: 'string', menu: 'mode', defaultValue: 'OUTPUT'}}},
        {opcode: 'digitalWrite', blockType: 'command', text: 'set digital pin [PIN] to [VALUE]', arguments: {PIN: {type: 'number', menu: 'outputPin', defaultValue: pins.defaults.output}, VALUE: {type: 'number', menu: 'level', defaultValue: 1}}},
        {opcode: 'analogWrite', blockType: 'command', text: 'set PWM pin [PIN] to [VALUE]', arguments: {PIN: {type: 'number', menu: 'pwmPin', defaultValue: pins.defaults.pwm}, VALUE: {type: 'number', defaultValue: 128}}},
        {opcode: 'readAnalog', blockType: 'reporter', text: 'analog pin [PIN]', hideFromPalette: !pins.hasAnalog, arguments: {PIN: {type: 'string', menu: 'analog', defaultValue: pins.defaults.analog}}},
        {opcode: 'readDigital', blockType: 'reporter', text: 'digital pin [PIN]', arguments: {PIN: {type: 'number', menu: 'digitalPin', defaultValue: pins.defaults.digital}}},
        {opcode:'servoWrite',blockType:'command',text:'set servo pin [PIN] angle [ANGLE]',arguments:{PIN:{type:'number',menu:'outputPin',defaultValue:pins.defaults.servo},ANGLE:{type:'number',defaultValue:90}}},
        {opcode:'servoDetach',blockType:'command',text:'release servo pin [PIN]',arguments:{PIN:{type:'number',menu:'outputPin',defaultValue:pins.defaults.servo}}},
        {opcode:'tone',blockType:'command',text:'play pin [PIN] frequency [FREQUENCY] Hz for [DURATION] seconds',arguments:{PIN:{type:'number',menu:'outputPin',defaultValue:pins.defaults.tone},FREQUENCY:{type:'number',defaultValue:440},DURATION:{type:'number',defaultValue:.5}}},
        {opcode:'noTone',blockType:'command',text:'stop tone pin [PIN]',arguments:{PIN:{type:'number',menu:'outputPin',defaultValue:pins.defaults.tone}}},
        {opcode:'map',blockType:'reporter',text:'map [VALUE] from [IN_MIN] [IN_MAX] to [OUT_MIN] [OUT_MAX]',arguments:{VALUE:{type:'number',defaultValue:512},IN_MIN:{type:'number',defaultValue:0},IN_MAX:{type:'number',defaultValue:1023},OUT_MIN:{type:'number',defaultValue:0},OUT_MAX:{type:'number',defaultValue:255}}}

      ], menus: {
        mode: {acceptReporters: true, items: ['INPUT', 'INPUT_PULLUP', 'OUTPUT']},
        level: {acceptReporters: true, items: [{text: 'LOW', value: '0'}, {text: 'HIGH', value: '1'}]},
        // Existing Blockly fields retain their menu provider. Resolve pins at
        // menu-open time so a board change updates choices without resetting
        // the pin values in the student's existing blocks.
        digitalPin: {acceptReporters: true, items: 'getDigitalPins'},
        outputPin: {acceptReporters: true, items: 'getOutputPins'},
        pwmPin: {acceptReporters: true, items: 'getPWMPins'},
        analog: {acceptReporters: true, items: 'getAnalogPins'}
      }};
    }
    getDigitalPins() { return pins.menus.digitalPin.items; }
    getOutputPins() { return pins.menus.outputPin.items; }
    getPWMPins() { return pins.menus.pwmPin.items; }
    getAnalogPins() { return pins.menus.analog.items; }
    whenBoardStarts() { return false; }
    setPinMode(a) { return rpc('hardware', 'setPinMode', [Number(a.PIN), a.MODE]); }
    digitalWrite(a) { return rpc('hardware', 'digitalWrite', [Number(a.PIN), Number(a.VALUE)]); }
    analogWrite(a) { return rpc('hardware', 'analogWrite', [Number(a.PIN), Number(a.VALUE)]); }
    readAnalog(a) { return rpc('hardware', 'readAnalog', [a.PIN]); }
    readDigital(a) { return rpc('hardware', 'readDigital', [Number(a.PIN)]); }
    servoWrite(a){return rpc('hardware','servoWrite',[Number(a.PIN),Number(a.ANGLE)]);}
    servoDetach(a){return rpc('hardware','servoDetach',[Number(a.PIN)]);}
    tone(a){return rpc('hardware','tone',[Number(a.PIN),Number(a.FREQUENCY),Number(a.DURATION)]);}
    noTone(a){return rpc('hardware','noTone',[Number(a.PIN)]);}
    map(a){const v=Number(a.VALUE),lo=Number(a.IN_MIN),hi=Number(a.IN_MAX),outLo=Number(a.OUT_MIN),outHi=Number(a.OUT_MAX);return hi===lo?0:(v-lo)*(outHi-outLo)/(hi-lo)+outLo;}

  }
  class MachineLearning {
    getInfo() {
      return {id: 'duetML', name: 'Image learning', color1: '#9860d9', color2: '#7c43b9', color3: '#623492', blocks: [
        {opcode: 'predict', blockType: 'command', text: 'classify image'},
        {opcode: 'label', blockType: 'reporter', text: 'image label'},
        {opcode: 'confidence', blockType: 'reporter', text: 'image confidence %'},
        {opcode: 'confidenceFor', blockType: 'reporter', text: 'confidence % for [LABEL]', arguments: {LABEL: {type: 'string', defaultValue: 'Class 1'}}},
        {opcode: 'isReady', blockType: 'Boolean', text: 'image model ready?'},
        ...decisionBlocks('image')
      ]};
    }
    predict() { return rpc('ml', 'predict', []); }
    label() { return rpc('ml', 'label', []); }
    confidence() { return rpc('ml', 'confidence', []); }
    confidenceFor(a) { return rpc('ml', 'confidenceFor', [a.LABEL]); }
    isReady() { return rpc('ml', 'isReady', []); }
    setMinimumConfidence(a){return rpc('ml','setMinimumConfidence',[Number(a.PERCENT)]);}
    setMinimumMargin(a){return rpc('ml','setMinimumMargin',[Number(a.PERCENT)]);}
    isAccepted(){return rpc('ml','isAccepted',[]);}
  }
  // Private extension registration/refresh integration is confined to this file
  // and pinned to @scratch/scratch-vm 15.2.0. The official VM has no public API
  // for registering a locally supplied class in a downstream editor.
  const modelExtension=(id,name,kind,color)=>class {
    getInfo(){return {id,name,color1:color,color2:color,color3:color,blocks:[
      {opcode:'predict',blockType:'command',text:`classify ${kind}`},
      {opcode:'label',blockType:'reporter',text:`${kind} label`},
      {opcode:'confidence',blockType:'reporter',text:`${kind} confidence %`},
      {opcode:'confidenceFor',blockType:'reporter',text:`${kind} confidence % for [LABEL]`,arguments:{LABEL:{type:'string',defaultValue:'Class 1'}}},
      {opcode:'isReady',blockType:'Boolean',text:`${kind} model ready?`},
      ...decisionBlocks(kind)
    ]};}
    predict(){return rpc(kind,'predict',[]);}
    label(){return rpc(kind,'label',[]);}
    confidence(){return rpc(kind,'confidence',[]);}
    confidenceFor(a){return rpc(kind,'confidenceFor',[a.LABEL]);}
    isReady(){return rpc(kind,'isReady',[]);}
    setMinimumConfidence(a){return rpc(kind,'setMinimumConfidence',[Number(a.PERCENT)]);}
    setMinimumMargin(a){return rpc(kind,'setMinimumMargin',[Number(a.PERCENT)]);}
    isAccepted(){return rpc(kind,'isAccepted',[]);}
  };
  class TextLearning extends modelExtension('duetText','Text learning','text','#7656ba'){
    getInfo(){const info=super.getInfo();info.blocks[0]={opcode:'predict',blockType:'command',text:'classify text [TEXT]',arguments:{TEXT:{type:'string',defaultValue:'hello friend'}}};return info;}
    predict(a){return rpc('text','predict',[String(a.TEXT)]);}
  }
  class NumbersLearning extends modelExtension('duetNumbers','Numbers learning','numbers','#39769f') {
    getInfo(){return {id:'duetNumbers',name:'Numbers learning',color1:'#39769f',color2:'#2f6284',color3:'#254e69',blocks:[
      {opcode:'setInput',blockType:'command',text:'set number input [INDEX] to [VALUE]',arguments:{INDEX:{type:'number',defaultValue:1},VALUE:{type:'number',defaultValue:0}}},
      {opcode:'predict',blockType:'command',text:'predict from number inputs'},
      {opcode:'inputCount',blockType:'reporter',text:'number input count'},
      {opcode:'value',blockType:'reporter',text:'predicted number value'},
      {opcode:'classIndex',blockType:'reporter',text:'predicted number class index'},
      {opcode:'label',blockType:'reporter',text:'predicted number class label'},
      {opcode:'confidence',blockType:'reporter',text:'number class confidence %'},
      {opcode:'isReady',blockType:'Boolean',text:'numbers model ready?'},
      ...decisionBlocks('numbers')
    ]};}
    setInput(a){return rpc('numbers','setInput',[Number(a.INDEX),Number(a.VALUE)]);}
    inputCount(){return rpc('numbers','inputCount',[]);}
    value(){return rpc('numbers','value',[]);}
    classIndex(){return rpc('numbers','classIndex',[]);}
  }
  class ObjectsLearning {
    getInfo(){return {id:'duetObjects',name:'Object finder · experimental',color1:'#a56043',color2:'#854c35',color3:'#663a29',blocks:[
      {opcode:'detect',blockType:'command',text:'find objects in chosen test image'},
      {opcode:'count',blockType:'reporter',text:'object count'},
      {opcode:'label',blockType:'reporter',text:'object [INDEX] label',arguments:{INDEX:{type:'number',defaultValue:1}}},
      ...['confidence','x','y','width','height'].map(property=>({opcode:property,blockType:'reporter',text:`object [INDEX] ${property} %`,arguments:{INDEX:{type:'number',defaultValue:1}}})),
      {opcode:'isReady',blockType:'Boolean',text:'object finder ready?'},
      {opcode:'inputReady',blockType:'Boolean',text:'object test image chosen?'},
      {opcode:'setMinimumConfidence',blockType:'command',text:'set object minimum confidence [PERCENT] %',arguments:{PERCENT:{type:'number',defaultValue:80}}}
    ]};}
    detect(){return rpc('objects','detect',[]);}
    count(){return rpc('objects','count',[]);}
    label(a){return rpc('objects','label',[Number(a.INDEX)]);}
    confidence(a){return rpc('objects','confidence',[Number(a.INDEX)]);}
    x(a){return rpc('objects','x',[Number(a.INDEX)]);}
    y(a){return rpc('objects','y',[Number(a.INDEX)]);}
    width(a){return rpc('objects','width',[Number(a.INDEX)]);}
    height(a){return rpc('objects','height',[Number(a.INDEX)]);}
    isReady(){return rpc('objects','isReady',[]);}
    inputReady(){return rpc('objects','inputReady',[]);}
    setMinimumConfidence(a){return rpc('objects','setMinimumConfidence',[Number(a.PERCENT)]);}
  }
  class DataLists {
    getInfo(){return {id:'duetData',name:'Data lists',color1:'#94622e',color2:'#794f25',color3:'#603f1e',blocks:[
      {opcode:'fromJSON',blockType:'reporter',text:'data list from JSON [JSON]',arguments:{JSON:{type:'string',defaultValue:'[1, 2, [3, 4]]'}}},
      {opcode:'empty',blockType:'reporter',text:'empty data list'},
      {opcode:'pair',blockType:'reporter',text:'data list [A] [B]',arguments:{A:{type:'string',defaultValue:'apple'},B:{type:'string',defaultValue:'banana'}}},
      {opcode:'item',blockType:'reporter',text:'item [INDEX] of data list [LIST]',arguments:{INDEX:{type:'number',defaultValue:1},LIST:{type:'string',defaultValue:'[10,20]'}}},
      {opcode:'length',blockType:'reporter',text:'length of data list [LIST]',arguments:{LIST:{type:'string',defaultValue:'[10,20]'}}},
      {opcode:'append',blockType:'reporter',text:'data list [LIST] with [ITEM] added',arguments:{LIST:{type:'string',defaultValue:'[10,20]'},ITEM:{type:'string',defaultValue:'30'}}},
      {opcode:'replace',blockType:'reporter',text:'data list [LIST] replacing item [INDEX] with [ITEM]',arguments:{LIST:{type:'string',defaultValue:'[10,20]'},INDEX:{type:'number',defaultValue:1},ITEM:{type:'string',defaultValue:'30'}}},
      {opcode:'remove',blockType:'reporter',text:'data list [LIST] without item [INDEX]',arguments:{LIST:{type:'string',defaultValue:'[10,20]'},INDEX:{type:'number',defaultValue:1}}}
    ]};}
    fromJSON(a){return rpc('data','fromJSON',[String(a.JSON)]);}
    empty(){return rpc('data','empty',[]);}
    pair(a){return rpc('data','pair',[a.A,a.B]);}
    item(a){return rpc('data','item',[String(a.LIST),Number(a.INDEX)]);}
    length(a){return rpc('data','length',[String(a.LIST)]);}
    append(a){return rpc('data','append',[String(a.LIST),a.ITEM]);}
    replace(a){return rpc('data','replace',[String(a.LIST),Number(a.INDEX),a.ITEM]);}
    remove(a){return rpc('data','remove',[String(a.LIST),Number(a.INDEX)]);}
  }
  class Classroom {
    getInfo(){return {id:'duetClassroom',name:'Private classroom',color1:'#477f69',color2:'#386855',color3:'#2e5345',blocks:[
      {opcode:'setVariable',blockType:'command',text:'set classroom [NAME] to [VALUE]',arguments:{NAME:{type:'string',defaultValue:'score'},VALUE:{type:'number',defaultValue:0}}},
      {opcode:'getVariable',blockType:'reporter',text:'classroom [NAME]',arguments:{NAME:{type:'string',defaultValue:'score'}}},
      {opcode:'isConnected',blockType:'Boolean',text:'classroom connected?'}
    ]};}
    setVariable(a){return rpc('classroom','setVariable',[String(a.NAME),Number(a.VALUE)]);}
    getVariable(a){return rpc('classroom','getVariable',[String(a.NAME)]);}
    isConnected(){return rpc('classroom','isConnected',[]);}
  }
  for (const Extension of [Hardware, MachineLearning,modelExtension('duetSound','Sound learning','sound','#3779bf'),modelExtension('duetPose','Pose learning','pose','#bc6b32'),TextLearning,NumbersLearning,Classroom,DataLists,ObjectsLearning]) {
    const instance = new Extension(vm.runtime);
    if (Extension === Hardware) hardwareInstance = instance;
    const id = instance.getInfo().id;
    if (vm.extensionManager.isExtensionLoaded(id)) continue;
    const service = vm.extensionManager._registerInternalExtension(instance);
    vm.extensionManager._loadedExtensions.set(id, service);
  }
  return {async setBoard(boardId) {
    const next = boardMenus(boardId);
    if (pins.boardId !== next.boardId) {
      pins = next;
      // Refresh only our category. Refreshing every extension would call camera
      // extensions' getInfo again and could restart capture as a side effect.
      const service = vm.extensionManager._loadedExtensions.get('duetHardware');
      const info = vm.extensionManager._prepareExtensionInfo(service, hardwareInstance.getInfo());
      vm.runtime._refreshExtensionPrimitives(info);
      vm.runtime.requestToolboxExtensionsUpdate();
    }
    return {boardId: pins.boardId, name: pins.name, hasAnalog: pins.hasAnalog};
  }};
}
