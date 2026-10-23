// Read Scratch 3 procedure mutations without executing project data.
// Names stay in metadata; generated C++ uses its own identifiers.
const mutationArray = (value, label) => {
  let result;
  try { result = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw new Error(`My Blocks ${label} must be a valid JSON array.`); }
  if (!Array.isArray(result)) throw new Error(`My Blocks ${label} must be an array.`);
  return result;
};

export function procedureSignature(definitionId, definition, blocks) {
  const prototypeId = definition.inputs?.custom_block?.[1];
  const prototype = blocks[prototypeId];
  if (!prototype || prototype.opcode !== 'procedures_prototype') throw new Error('My Blocks definition is missing its procedure prototype.');
  const mutation = prototype.mutation || {};
  if (typeof mutation.proccode !== 'string' || !mutation.proccode.trim()) throw new Error('My Blocks definition needs a nonempty procedure signature.');
  // Escaped percent signs are labels; only Scratch number/text and Boolean slots are supported.
  const slots = [...mutation.proccode.matchAll(/(?<!\\)%([nsb])/g)].map(match => match[1]);
  const ids = mutationArray(mutation.argumentids, 'argument IDs');
  const names = mutationArray(mutation.argumentnames, 'argument names');
  const defaults = mutationArray(mutation.argumentdefaults, 'argument defaults');
  if (ids.length !== slots.length || names.length !== slots.length || defaults.length !== slots.length || ids.length > 32) throw new Error('My Blocks signature and argument metadata disagree, or exceed 32 inputs.');
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error('My Blocks argument IDs must be unique, nonempty strings.');
  if (names.some(name => typeof name !== 'string' || !name) || new Set(names).size !== names.length) throw new Error('Use a different nonempty name for each My Blocks input before uploading.');
  if (names.includes('__proto__')) throw new Error('Rename the reserved My Blocks input __proto__ before uploading.');
  return {
    id: definitionId, code: mutation.proccode, next: definition.next,
    parameters: ids.map((id, index) => ({id, name: names[index], type: slots[index] === 'b' ? 'boolean' : 'number', default: defaults[index]}))
  };
}

export function validateProcedureCall(block, signature) {
  if (block.mutation?.argumentids === undefined) throw new Error('My Blocks call is missing its argument IDs. Recreate this call from the palette.');
  const ids = mutationArray(block.mutation.argumentids, 'call argument IDs');
  if (ids.length !== signature.parameters.length || ids.some((id, index) => id !== signature.parameters[index].id)) throw new Error('My Blocks call does not match its definition. Recreate this call from the palette.');
  const expected = new Set(ids);
  if (Object.keys(block.inputs || {}).some(id => !expected.has(id))) throw new Error('My Blocks call has an unexpected input. Recreate this call from the palette.');
  const present = Object.keys(block.inputs || {}), ordered = ids.filter(id => Object.hasOwn(block.inputs || {}, id));
  if (present.some((id, index) => id !== ordered[index])) throw new Error('My Blocks input evaluation order does not match its definition. Recreate this call from the palette.');
}
