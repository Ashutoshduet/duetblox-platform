import {getBoard} from '../hardware/boards.js';

/** One catalog supplies the palette, preflight and actual serial validation. */
export function boardMenus(boardId = 'arduino-uno') {
  const board = getBoard(boardId);
  if (!board?.live) throw new Error('Choose an implemented Arduino or ESP32 profile.');
  const items = values => values.length ? values.map(value => ({text: String(value), value: String(value)})) : [{text: 'Unavailable on this board', value: 'unavailable'}];
  const preferred = (values, pin) => String(values.includes(pin) ? pin : values[0] ?? 'unavailable');
  return {
    boardId: board.id, name: board.name, hasAnalog: board.analogPins.length > 0,
    defaults: {digital: preferred(board.digitalPins, 2), output: preferred(board.outputPins, 13), pwm: preferred(board.pwmPins, 3), servo: preferred(board.outputPins, 9), tone: preferred(board.outputPins, 8), analog: preferred(board.analogPins, 'A0')},
    menus: Object.fromEntries([['digitalPin', board.digitalPins], ['outputPin', board.outputPins], ['pwmPin', board.pwmPins], ['analog', board.analogPins]].map(([key, values]) => [key, {acceptReporters: true, items: items(values)}]))
  };
}
