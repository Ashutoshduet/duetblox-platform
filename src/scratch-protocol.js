export const JUNIOR_COMPLETION_CAPABILITY = 1;
export const SCRATCH_BRIDGE_CAPABILITIES = Object.freeze({juniorCompletion: JUNIOR_COMPLETION_CAPABILITY});

export function supportsJuniorCompletion(payload) {
  return payload?.capabilities?.juniorCompletion === JUNIOR_COMPLETION_CAPABILITY;
}
