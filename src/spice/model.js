export const MAX_NETLIST_LENGTH = 24000;
export const MAX_POINTS = 20000;
export const MAX_SIGNALS = 96;
export const RUN_TIMEOUT_MS = 20000;

export const SPICE_EXAMPLES = [
  {id:'divider',name:'Voltage divider · DC',description:'Two 1 kΩ resistors divide 5 V into 2.5 V. Change either resistor and measure the output.',netlist:`Voltage divider\nV1 supply 0 5\nR1 supply out 1k\nR2 out 0 1k\n.op\n.end`},
  {id:'rc',name:'Capacitor charging · transient',description:'A 1 kΩ resistor and 1 µF capacitor give a 1 ms time constant. At 1 ms the capacitor reaches about 3.16 V.',netlist:`RC charging\nV1 supply 0 5\nR1 supply out 1k\nC1 out 0 1u IC=0\n.tran 10u 5m UIC\n.end`},
  {id:'filter',name:'RC low-pass filter · AC',description:'A 1 kΩ / 1 µF low-pass filter has a cutoff near 159 Hz. Compare gain and phase as frequency changes.',netlist:`RC low-pass filter\nV1 input 0 DC 0 AC 1\nR1 input out 1k\nC1 out 0 1u\n.ac dec 40 1 100k\n.end`},
  {id:'diode',name:'Diode characteristic · DC sweep',description:'Sweep a source through a 1 kΩ resistor and a silicon diode. Observe the nonlinear voltage and source current.',netlist:`Diode sweep\nV1 supply 0 0\nR1 supply anode 1k\nD1 anode 0 silicon\n.model silicon D(IS=1n N=1.8)\n.dc V1 0 5 0.05\n.end`},
  {id:'transistor',name:'NPN transistor · DC sweep',description:'Sweep the input of an NPN transistor. The collector voltage falls as the base conducts.',netlist:`NPN transistor switch\nVCC supply 0 5\nVIN input 0 0\nRB input base 10k\nRC supply collector 1k\nQ1 collector base 0 learnerNPN\n.model learnerNPN NPN(IS=1e-14 BF=100 VAF=100)\n.dc VIN 0 2 0.01\n.end`},
  {id:'rlc',name:'RLC oscillation · transient',description:'A resistor, inductor and capacitor produce a damped response. Change R1 to see the effect on ringing.',netlist:`RLC step response\nV1 input 0 PULSE(0 5 0 1u 1u 5m 10m)\nR1 input middle 20\nL1 middle out 10m\nC1 out 0 1u\n.tran 2u 3m\n.end`}
];

export function defaultSpiceProject() {
  return {kind:'duetblox-spice',version:1,name:'My circuit',netlist:SPICE_EXAMPLES[0].netlist};
}

