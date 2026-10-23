export const MAX_CODE_LENGTH = 200000;
export const MAX_INPUT_LENGTH = 64000;
export const PYTHON_EXAMPLES = [
  {id:'hello',name:'Say hello',input:'DUET student',code:'# input() reads one line from the Input box.\nname = input("What is your name? ")\nprint(f"Hello, {name}! Welcome to DUETBlox.")\n'},
  {id:'loops',name:'Loops and lists',input:'',code:'# A list can hold another list, like a small table.\nreadings = [[21, 22, 23], [24, 25, 26]]\n\nfor day, values in enumerate(readings, start=1):\n    average = sum(values) / len(values)\n    print(f"Day {day}: average = {average:.1f} °C")\n'},
  {id:'functions',name:'Make a function',input:'5',code:'def make_staircase(height):\n    return ["★" * step for step in range(1, height + 1)]\n\nheight = int(input("How many steps? "))\nif 1 <= height <= 20:\n    for line in make_staircase(height):\n        print(line)\nelse:\n    print("Choose a height from 1 to 20.")\n'},
  {id:'numbers',name:'Explore numbers',input:'',code:'import math\nimport statistics\n\nscores = [62, 75, 82, 88, 93]\nprint("Mean:", statistics.mean(scores))\nprint("Middle score:", statistics.median(scores))\nprint("Square root of 144:", math.sqrt(144))\n'}
];

export function defaultPythonProject(){
  return {kind:'duetblox-python',version:1,name:'hello.py',code:PYTHON_EXAMPLES[0].code,input:PYTHON_EXAMPLES[0].input};
}

export function pythonFilename(value){
  const clean=String(value||'program.py').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'').trim().slice(0,100)||'program.py';
  return /\.py$/i.test(clean)?clean:`${clean}.py`;
}

export function validatePythonProject(value){
  if(!value||value.kind!=='duetblox-python'||value.version!==1||typeof value.code!=='string'||typeof value.input!=='string')throw new Error('This is not a supported DUETBlox Python project.');
  if(value.code.length>MAX_CODE_LENGTH)throw new Error('Python code is limited to 200,000 characters.');
  if(value.input.length>MAX_INPUT_LENGTH)throw new Error('Python input is limited to 64,000 characters.');
  if(value.code.includes('\0')||value.input.includes('\0'))throw new Error('Python text cannot contain null characters.');
  return {kind:'duetblox-python',version:1,name:pythonFilename(value.name),code:value.code,input:value.input};
}

export function inputLines(text){
  if(!text)return [];
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  // A final newline ends the previous line; an additional newline supplies an empty line.
  if(lines.at(-1)==='')lines.pop();
  return lines;
}
