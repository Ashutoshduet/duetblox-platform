// This is the only board-method routing boundary. Never retry a failed virtual
// command on physical hardware; switching destinations is an explicit UI action.
const ARGUMENT_LIMITS = Object.freeze({
  setPinMode: 2, digitalWrite: 2, analogWrite: 2, readAnalog: 1, readDigital: 1,
  servoWrite: 2, servoDetach: 1, tone: 3, noTone: 1
});
const PHYSICAL_ACTIVE = new Set(['connected', 'connecting', 'disconnecting']);

export async function dispatchHardware({method, args = [], sourceIsNormal, virtualBoard, realService} = {}) {
  if (typeof method !== 'string' || !Object.hasOwn(ARGUMENT_LIMITS, method)) throw new Error('Unsupported board command.');
  if (!Array.isArray(args) || args.length > ARGUMENT_LIMITS[method]) throw new Error('Invalid board command arguments.');

  const virtualActive = virtualBoard?.getState().enabled === true;
  if (virtualActive) {
    if (!realService || typeof realService.getState !== 'function') throw new Error('Physical board connection state is unavailable.');
    if (PHYSICAL_ACTIVE.has(realService.getState().status)) throw new Error('Disconnect the physical board before using Virtual Board Lab.');
    if (sourceIsNormal !== true) throw new Error('Virtual Board Lab is available in normal Blocks only. Stop the lab before running Junior hardware blocks.');
    if (typeof virtualBoard[method] !== 'function') throw new Error('Unsupported virtual board command.');
    return await virtualBoard[method](...args);
  }

  if (!realService || typeof realService[method] !== 'function') throw new Error('Board service is unavailable.');
  return await realService[method](...args);
}
