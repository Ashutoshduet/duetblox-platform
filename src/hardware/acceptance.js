import {requireBoard} from './boards.js';

// Student observations are separate from the software's physicalVerified flag.
// Nothing here connects, compiles, flashes or certifies a device.
export function boardAcceptanceSteps(boardId, mode) {
  const board=requireBoard(boardId);
  if (!['live','standalone'].includes(mode)) throw new Error('Choose live or standalone testing.');
  const shared=[
    {id:'identity',title:'Identify the exact board',instruction:`Match ${board.name} and its ${board.voltage} V GPIO profile. Use the board documentation to check power, ground, pin names and component wiring before connecting.`},
    {id:'output',title:'Observe a real output',instruction:'Run a small LED program on the physical board. Record the pin, resistor, expected blink and what you actually saw. A virtual LED is not this test.'},
    ...(board.analogPins.length?[{id:'input',title:'Check a real sensor input',instruction:`Use a compatible sensor or potentiometer on ${board.analogPins[0]}. Record low and high readings and check that the program reacts as expected. Expected ADC range: 0–${board.analogMax}.`}]:[])
  ];
  return mode==='live'?[
    shared[0],{id:'connection',title:'Connect the prepared board',instruction:'Prepare the matching live firmware, connect USB, and confirm the app identifies the selected board. Note any boot or serial-port errors.'},...shared.slice(1),
    {id:'stop',title:'Test Stop and connection loss',instruction:'Check that Stop disables the intended test output. Re-run, then disconnect USB communications and observe the firmware watchdog response. Record what happened; stopped servo pulses do not guarantee a mechanical position.'}
  ]:[
    shared[0],{id:'upload',title:'Compile and upload the test program',instruction:'Use a small hardware-only program with one start script. Compile for this exact board, then explicitly choose the port and upload. Record the compile/upload result.'},...shared.slice(1),
    {id:'unplug',title:'Run on independent power',instruction:'Use the correct independent power supply, disconnect USB, and check the uploaded program continues. Restart power and verify it starts again. Browser-driven image, sound and pose models do not run on the disconnected board.'}
  ];
}

export function createBoardAcceptanceReport({boardId,mode,observations={},notes='',createdAt=new Date().toISOString()}) {
  const board=requireBoard(boardId),steps=boardAcceptanceSteps(boardId,mode);
  if (typeof notes!=='string' || notes.length>4000) throw new Error('Keep board test notes within 4,000 characters.');
  if (typeof createdAt!=='string'||!Number.isFinite(Date.parse(createdAt))) throw new Error('A valid test record date is required.');
  if (!observations || typeof observations!=='object' || Array.isArray(observations)) throw new Error('Board observations must be a record.');
  const checks=steps.map(step=>{
    const result=Object.hasOwn(observations,step.id)?observations[step.id]:'not-tested';
    if (!['not-tested','observed-pass','observed-issue'].includes(result)) throw new Error('Choose not tested, observed as expected, or an issue observed.');
    return {...step,result};
  });
  return {format:'duetblox-board-observations',version:1,createdAt,board:{id:board.id,name:board.name,fqbn:board.fqbn,voltage:board.voltage},mode,
    evidenceType:'self-reported physical observations',independentlyVerified:false,softwarePhysicalVerified:board.physicalVerified,
    checks,notes,summary:{observed:checks.filter(item=>item.result!=='not-tested').length,total:checks.length,issues:checks.filter(item=>item.result==='observed-issue').length},
    limitation:'This record does not prove hardware compatibility or certify wiring. It does not change the DUETBlox board validation status. Keep it with the tested project and teacher review.'};
}
