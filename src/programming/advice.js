export function uploadAdvice(diagnostic, project) {
  const target = project?.targets?.find(t => t.blocks?.[diagnostic.blockId]);
  const opcode = target?.blocks?.[diagnostic.blockId]?.opcode || '';
  let next = 'Edit this part of the program and check again.';
  if (['ENTRY', 'EVENT'].includes(diagnostic.code)) next = 'Use one “when board starts” script. Put repeated actions inside a loop. Other event scripts remain browser programs.';
  else if (/^duet(ML|Sound|Pose|Text|Objects)_/.test(opcode)) next = 'Keep this as a live browser project. Predictions can control a USB-connected board; the model is not uploaded to the microcontroller.';
  else if (/^(motion|looks|sound|pen)_/.test(opcode)) next = 'Stage animation and recorded sounds run in the browser. For a board program, use GPIO, PWM, servo or tone blocks.';
  else if (/list/.test(opcode)) next = 'Lists are not supported in board uploads yet. Use numeric variables for a small fixed set of values, or keep this project in the browser.';
  else if (/^event_broadcast|^control_.*clone/.test(opcode)) next = 'Messages and clones run in the browser. Board uploads use one sequential program with loops and My Blocks.';
  else if (/PIN|TIMER|SERVO|PWM/.test(diagnostic.code)) next = 'Check this board’s pin capabilities in Boards & robots. Changing the board updates new pin menus but never rewrites existing blocks.';
  else if (/PROCEDURE|ARGUMENT|RECURS/.test(diagnostic.code)) next = 'Uploaded My Blocks accept numeric/boolean inputs. Use loops instead of recursive calls; text arguments remain browser-only.';
  return {...diagnostic, targetName: target?.name, opcode, next};
}
