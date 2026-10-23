const labels = {
  event_whenflagclicked: 'When green flag clicked', event_whenkeypressed: 'When a key is pressed',
  event_whenthisspriteclicked: 'When this sprite is clicked', event_whenbroadcastreceived: 'When a message arrives',
  control_start_as_clone: 'When a clone starts', procedures_definition: 'Define My Block',
  procedures_call: 'Run My Block', control_repeat: 'Repeat', control_forever: 'Forever',
  control_if: 'If', control_if_else: 'If / otherwise', control_wait: 'Wait',
  motion_movesteps: 'Move steps', motion_gotoxy: 'Go to x / y', motion_changexby: 'Change x',
  motion_changeyby: 'Change y', looks_say: 'Say', looks_sayforsecs: 'Say for seconds',
  data_setvariableto: 'Set variable', data_changevariableby: 'Change variable',
  duetHardware_whenBoardStarts: 'When board starts', duetHardware_digitalWrite: 'Set digital pin',
  duetHardware_analogWrite: 'Set PWM pin', duetHardware_readAnalog: 'Read analog input',
  duetHardware_readDigital: 'Read digital input'
};

export function blockLabel(block) {
  if (!block) return 'Block';
  if (block.opcode === 'procedures_call') return `Run ${String(block.mutation?.proccode || 'My Block').slice(0, 100)}`;
  return labels[block.opcode] || String(block.opcode || 'Block').replace(/^[^_]+_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

// A bounded view of the saved block graph. It never evaluates block inputs.
export function projectMap(project, query = '') {
  const targets = Array.isArray(project?.targets) ? project.targets : [];
  const scripts = []; let blockCount = 0, truncated = false;
  for (const target of targets) {
    const blocks = target.blocks || {};
    const entries = Object.entries(blocks).slice(0, 20000);
    if (Object.keys(blocks).length > entries.length) truncated = true;
    blockCount += entries.filter(([,b]) => b && !b.shadow).length;
    for (const [id, root] of entries) {
      if (!root || root.shadow || !root.topLevel) continue;
      if (scripts.length >= 500) { truncated = true; break; }
      const visited = new Set(), pending = [id], terms = [], preview = [];
      while (pending.length && visited.size < 20000) {
        const next = pending.pop();
        if (visited.has(next)) continue;
        visited.add(next); const block = blocks[next]; if (!block) continue;
        if (!block.shadow) {
          const text = blockLabel(block); terms.push(text, block.opcode || '');
          if (preview.length < 5) preview.push(text);
        }
        if (block.mutation?.proccode) terms.push(String(block.mutation.proccode).slice(0, 500));
        for (const value of Object.values(block.fields || {})) terms.push(String(Array.isArray(value) ? value[0] : value).slice(0, 500));
        for (const input of Object.values(block.inputs || {})) {
          if (!Array.isArray(input)) continue;
          for (const item of input.slice(1)) {
            if (typeof item === 'string' && blocks[item]) pending.push(item);
            else if (Array.isArray(item)) terms.push(String(item[1] ?? '').slice(0, 500));
          }
        }
        if (block.next) pending.push(block.next);
      }
      if (pending.length) truncated = true;
      // The definition's linked prototype is authoritative. A body literal or
      // another procedure call can contain "%" without naming this procedure.
      const prototypeId = root.inputs?.custom_block?.[1];
      const prototype = typeof prototypeId === 'string' ? blocks[prototypeId] : null;
      const procedureName = prototype?.opcode === 'procedures_prototype' && typeof prototype.mutation?.proccode === 'string'
        ? prototype.mutation.proccode.trim().slice(0, 100) : '';
      const title = root.opcode === 'procedures_definition' ? `Define ${procedureName || 'My Block'}` : blockLabel(root);
      scripts.push({id, targetName: String(target.name || 'Stage'), title, preview, blockCount: [...visited].filter(key => blocks[key] && !blocks[key].shadow).length, search: `${target.name || ''} ${terms.join(' ')}`.toLocaleLowerCase()});
    }
  }
  const text = String(query).trim().toLocaleLowerCase().slice(0, 200);
  const matches = scripts.filter(script => !text || script.search.includes(text));
  return {spriteCount: targets.filter(t => !t.isStage).length, blockCount, scriptCount: scripts.length,
    matches: matches.slice(0, 100).map(({search, ...script}) => script), matchCount: matches.length, truncated};
}
