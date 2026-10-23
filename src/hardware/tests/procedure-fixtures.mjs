// Actual Scratch 3 block JSON, shared by semantic checks and official board builds.
export const literalInput = value => [1, [typeof value === 'number' ? 4 : 10, String(value)]];
export function procedureProject(pin = 13) {
  const n = literalInput, ref = id => [2, id];
  const prototype = (code, ids, names, defaults) => ({opcode: 'procedures_prototype', shadow: true,
    mutation: {tagName: 'mutation', children: [], proccode: code, argumentids: JSON.stringify(ids), argumentnames: JSON.stringify(names), argumentdefaults: JSON.stringify(defaults), warp: 'false'}, inputs: {}});
  const call = (code, ids, inputs, next = null) => ({opcode: 'procedures_call', next,
    mutation: {tagName: 'mutation', children: [], proccode: code, argumentids: JSON.stringify(ids), warp: 'false'}, inputs});
  const outer = 'repeat amount %s enabled %b', inner = 'add amount %s';
  const blocks = {
    start: {opcode: 'event_whenflagclicked', topLevel: true, next: 'callOuter1'},
    callOuter1: call(outer, ['outerAmount', 'outerEnabled'], {outerAmount: [3, [12, 'count', 'count'], [4, '0']], outerEnabled: ref('yes')}, 'callOuter2'),
    callOuter2: call(outer, ['outerAmount', 'outerEnabled'], {outerAmount: n(2), outerEnabled: ref('no')}, 'callInnerLast'),
    callInnerLast: call(inner, ['innerAmount'], {innerAmount: n(1)}),
    yes: {opcode: 'operator_gt', inputs: {OPERAND1: n(2), OPERAND2: n(1)}},
    no: {opcode: 'operator_lt', inputs: {OPERAND1: n(2), OPERAND2: n(1)}},
    outerDefinition: {opcode: 'procedures_definition', topLevel: true, inputs: {custom_block: [1, 'outerPrototype']}, next: 'outerIf'},
    outerPrototype: prototype(outer, ['outerAmount', 'outerEnabled'], ['amount', 'enabled'], ['', false]),
    outerIf: {opcode: 'control_if_else', inputs: {CONDITION: ref('outerEnabledReporter'), SUBSTACK: ref('outerRepeat'), SUBSTACK2: ref('outerElse')}},
    outerEnabledReporter: {opcode: 'argument_reporter_boolean', fields: {VALUE: ['enabled', null]}},
    outerRepeat: {opcode: 'control_repeat', inputs: {TIMES: ref('outerAmountReporter'), SUBSTACK: ref('outerInnerCall')}},
    outerAmountReporter: {opcode: 'argument_reporter_string_number', fields: {VALUE: ['amount', null]}},
    outerInnerCall: call(inner, ['innerAmount'], {innerAmount: ref('outerAmountForCall')}),
    outerAmountForCall: {opcode: 'argument_reporter_string_number', fields: {VALUE: ['amount', null]}},
    outerElse: call(inner, ['innerAmount'], {innerAmount: ref('outerPlusTen')}),
    outerPlusTen: {opcode: 'operator_add', inputs: {NUM1: ref('outerAmountElse'), NUM2: n(10)}},
    outerAmountElse: {opcode: 'argument_reporter_string_number', fields: {VALUE: ['amount', null]}},
    innerDefinition: {opcode: 'procedures_definition', topLevel: true, inputs: {custom_block: [1, 'innerPrototype']}, next: 'addToTotal'},
    innerPrototype: prototype(inner, ['innerAmount'], ['amount'], ['']),
    addToTotal: {opcode: 'data_changevariableby', fields: {VARIABLE: ['total', 'total']}, inputs: {VALUE: ref('innerAmountReporter')}, next: 'writePin'},
    innerAmountReporter: {opcode: 'argument_reporter_string_number', fields: {VALUE: ['amount', null]}},
    writePin: {opcode: 'duetHardware_digitalWrite', inputs: {PIN: n(pin), VALUE: ref('positive')}},
    positive: {opcode: 'operator_gt', inputs: {OPERAND1: ref('innerAmountForPin'), OPERAND2: n(0)}},
    innerAmountForPin: {opcode: 'argument_reporter_string_number', fields: {VALUE: ['amount', null]}}
  };
  for (const [prototypeId, prototypeBlock] of Object.entries(blocks).filter(([, block]) => block.opcode === 'procedures_prototype')) {
    const ids = JSON.parse(prototypeBlock.mutation.argumentids), names = JSON.parse(prototypeBlock.mutation.argumentnames);
    ids.forEach((id, index) => {
      const reporterId = `${prototypeId}_${id}`;
      blocks[reporterId] = {opcode: id === 'outerEnabled' ? 'argument_reporter_boolean' : 'argument_reporter_string_number', fields: {VALUE: [names[index], null]}, shadow: true};
      prototypeBlock.inputs[id] = [1, reporterId];
    });
  }
  for (const block of Object.values(blocks)) { block.parent ??= null; block.next ??= null; block.inputs ??= {}; block.fields ??= {}; block.shadow ??= false; block.topLevel ??= false; }
  for (const [id, block] of Object.entries(blocks)) {
    if (block.next && blocks[block.next]) blocks[block.next].parent = id;
    for (const input of Object.values(block.inputs)) if (typeof input[1] === 'string' && blocks[input[1]]) blocks[input[1]].parent = id;
  }
  Object.assign(blocks.start, {x: 30, y: 30}); Object.assign(blocks.outerDefinition, {x: 420, y: 30}); Object.assign(blocks.innerDefinition, {x: 420, y: 400});
  const costumes = [{assetId: 'b6229967372e473079438136d6e7f144', name: 'Blank', md5ext: 'b6229967372e473079438136d6e7f144.svg', dataFormat: 'svg', rotationCenterX: 0, rotationCenterY: 0}];
  return {targets: [
    {isStage: true, name: 'Stage', variables: {total: ['total', 0], count: ['count', 3]}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, costumes, sounds: [], currentCostume: 0, volume: 100, layerOrder: 0},
    {isStage: false, name: 'Board', variables: {}, lists: {}, broadcasts: {}, blocks, comments: {}, costumes, sounds: [], currentCostume: 0, volume: 100, layerOrder: 1, x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around'}
  ], monitors: [], extensions: [], meta: {semver: '3.0.0', vm: '15.2.0', agent: 'DUETBlox procedure acceptance fixture'}};
}
