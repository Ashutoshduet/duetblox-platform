// Metadata controls label order, model settings, and training provenance. Take
// ownership before the first await so callers cannot alter an import in flight.
// TensorFlow owns/deserializes model weights separately; avoid copying those
// large buffers just to detach the small JSON metadata tree.
export function ownArtifactMetadata(artifact){
  return {...artifact,metadata:structuredClone(artifact?.metadata)};
}