export function validateSpiceProject(project) {
  if (!project || project.kind !== 'duetblox-spice' || project.version !== 1) throw new Error('This is not a supported DUETBlox SPICE project.');
  if (typeof project.netlist !== 'string' || project.netlist.length > MAX_NETLIST_LENGTH) throw new Error(`Keep the netlist under ${MAX_NETLIST_LENGTH.toLocaleString()} characters.`);
  if (typeof project.name !== 'string' || project.name.length > 100) throw new Error('Use a circuit name up to 100 characters.');
  return {kind:'duetblox-spice',version:1,name:project.name || 'My circuit',netlist:project.netlist};
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(meg|[tgkmunpf])?$/i;
const MULTIPLIERS = {t:1e12,g:1e9,meg:1e6,k:1e3,m:1e-3,u:1e-6,n:1e-9,p:1e-12,f:1e-15};
export function spiceNumber(value) {
  const match=String(value).match(NUMBER);
  if (!match) throw new Error(`“${value}” is not a SPICE number. Use values such as 1000, 1k, 1u or 1e-6.`);
  const suffix=match[1]?.toLowerCase();
  const number=Number(suffix ? String(value).slice(0,-suffix.length) : value)*(suffix?MULTIPLIERS[suffix]:1);
  if (!Number.isFinite(number) || Math.abs(number)>1e12) throw new Error('Component values must be finite and no larger than 1e12.');
  return number;
}
const identifier=/^[a-z][a-z0-9_]{0,31}$/i;
const nodeName=/^(?:0|[a-z][a-z0-9_]{0,31}|[1-9][0-9]{0,5})$/i;
const positive=(token,label)=>{const v=spiceNumber(token);if(v<=0)throw new Error(`${label} must be greater than zero.`);return v;};
function sourceValue(value) {
  const tokens=value.replace(/[(),]/g,' ').trim().split(/\s+/);
  if(tokens.length===1){spiceNumber(tokens[0]);return;}
  if(/^(PULSE|SIN)$/i.test(tokens[0])){
    const pulse=tokens[0].toUpperCase()==='PULSE',count=tokens.length-1;
    if(pulse?count!==7:count<3||count>6)throw new Error(pulse?'PULSE needs seven numbers: low high delay rise fall width period.':'SIN needs 3–6 numeric parameters.');
    const numbers=tokens.slice(1).map(spiceNumber);
    if(pulse&&(numbers.slice(2).some(n=>n<0)||numbers[6]<=0||numbers[5]>numbers[6]))throw new Error('PULSE times must be nonnegative, with a positive period at least as long as its width.');
    if(!pulse&&numbers[2]<=0)throw new Error('SIN frequency must be positive.');
    return;
  }
  let i=0;
  if(tokens[0].toUpperCase()==='DC'){spiceNumber(tokens[1]);i=2;}
  if(tokens[i]?.toUpperCase()==='AC'){
    positive(tokens[i+1],'AC amplitude');i+=2;
    if(tokens[i]!==undefined){spiceNumber(tokens[i]);i++;}
  }
  if(i!==tokens.length||i===0)throw new Error('Use a number, DC value, AC amplitude, PULSE(...) or SIN(...) for a source.');
}

/** A small, explicit SPICE dialect keeps imported text out of ngspice's command/file interface. */
export function validateNetlist(input) {
  if(typeof input!=='string'||!input.trim())throw new Error('Add a circuit netlist before running.');
  if(input.length>MAX_NETLIST_LENGTH)throw new Error(`Keep the netlist under ${MAX_NETLIST_LENGTH.toLocaleString()} characters.`);
  if(/[^\x09\x0a\x0d\x20-\x7e]/.test(input))throw new Error('Use plain ASCII in the netlist; write u for micro and ohms as numeric values.');
  const lines=input.replace(/\r\n?/g,'\n').split('\n');
  if(lines.length>250)throw new Error('Keep the circuit under 250 lines.');
  // A fixed harmless title prevents the first user line being interpreted differently by the engine.
  const title=lines.shift().trim();
  if(!title||/^[.+]/.test(title)||/[;`$\\]/.test(title))throw new Error('The first line must be a plain circuit title, not a command.');
  let analysis=null,components=0,ended=false;
  const nodes=new Set(),names=new Set(),models=new Map(),modelUses=[],sourceNames=new Set();
  const normalized=['DUETBlox analog circuit'];
  const fail=(line,error)=>{throw new Error(`Line ${line}: ${error.message||error}`);};
  for(let index=0;index<lines.length;index++){
    const line=lines[index].trim();
    if(!line||line.startsWith('*'))continue;
    try{
      if(ended)throw new Error('Put .end at the end of the netlist.');
      if(line.length>600||/[;`$\\{}'"!]/.test(line))throw new Error('Expressions, file paths and command characters are not supported.');
      if(line.startsWith('+'))throw new Error('Keep each component or inline model on a single line.');
      const tokens=line.split(/\s+/),type=tokens[0].toLowerCase();
      if(type.startsWith('.')){
        if(type==='.end'){if(tokens.length!==1)throw new Error('Use .end without arguments.');ended=true;normalized.push(line);continue;}
        if(type==='.model'){
          const match=line.match(/^\.model\s+([a-z][a-z0-9_]{0,31})\s+(D|NPN|PNP|NMOS|PMOS)\s*\(([^()]*)\)$/i);
          if(!match)throw new Error('Use an inline D, NPN, PNP, NMOS or PMOS model with numeric parameters in parentheses.');
          const key=match[1].toLowerCase();
          if(models.has(key)||models.size>=16)throw new Error('Use unique model names and no more than 16 models.');
          const params=match[3].trim().split(/[\s,]+/);
          if(params.length>32)throw new Error('Use no more than 32 model parameters.');
          for(const param of params){const pair=param.split('=');if(pair.length!==2||!identifier.test(pair[0]))throw new Error('Model parameters must be name=number.');spiceNumber(pair[1]);}
          models.set(key,match[2].toUpperCase());normalized.push(line);continue;
        }
        if(!['.op','.tran','.dc','.ac'].includes(type))throw new Error('Supported analyses are .op, .dc, .ac and .tran. File includes, control scripts and other directives are disabled.');
        if(analysis)throw new Error('Run one analysis at a time.');
        if(type==='.op'){if(tokens.length!==1)throw new Error('Use .op without arguments.');analysis={kind:'op',estimatedPoints:1};}
        if(type==='.tran'){
          const args=tokens.slice(1);if(args.at(-1)?.toLowerCase()==='uic')args.pop();
          if(args.length<2||args.length>4)throw new Error('Use .tran step stop [start [maximum-step]] [UIC].');
          const step=positive(args[0],'Time step'),stop=positive(args[1],'Stop time'),start=args[2]===undefined?0:spiceNumber(args[2]),maxStep=args[3]===undefined?step:positive(args[3],'Maximum step');
          if(start<0||start>=stop||stop>10||Math.min(step,maxStep)<1e-12)throw new Error('Use 0 ≤ start < stop ≤ 10 seconds and a time step of at least 1 ps.');
          const points=Math.ceil(stop/Math.min(step,maxStep));
          if(points>10000)throw new Error('Use a larger time step: at most 10,000 requested intervals are allowed.');
          analysis={kind:'tran',estimatedPoints:points};
        }
        if(type==='.dc'){
          if(tokens.length!==5||!identifier.test(tokens[1])||!/[vi]/i.test(tokens[1][0]))throw new Error('Use .dc source start stop step for one voltage/current source.');
          const start=spiceNumber(tokens[2]),stop=spiceNumber(tokens[3]),step=spiceNumber(tokens[4]);
          if(!step||(stop-start)*step<0)throw new Error('The sweep step must move from start toward stop.');
          const points=Math.floor(Math.abs((stop-start)/step))+1;
          if(points>10000)throw new Error('Use at most 10,000 DC sweep points.');
          analysis={kind:'dc',source:tokens[1].toLowerCase(),estimatedPoints:points};
        }
        if(type==='.ac'){
          if(tokens.length!==5||!['dec','oct','lin'].includes(tokens[1].toLowerCase()))throw new Error('Use .ac dec|oct|lin points start-frequency stop-frequency.');
          const count=Number(tokens[2]),start=positive(tokens[3],'Start frequency'),stop=positive(tokens[4],'Stop frequency');
          if(!Number.isInteger(count)||count<1||count>10000||stop<=start||start<1e-3||stop>1e9)throw new Error('Use 1–10,000 points and increasing frequencies between 0.001 Hz and 1 GHz.');
          const scale=tokens[1].toLowerCase(),points=scale==='lin'?count:Math.ceil(count*Math.log(stop/start)/Math.log(scale==='dec'?10:2))+1;
          if(points>10000)throw new Error('Use at most 10,000 AC sweep points.');analysis={kind:'ac',scale,estimatedPoints:points};
        }
        normalized.push(line);continue;
      }
      if(!identifier.test(tokens[0])||names.has(type))throw new Error('Use a unique component name beginning with a letter (for example R1).');
      const family=type[0],ports={r:2,c:2,l:2,v:2,i:2,d:2,q:3,m:4}[family];
      if(!ports)throw new Error('Supported parts: resistor, capacitor, inductor, voltage/current source, diode, BJT and MOSFET.');
      if(tokens.length<ports+2)throw new Error('The component is missing a pin or value.');
      const pins=tokens.slice(1,ports+1);
      if(pins.some(pin=>!nodeName.test(pin)))throw new Error('Node names may contain letters, numbers and underscores. Ground is 0.');
      pins.forEach(pin=>nodes.add(pin.toLowerCase()));
      const args=tokens.slice(ports+1);
      if('rcl'.includes(family)){
        positive(args[0],'Component value');
        if(args.length>2||(args.length===2&&(family==='r'||!/^IC=/i.test(args[1]))))throw new Error('Use a numeric part value; capacitors and inductors may also specify IC=value.');
        if(args[1])spiceNumber(args[1].slice(3));
      }else if('vi'.includes(family)){sourceValue(args.join(' '));sourceNames.add(type);}
      else{
        if(!identifier.test(args[0]))throw new Error('Use the name of an inline .model.');
        if(family!=='m'&&args.length!==1)throw new Error('This part takes its pin nodes and one model name.');
        if(family==='m')for(const arg of args.slice(1)){const match=arg.match(/^(W|L)=([^=]+)$/i);if(!match)throw new Error('MOSFET geometry supports W=number and L=number.');positive(match[2],'MOSFET geometry');}
        modelUses.push({name:args[0].toLowerCase(),family});
      }
      names.add(type);components++;if(components>64||nodes.size>64)throw new Error('Use at most 64 components and 64 nodes.');
      normalized.push(line);
    }catch(error){fail(index+2,error);}
  }
  if(!ended)throw new Error('Finish the netlist with .end.');
  if(!components)throw new Error('Add at least one component.');
  if(!nodes.has('0'))throw new Error('Connect the circuit to ground (node 0).');
  if(!analysis)throw new Error('Add one analysis: .op, .dc, .ac or .tran.');
  if(analysis.kind==='dc'&&!sourceNames.has(analysis.source))throw new Error('The DC sweep names a source that does not exist.');
  for(const use of modelUses){const model=models.get(use.name);if(!model||!({d:['D'],q:['NPN','PNP'],m:['NMOS','PMOS']}[use.family].includes(model)))throw new Error(`Add a matching inline .model for ${use.name}.`);}
  return {netlist:normalized.join('\n'),analysis,components,nodes:nodes.size};
}

export function normalizeSpiceResult(raw,analysis) {
  if(!raw||!['real','complex'].includes(raw.dataType)||!Array.isArray(raw.data)||!raw.data.length||raw.data.length>MAX_SIGNALS||!Number.isInteger(raw.numPoints)||raw.numPoints<1||raw.numPoints>MAX_POINTS)throw new Error('The solver returned no usable data or exceeded the result limit. Try a simpler circuit or larger time step.');
  const read=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return {real:value,img:0};
    if(value&&Number.isFinite(value.real)&&Number.isFinite(value.img))return value;
    throw new Error('The solver returned a non-finite value. Check connections and model values.');
  };
  const vectors=raw.data.map(series=>{
    if(typeof series.name!=='string'||series.name.length>100||!Array.isArray(series.values)||series.values.length!==raw.numPoints)throw new Error('The solver returned incomplete signal data.');
    const values=series.values.map(read);
    return {name:series.name,type:series.type,real:values.map(v=>v.real),imaginary:values.map(v=>v.img)};
  });
  const axisIndex=analysis.kind==='op'?-1:Math.max(0,vectors.findIndex(v=>v.type===(analysis.kind==='tran'?'time':analysis.kind==='ac'?'frequency':'notype')));
  const axis=axisIndex<0?{name:'Operating point',type:'index',values:[0]}:{name:vectors[axisIndex].name,type:vectors[axisIndex].type,values:vectors[axisIndex].real};
  return {analysis:analysis.kind,complex:raw.dataType==='complex',points:raw.numPoints,axis,signals:vectors.filter((_,index)=>index!==axisIndex),header:String(raw.header||'').slice(0,4000)};
}

export function traceValues(signal,mode='real') {
  if(mode==='magnitude')return signal.real.map((real,i)=>Math.hypot(real,signal.imaginary[i]));
  if(mode==='db')return signal.real.map((real,i)=>20*Math.log10(Math.max(1e-30,Math.hypot(real,signal.imaginary[i]))));
  if(mode==='phase')return signal.real.map((real,i)=>Math.atan2(signal.imaginary[i],real)*180/Math.PI);
  return signal.real;
}
export function resultCsv(result) {
  const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
  const headers=[result.axis.name,...result.signals.flatMap(s=>result.complex?[`${s.name} real`,`${s.name} imaginary`]:[s.name])];
  return [headers.map(quote).join(','),...result.axis.values.map((x,i)=>[x,...result.signals.flatMap(s=>result.complex?[s.real[i],s.imaginary[i]]:[s.real[i]])].join(','))].join('\r\n');
}
